import WebSocket from "ws";
const NODE_VAD = require('node-vad');
import { transcribeAudio } from './transcribeAudio';
import { genStreamingSpeech } from "./streamingSpeech";

import { Readable } from 'stream';

///Adjustments
let VAD_MODE = NODE_VAD.Mode.NORMAL
let SAMPLE_RATE = 48000
let VAD_DEBOUNCE_TIME = 1000

type VadSreamResponse = {
    time: number, // Current seek time in audio
    audioData: Buffer, // Original audio data
    speech: {
        state: boolean, // Current state of speech
        start: boolean, // True on chunk when speech starts
        end: boolean, // True on chunk when speech ends
        startTime: number, // Time when speech started
        duration: number // Duration of current speech block
    }
}

export class WebSocketWithVAD {

    constructor(private ws: WebSocket) {
        this.setupWebSocket();
    }

    private setupWebSocket(): void {
        this.ws.on("message", (message: WebSocket.Data) => {
            if (Buffer.isBuffer(message)) {
                const audioStream = Readable.from([message]);
                this.processAudioStream(audioStream);
            }
        });
    }

    private async processAudioStream(audioStream: Readable): Promise<void> {

        console.log("Received audio chunk");

        const vadStream = NODE_VAD.createStream({
            mode: VAD_MODE,
            audioFrequency: SAMPLE_RATE,
            debounceTime: VAD_DEBOUNCE_TIME
        });

        audioStream.pipe(vadStream);

        vadStream.on('data', (res: VadSreamResponse) => {
            console.log("VadSteram Response:", res);
        });

        audioStream.on('end', () => {
            console.log('Audio stream ended');
        });

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