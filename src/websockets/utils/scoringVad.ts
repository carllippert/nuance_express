import WebSocket from "ws";
const VAD = require('node-vad');
import { applyHighPassFilter } from "../utils/noiseSuppression";
import LogError from "../../utils/errorLogger";

const VAD_MODE = VAD.Mode.NORMAL;
const CLIENT_SENT_SAMPLE_RATE = 48000;
const SPEECH_START_THRESHOLD = 10;
const SPEECH_END_THRESHOLD = 10;
const AUTO_PAUSE_THRESHOLD = 20000;
const AUTO_CUTOFF_THRESHOLD = 60000;

export abstract class BaseWebsocketHandler {
    private vadProcessor = new VAD(VAD_MODE);
    private notVoiceScore = 0;
    private voiceScore = 0;
    private isUserSpeaking = false;
    private firstChunkTime: Date = null;
    private firstVoiceChunkTime: Date = null;
    private audioBuffer: Buffer = Buffer.alloc(0);

    constructor(
        protected ws: WebSocket,
        protected user_id: string,
        protected current_user_timezone: string,
        protected current_seconds_from_gmt: string
    ) {
        this.setupWebSocket();
    }

    private setupWebSocket(): void {
        this.ws.on("message", (message: WebSocket.Data) => {
            if (Buffer.isBuffer(message)) {
                if (message.length === 1 && message[0] === 0x00) {
                    console.log("Received pong");
                } else {
                    this.processAudioChunk(message);
                }
            }
        });
    }

    private addVoiceScore = () => {
        this.voiceScore = Math.max(this.voiceScore + 1, 0);
        this.notVoiceScore = Math.max(this.notVoiceScore - 1, 0);
        console.log("Voice Score: voice - " + this.voiceScore + ", notVoice - " + this.notVoiceScore);
    }

    private addNotVoiceScore = () => {
        this.notVoiceScore = Math.max(this.notVoiceScore + 1, 0);
        this.voiceScore = Math.max(this.voiceScore - 1, 0);
        console.log("Voice Score: voice - " + this.voiceScore + ", notVoice - " + this.notVoiceScore);
    }

    private setUserIsSpeaking = () => {
        this.isUserSpeaking = true;
        this.firstVoiceChunkTime = new Date();
        this.resetVoiceScores();
    }

    private resetVoiceScores = () => {
        this.notVoiceScore = 0;
        this.voiceScore = 0;
    }

    protected resetVadState = () => {
        this.resetVoiceScores();
        this.isUserSpeaking = false;
        this.audioBuffer = Buffer.alloc(0);
        this.firstChunkTime = null;
        this.firstVoiceChunkTime = null;
    }

    private async processAudioChunk(audioChunk: Buffer): Promise<void> {
        console.log("Received audio chunk");

        this.ws.send(JSON.stringify({ key: "message", value: "Processing Audio Chunk" }));
        if (this.firstChunkTime == null) {
            this.firstChunkTime = new Date();
            console.log("Setting First Chunk Time:", this.firstChunkTime);
        }

        this.audioBuffer = Buffer.concat([this.audioBuffer, audioChunk]);
        let noiseSuppressedAudio = await applyHighPassFilter(audioChunk, 200);

        this.vadProcessor.processAudio(noiseSuppressedAudio, CLIENT_SENT_SAMPLE_RATE).then((res: any) => {
            switch (res) {
                case VAD.Event.VOICE:
                    this.ws.send(JSON.stringify({ key: "vad", value: "voice" }));
                    console.log("-- voice --");
                    this.addVoiceScore();
                    if (this.voiceScore > SPEECH_START_THRESHOLD && !this.isUserSpeaking) {
                        console.log("Confirmed speech start");
                        this.ws.send(JSON.stringify({ key: "message", value: "Confirmed Speech Start" }));
                        this.setUserIsSpeaking();
                    }
                    if (this.isUserSpeaking && this.firstVoiceChunkTime != null && (Date.now() - this.firstVoiceChunkTime.getTime()) > AUTO_CUTOFF_THRESHOLD) {
                        console.log(`More than ${AUTO_CUTOFF_THRESHOLD / 1000} seconds have passed since the first voice audio chunk was received`);
                        console.log("Auto cutoff for long content: " + this.firstVoiceChunkTime.toISOString());
                        this.ws.send(JSON.stringify({ key: "message", value: "Starting Transcription" }));
                        this.processUserAudio(this.audioBuffer, this.user_id).catch(console.error);
                        this.resetVadState();
                    }
                    break;
                case VAD.Event.NOISE:
                case VAD.Event.SILENCE:
                    const eventType = res === VAD.Event.NOISE ? "noise" : "silence";
                    console.log(`-- ${eventType} --`);
                    this.addNotVoiceScore();
                    this.ws.send(JSON.stringify({ key: "vad", value: eventType }));
                    if (this.notVoiceScore > SPEECH_END_THRESHOLD && this.isUserSpeaking) {
                        this.ws.send(JSON.stringify({ key: "message", value: "Starting Transcription" }));
                        this.processUserAudio(this.audioBuffer, this.user_id).catch(console.error);
                        this.resetVadState();
                    }
                    if (this.firstChunkTime != null && (Date.now() - this.firstChunkTime.getTime()) > AUTO_PAUSE_THRESHOLD && !this.isUserSpeaking) {
                        console.log("More than 20 seconds have passed since the first audio chunk was received");
                        console.log("Auto pausing: " + this.firstChunkTime.toISOString());
                        this.resetVadState();
                    }
                    break;
                case VAD.Event.ERROR:
                    console.error("-- error --");
                    this.ws.send(JSON.stringify({ key: "vad", value: "error" }));
                    this.resetVadState();
                    break;
                default:
                    LogError(Error("Error or unknown VAD event"), "Error or unknown VAD event");
                    break;
            }
        }).catch((error: any) => {
            LogError(error, "Error processing audio");
        });
    }

    protected abstract processUserAudio(audioBuffer: Buffer, user_id: string): Promise<void>;
}