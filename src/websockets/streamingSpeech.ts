import OpenAI from "openai";
// import axios from "axios";
import { WebSocket } from "ws";
// import 'openai/shims/web'
import { Readable } from 'stream';
import fs from 'fs';

import { tts_model, female_voice } from "../utils/config";

export const genStreamingSpeech = async (speech_text: string, ws: WebSocket) => {
    try {

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });

        const response = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy',
            input: speech_text,
        });

        const stream = response.body as unknown as Readable;

        //Nice for testing what the audio sounds like on this end
        // const audioFilePath = './public/uploads/tts.wav';
        // const fileWriteStream = fs.createWriteStream(audioFilePath);
        // stream.pipe(fileWriteStream);
        // fileWriteStream.on('finish', () => {
        //     console.log('Audio data saved to file:', audioFilePath);
        // });

        //Option maybe steram PCM data //TODO: might need to to PCM once we have audio stuff working
        // Use ffmpeg to convert audio data to PCM on-the-fly and stream
        //  ffmpeg(stream)
        //  .audioCodec('pcm_s16le') // Convert to PCM
        //  .format('s16le') // PCM format
        //  .on('data', (chunk) => {
        //      // Send each chunk of PCM data to the client
        //      console.log('Sending PCM chunk');
        //      ws.send(chunk);
        //  })
        //  .on('end', () => {
        //      console.log('Finished streaming PCM audio');
        //      ws.send(JSON.stringify({ message: 'PCM streaming finished' }));
        //  })
        //  .on('error', (error) => {
        //      console.error('Error converting/streaming audio:', error);
        //      ws.send(JSON.stringify({ error: 'Error processing audio' }));
        //  })
        //  .pipe();

        // Stream the audio data back to the WebSocket client
        stream.on('data', (chunk) => {
            console.log('Received a chunk of TTS audio data');
            ws.send(JSON.stringify({ key: "server_state", value: "streaming" }));
            console.log('Sent a chunk of TTS audio data to client');
            // Send each chunk of audio data to the client
            ws.send(chunk);
        });

        stream.on('end', () => {
            console.log('Finished streaming TTS audio to the WebSocket client');
            // Optionally, send a message to the client indicating streaming is complete
            ws.send(JSON.stringify({ key: "message", value: "TTS streaming finished" }));

        });

        stream.on('error', (error) => {
            console.error('Error streaming TTS audio:', error);
            // Optionally, inform the client about the error
            ws.send(JSON.stringify({ key: "error", value: "Error streaming TTS audio" }));
        });

    } catch (error) {
        console.error('Error generating speech:', error);
        // Optionally, inform the client about the error
        ws.send(JSON.stringify({ key: "error", value: "Error generating speech" }));
        throw error;
    }
}