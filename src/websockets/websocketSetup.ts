import WebSocket from "ws";
const VAD = require('node-vad');
import { transcribeAudio } from './transcribeAudio';
import { genStreamingSpeech } from "./streamingSpeech";

export class WebSocketWithVAD {
    // private vadProcessor = new VAD(VAD.Mode.NORMAL);
    private vadProcessor = new VAD(VAD.Mode.AGGRESSIVE);
    private isUserSpeaking = false;
    private audioBuffer: Buffer = Buffer.alloc(0);

    private silenceTimeout: NodeJS.Timeout | null = null;
    private readonly silenceThreshold = 2000; // 2 seconds of silence before processing

    //debouncing start time
    private speechStartThreshold = 7; // Number of consecutive speech detections needed to confirm start
    private consecutiveSpeechDetections = 0; // Counter for consecutive speech detections
    private speechDetectionTimeout: NodeJS.Timeout | null = null;
    private readonly speechDetectionInterval = 400; // Interval in milliseconds to wait for another speech event

    constructor(private ws: WebSocket) {
        this.setupWebSocket();
    }

    private setupWebSocket(): void {
        this.ws.on("message", (message: WebSocket.Data) => {
            if (Buffer.isBuffer(message)) {
                console.log("Received audio chunk");
                this.processAudioChunk(message);
            }
        });
    }

    private async processAudioChunk(audioChunk: Buffer): Promise<void> {
        this.vadProcessor.processAudio(audioChunk, 16000).then((res: any) => {
            switch (res) {
                case VAD.Event.VOICE:

                    this.consecutiveSpeechDetections += 1;
                    this.ws.send(JSON.stringify({ key: "message", value: "Consecutive Speech Detections " + this.consecutiveSpeechDetections }));
                    if (this.consecutiveSpeechDetections >= this.speechStartThreshold && !this.isUserSpeaking) {
                        // Confirmed speech start
                        console.log("Confirmed speech start");
                        this.ws.send(JSON.stringify({ key: "message", value: "Confirmed Speech Start" }));
                        this.ws.send(JSON.stringify({ key: "server_state", value: "listening" }));
                        this.isUserSpeaking = true;
                    }
                    this.resetSpeechDetectionTimeout();
                    this.audioBuffer = Buffer.concat([this.audioBuffer, audioChunk]);
                    this.resetSilenceTimeout();
                    break;
                case VAD.Event.NOISE:
                case VAD.Event.SILENCE:
                    // Reset consecutive speech detections if noise or silence is detected
                    this.consecutiveSpeechDetections = 0;
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
        }, this.speechDetectionInterval);
    }

    private resetSilenceTimeout(): void {

        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
        }

        this.silenceTimeout = setTimeout(() => {
            if (this.isUserSpeaking) {
                this.isUserSpeaking = false;
                this.ws.send(JSON.stringify({ key: "message", value: "Starting Transcription" }));
                this.ws.send(JSON.stringify({ key: "server_state", value: "thinking" }));
                this.isUserSpeaking = false;
                this.transcribeAndHandle(this.audioBuffer).catch(console.error);
                this.audioBuffer = Buffer.alloc(0);
            }
        }, this.silenceThreshold);
    }

    private async transcribeAndHandle(audioData: Buffer): Promise<void> {
        try {
            console.log("Transcribing audio...");
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