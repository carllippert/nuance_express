import WebSocket from "ws";
const VAD = require('node-vad');
import { transcribeAudio } from './transcribeAudio';
import { SHARED_TRANSCRIPTION_STATE, genStreamingSpeech, sendServerStateMessage } from "./streamingSpeech";

///Adjustments
let VAD_MODE = VAD.Mode.AGGRESSIVE
let SAMPLE_RATE = 48000
let VAD_DEBOUNCE_TIME = 1000
let SILENCE_THRESHOLD = 2000 // 2 seconds of silence before processing
let SPEECH_START_THRESHOLD = 7 // Number of consecutive speech detections needed to confirm start
let SPEECH_DETECTION_INTERVAL = 400  // Interval in milliseconds to wait for another speech event

export class WebSocketWithVAD {

    private vadProcessor = new VAD(VAD_MODE);

    private isUserSpeaking = false;

    private audioBuffer: Buffer = Buffer.alloc(0);

    private silenceTimeout: NodeJS.Timeout | null = null;

    private consecutiveSpeechDetections = 0; // Counter for consecutive speech detections
    private speechDetectionTimeout: NodeJS.Timeout | null = null;

    constructor(private ws: WebSocket) {
        this.setupWebSocket();
    }

    private setupWebSocket(): void {
        this.ws.on("message", (message: WebSocket.Data) => {
            if (Buffer.isBuffer(message)) {
                this.processAudioChunk(message);
            }
        });
    }

    private async processAudioChunk(audioChunk: Buffer): Promise<void> {
        console.log("Received audio chunk");
        this.ws.send(JSON.stringify({ key: "message", value: "Processing Audio Chunk" }));
        this.vadProcessor.processAudio(audioChunk, SAMPLE_RATE).then((res: any) => {
            switch (res) {
                case VAD.Event.VOICE:
                    this.ws.send(JSON.stringify({ key: "vad", value: "voice" }));
                    this.consecutiveSpeechDetections += 1;
                    this.ws.send(JSON.stringify({ key: "message", value: "Consecutive Speech Detections " + this.consecutiveSpeechDetections }));
                    if (this.consecutiveSpeechDetections >= SPEECH_START_THRESHOLD && !this.isUserSpeaking) {
                        // Confirmed speech start
                        console.log("Confirmed speech start");
                        this.ws.send(JSON.stringify({ key: "message", value: "Confirmed Speech Start" }));
                        sendServerStateMessage(this.ws, SHARED_TRANSCRIPTION_STATE.VOICE_DETECTED);
                        this.isUserSpeaking = true;
                    }
                    this.resetSpeechDetectionTimeout();
                    this.audioBuffer = Buffer.concat([this.audioBuffer, audioChunk]);
                    this.resetSilenceTimeout();
                    break;
                case VAD.Event.NOISE:
                    this.ws.send(JSON.stringify({ key: "vad", value: "noise" }));
                case VAD.Event.SILENCE:
                    this.ws.send(JSON.stringify({ key: "vad", value: "silence" }));
                    // Reset consecutive speech detections if noise or silence is detected
                    this.consecutiveSpeechDetections = 0;
                    break;
                case VAD.Event.ERROR:
                    this.ws.send(JSON.stringify({ key: "vad", value: "error" }));
                    break;
                default:
                    console.log("Error or unknown VAD event");
            }
        }).catch(console.error);
    }

    private resetSpeechDetectionTimeout(): void {
        if (this.speechDetectionTimeout) {
            clearTimeout(this.speechDetectionTimeout);
        }
        this.speechDetectionTimeout = setTimeout(() => {
            this.consecutiveSpeechDetections = 0; // Reset counter if no further speech detected within interval
        }, SPEECH_DETECTION_INTERVAL);
    }

    private resetSilenceTimeout(): void {

        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
        }

        this.silenceTimeout = setTimeout(() => {
            if (this.isUserSpeaking) {
                this.isUserSpeaking = false;
                this.ws.send(JSON.stringify({ key: "message", value: "Starting Transcription" }));
                // this.ws.send(JSON.stringify({ key: "server_state", value: "thinking" }));
                sendServerStateMessage(this.ws, SHARED_TRANSCRIPTION_STATE.TRANSCRIBING);
                this.isUserSpeaking = false;
                this.transcribeAndStreamSpeech(this.audioBuffer).catch(console.error);
                this.audioBuffer = Buffer.alloc(0);
            }
        }, SILENCE_THRESHOLD);
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