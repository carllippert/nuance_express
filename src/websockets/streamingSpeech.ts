import OpenAI from "openai";
import { WebSocket } from "ws";
import { Readable } from 'stream';
import fs from 'fs';

import { tts_model, female_voice } from "../utils/config";

import { spawn } from 'child_process';

export const genStreamingSpeech = async (speech_text: string, ws: WebSocket) => {
    try {

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });

        const response = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy',
            input: speech_text,
            response_format: 'aac'
        });

        const stream = response.body as unknown as Readable;

        //Nice for testing what the audio sounds like on this end
        // const audioFilePath = './public/uploads/tts.wav';
        // const fileWriteStream = fs.createWriteStream(audioFilePath);
        // stream.pipe(fileWriteStream);
        // fileWriteStream.on('finish', () => {
        //     console.log('Audio data saved to file:', audioFilePath);
        // });


        // / Function to convert AAC stream to PCM and send via WebSocket
        const convertAACtoPCMAndStream = (aacStream, ws) => {
            // Set up FFmpeg process for conversion
            const ffmpegProcess = spawn('ffmpeg', [
                '-i', 'pipe:0',       // Input from stdin
                '-f', 's16le',       // PCM format
                '-ar', '44100',      // Sample rate
                '-ac', '2',          // Stereo
                'pipe:1'             // Output to stdout
            ]);

            //AUDIO IS WORKIGN! BUT HORRIBLE!
            // Handle errors
            ffmpegProcess.stderr.on('data', (data) => {
                console.error(`FFmpeg error: ${data}`);
            });

            // Stream PCM data to WebSocket client
            ffmpegProcess.stdout.on('data', (chunk) => {
                // ws.send(chunk); // Send PCM chunk directly
                ws.send(chunk)
            });

            // Write AAC stream to FFmpeg stdin
            aacStream.pipe(ffmpegProcess.stdin);

            aacStream.on('end', () => {
                ffmpegProcess.stdin.end();
                console.log('Finished streaming PCM audio to the WebSocket client');
                // Optionally, send a message to the client indicating streaming is complete
                ws.send(JSON.stringify({ key: "message", value: "PCM streaming finished" }));
            });

            aacStream.on('error', (error) => {
                console.error('Stream error:', error);
                ffmpegProcess.stdin.end();
                ws.send(JSON.stringify({ key: "error", value: "Error streaming PCM audio" }));
            });
        };

        convertAACtoPCMAndStream(stream, ws);

        // Stream the audio data back to the WebSocket client
        stream.on('data', (chunk) => {
            console.log('Received a chunk of TTS audio data');
            ws.send(JSON.stringify({ key: "server_state", value: "streaming" }));
            console.log('Sent a chunk of TTS audio data to client');
            // Send each chunk of audio data to the client
            // ws.send(chunk);

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