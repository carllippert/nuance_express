// import express, { Request, Response } from 'express';
// import http from 'http';
// import WebSocket, { Data } from 'ws';
// // Assuming VAD doesn't have TypeScript definitions, we import it as a regular module.
// // You might need to adjust this import based on how you manage non-TypeScript modules.
// const VAD = require('node-vad');

// const vad = new VAD(VAD.Mode.NORMAL);

// let audioBuffer: Buffer = Buffer.alloc(0);

// let isUserSpeaking: boolean = false;

// // Dummy function placeholders for transcribeAudio. Implement based on your transcription service.
// async function transcribeAudio(audioData: Buffer): Promise<string> {
//     // Implementation goes here
//     return "Transcribed text";
// }

// async function transcribeAndHandle(audioData: Buffer, ws: WebSocket): Promise<void> {
//     try {
//         const transcription: string = await transcribeAudio(audioData);
//         console.log('Transcription:', transcription);
//         ws.send(JSON.stringify({ transcription }));
//     } catch (error) {
//         console.error('Error transcribing audio:', error);
//         ws.send(JSON.stringify({ error: 'Error transcribing audio' }));
//     }
// }

// export function processAudioChunkForVAD(audioChunk: Buffer, ws: WebSocket): void {
//     vad.processAudio(audioChunk, 16000).then((res: any) => {
//         switch (res) {
//             case VAD.Event.VOICE:
//                 console.log('Voice detected');
//                 isUserSpeaking = true;
//                 audioBuffer = Buffer.concat([audioBuffer, audioChunk]);
//                 break;
//             case VAD.Event.NOISE:
//             case VAD.Event.SILENCE:
//                 if (isUserSpeaking) {
//                     console.log('Silence or noise detected after speech, proceeding to transcribe.');
//                     isUserSpeaking = false;
//                     transcribeAndHandle(audioBuffer, ws).catch(console.error);
//                     audioBuffer = Buffer.alloc(0);
//                 }
//                 break;
//             default:
//                 console.log('Error or unknown VAD event');
//         }
//     }).catch(console.error);
// }