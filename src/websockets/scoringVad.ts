import WebSocket from "ws";
const VAD = require('node-vad');
import { transcribeAudio } from './transcribeAudio';
import { SHARED_TRANSCRIPTION_STATE, genStreamingSpeech, sendServerStateMessage } from "./streamingSpeech";

///Adjustments
let VAD_MODE = VAD.Mode.NORMAL
export let CLIENT_SENT_SAMPLE_RATE = 48000
let SPEECH_START_THRESHOLD = 10 // Number of consecutive speech detections needed to confirm start
let SPEECH_END_THRESHOLD = 10 // Number of consecutive speech detections needed to confirm end

const HEARTBEAT_INTERVAL = 1000 * 5; // 5 seconds
const HEARTBEAT_VALUE = new Uint8Array([0]);



function ping(ws) {
    // Create a buffer with a single byte of value 0
    console.log("ping");
    ws.send(HEARTBEAT_VALUE, { binary: true });
}

export class WebSocketWithVAD {

    private isAlive = true;
    private vadProcessor = new VAD(VAD_MODE);

    ///for scoring teh user start and stop of speech
    private notVoiceScore = 0; // Score to track silence occurrences
    private voiceScore = 0; // Score to track voice occurrences

    //only for scoring if the user has started speaking at all ( auto pause system )
    private neverSpokeScore = 0;

    //flag for if we have decided the user is speaking
    private isUserSpeaking = false;

    //will use for auto pause system
    private firstChunkTime: Date = null;

    private lastSCoreTime = Date.now();

    private audioBuffer: Buffer = Buffer.alloc(0);

    constructor(private ws: WebSocket, user_id: string) {
        this.setupWebSocket();
        this.setupHeartbeat();
    }

    private setupWebSocket(): void {
        this.ws.on("message", (message: WebSocket.Data) => {
            if (Buffer.isBuffer(message)) {
                // Check if the message is a pong
                if (message.length === 1 && message[0] === 0x00) {
                    console.log("Received pong");
                    this.isAlive = true;
                    // Handle pong (e.g., update heartbeat timestamp)
                } else {
                    // Process as audio chunk
                    this.processAudioChunk(message);
                }
            }
            // if (Buffer.isBuffer(message)) {
            //     this.processAudioChunk(message);
            // }
        });
    }

    private setupHeartbeat() {
        let interval = setInterval(() => {
            //connectino is dead ( we never received pong )
            if (!this.isAlive) {
                console.log("Terminating dead connection. No Pong received.");

                //Close gracefully and tell client to try again essentially
                this.ws.send(JSON.stringify({ key: "error", value: "4000" }));
                // We use code 4000 thouse but currently app reads it from above send not from actual close frame
                this.ws.close(4000, 'Connection was closed abnormally');

                // return;
                /// 4000 is an open code https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.2
                // this.ws.terminate();
                return;
            }
            //set to false everyt time
            //gets turned true when the pong is received
            this.isAlive = false;
            ping(this.ws);
        }, HEARTBEAT_INTERVAL);

        this.ws.on('close', () => {
            clearInterval(interval);
        });
    }

    //zero minimum scores
    private addVoiceScore = () => {
        this.voiceScore = Math.max(this.voiceScore + 1, 0);
        this.notVoiceScore = Math.max(this.notVoiceScore - 1, 0);
        console.log("Voice Score: voice - " + this.voiceScore + ", notVoice - " + this.notVoiceScore);
        console.log("Voice Score: voice - " + this.voiceScore + ", notVoice - " + this.notVoiceScore);
        console.log("Duration since last score time: " + (Date.now() - this.lastSCoreTime) + "ms");
        this.lastSCoreTime = Date.now();
    }

    private addNotVoiceScore = () => {
        //only add to this score if user has started speeaking
        //this score is for determinging when the stop talking and nothing else
        if (this.isUserSpeaking) {
            this.notVoiceScore = Math.max(this.notVoiceScore + 1, 0);
            this.voiceScore = Math.max(this.voiceScore - 1, 0);
            console.log("Voice Score: voice - " + this.voiceScore + ", notVoice - " + this.notVoiceScore);
            console.log("Duration since last score time: " + (Date.now() - this.lastSCoreTime) + "ms");
            this.lastSCoreTime = Date.now();
        } else {
            //only for scoring if the user never started speaking at all. will use for auto pause system
            this.neverSpokeScore += 1;
            if (this.firstChunkTime && (Date.now() - this.firstChunkTime.getTime()) > 20000) {
                console.log("More than 20 seconds have passed since the first audio chunk was received");
                sendServerStateMessage(this.ws, SHARED_TRANSCRIPTION_STATE.AUTO_PAUSE);
            }
        }
    }

    private resetVadState = () => {
        this.notVoiceScore = 0;
        this.voiceScore = 0;
        this.isUserSpeaking = false;
        this.audioBuffer = Buffer.alloc(0);
        this.firstChunkTime = null;
    }


    private async processAudioChunk(audioChunk: Buffer): Promise<void> {
        console.log("Received audio chunk");
        this.ws.send(JSON.stringify({ key: "message", value: "Processing Audio Chunk" }));
        if (this.firstChunkTime == null) {
            this.firstChunkTime = new Date();
            console.log("Settig First Chunk Time:", this.firstChunkTime);
        }

        //TODO: add audio processing here
        //ffmpeg INPUT -af lowpass=3000,highpass=200
        // let new_audio = applyHighpassFilter(audioChunk, 2, CLIENT_SENT_SAMPLE_RATE);
        console.log("Now Vad can process the audio chunk");
        this.vadProcessor.processAudio(audioChunk, CLIENT_SENT_SAMPLE_RATE).then((res: any) => {
            switch (res) {
                case VAD.Event.VOICE:
                    this.ws.send(JSON.stringify({ key: "vad", value: "voice" }));
                    this.addVoiceScore();
                    if (this.voiceScore > SPEECH_START_THRESHOLD && !this.isUserSpeaking) {
                        // Confirmed speech start
                        console.log("Confirmed speech start");
                        this.ws.send(JSON.stringify({ key: "message", value: "Confirmed Speech Start" }));
                        sendServerStateMessage(this.ws, SHARED_TRANSCRIPTION_STATE.VOICE_DETECTED);
                        this.isUserSpeaking = true;
                    }
                    this.audioBuffer = Buffer.concat([this.audioBuffer, audioChunk]);
                    break;
                case VAD.Event.NOISE:
                    this.ws.send(JSON.stringify({ key: "vad", value: "noise" }));
                    this.addNotVoiceScore();
                case VAD.Event.SILENCE:
                    this.addNotVoiceScore()
                    this.ws.send(JSON.stringify({ key: "vad", value: "silence" }));
                    //We started then stopped speaking
                    if (this.notVoiceScore > SPEECH_END_THRESHOLD && this.isUserSpeaking) {
                        this.ws.send(JSON.stringify({ key: "message", value: "Starting Transcription" }));
                        sendServerStateMessage(this.ws, SHARED_TRANSCRIPTION_STATE.TRANSCRIBING);
                        //transcribe and stream speech
                        this.transcribeAndStreamSpeech(this.audioBuffer).catch(console.error);
                        this.resetVadState();
                    }
                    break;
                case VAD.Event.ERROR:
                    this.ws.send(JSON.stringify({ key: "vad", value: "error" }));
                    break;
                default:
                    console.log("Error or unknown VAD event");
            }
        }).catch(console.error);
    }

    private async transcribeAndStreamSpeech(audioData: Buffer): Promise<void> {
        try {
            const transcription: string = await transcribeAudio(audioData); // Implement this based on your transcription service
            console.log("Transcription:", transcription);
            this.ws.send(JSON.stringify({ key: "message", value: transcription }));

            genStreamingSpeech(transcription, this.ws);

        } catch (error) {
            console.error("Error transcribing audio:", error);
            this.ws.send(JSON.stringify({ key: "error", value: "Error transcribing audio" }));
        }
    }

}