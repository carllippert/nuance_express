
import WebSocket from "ws";
import { wss } from "../../index";
const VAD = require('node-vad');

import { transcribeAudio } from './transcribeAudio';

// const server = http.createServer(app);
// const wss = new WebSocket.Server({ noServer: true });

// server.on("upgrade", (request, socket, head) => {

//     console.log("Request URL in WS upgrade:", request);

//     const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

//     if (pathname === "/websockets/vad") {
//         wss.handleUpgrade(request, socket, head, (ws) => {
//             wss.emit("connection", ws, request);
//         });
//     } else {
//         socket.destroy();
//     }
// });

wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection", ws.url);
    if(ws.url === "/vad") {
     new WebSocketWithVAD(ws); 
    }// Use the class for each connection
});


export class WebSocketWithVAD {
    private vadProcessor = VAD(VAD.Mode.NORMAL);
    private isUserSpeaking = false;
    private audioBuffer: Buffer = Buffer.alloc(0);

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
        this.vadProcessor.processAudio(audioChunk, 16000).then((res: any) => {
            switch (res) {
                case VAD.Event.VOICE:
                    this.isUserSpeaking = true;
                    this.audioBuffer = Buffer.concat([this.audioBuffer, audioChunk]);
                    break;
                case VAD.Event.NOISE:
                case VAD.Event.SILENCE:
                    if (this.isUserSpeaking) {
                        this.isUserSpeaking = false;
                        this.transcribeAndHandle(this.audioBuffer).catch(console.error);
                        this.audioBuffer = Buffer.alloc(0);
                    }
                    break;
                default:
                    console.log("Error or unknown VAD event");
            }
        }).catch(console.error);
    }

    private async transcribeAndHandle(audioData: Buffer): Promise<void> {
        try {
            const transcription: string = await transcribeAudio(audioData); // Implement this based on your transcription service
            console.log("Transcription:", transcription);
            this.ws.send(JSON.stringify({ transcription }));
        } catch (error) {
            console.error("Error transcribing audio:", error);
            this.ws.send(JSON.stringify({ error: "Error transcribing audio" }));
        }
    }
}