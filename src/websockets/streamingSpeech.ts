import OpenAI from "openai";
import { WebSocket } from "ws";
import { Readable } from 'stream';
import fs from 'fs';

import { tts_model, female_voice } from "../utils/config";

import { spawn } from 'child_process';

const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

// Tell fluent-ffmpeg where it can find FFmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

const open_ai_audio_format = 'aac';

export const genStreamingSpeech = async (speech_text: string, ws: WebSocket) => {
    try {

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });

        const response = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy',
            input: speech_text,
            response_format: open_ai_audio_format
        });

        const stream = response.body as unknown as Readable;

        //Nice for testing what the audio sounds like on this end
        const openAiAudioFilePath = './public/uploads/tts.' + open_ai_audio_format;
        const opneAiFileWriteStream = fs.createWriteStream(openAiAudioFilePath);

        stream.pipe(opneAiFileWriteStream);
        opneAiFileWriteStream.on('finish', () => {
            console.log('Audio data saved to file:', openAiAudioFilePath);

            const simplePcmAudio = './public/uploads/simple_tts.pcm';
            ffmpeg()
                .input(openAiAudioFilePath)
                .saveToFile(simplePcmAudio)
        });

        const pcmAudioFilePath = './public/uploads/tts.pcm';
        const pcmFileWriteStream = fs.createWriteStream(pcmAudioFilePath);

        const convertAACtoPCMAndStream = (aacStream, ws) => {
            // Define the path for the output PCM file
            // const outputFilePath = './tts.pcm';

            // Create a writable stream for the file
            // const fileWriteStream = fs.createWriteStream(outputFilePath);

            const command = ffmpeg()
                .input(aacStream)
                // .format('aac')
                // .audioCodec('pcm_s16le') // Set output codec to PCM signed 16-bit little endian
                // .format('s16le') // Set format to raw PCM
                .outputOptions([
                    '-acodec pcm_s16le', // Set audio codec to PCM signed 16-bit little endian
                    // '-ar 24000', // Set sample rate to 24000 Hz
                    // '-ac 2', // Set audio channels to 1 (mono)
                    '-f s16le' // Set format to raw PCM
                ])
                .on('error', (err) => {
                    console.error('FFmpeg error:', err.message);
                    ws.send(JSON.stringify({ key: "error", value: "Error processing audio" }));
                });

            // Use the stream method to obtain a stream from FFmpeg
            const ffmpegStream = command.pipe();

            ffmpegStream.on('data', (chunk) => {
                // Send data chunks to the WebSocket client
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(chunk);
                }
                console.log('Sent a chunk of PCM audio data to the WebSocket client');
                // Also write the same chunk to the file
                pcmFileWriteStream.write(chunk);
            });

            ffmpegStream.on('end', () => {
                console.log('Finished streaming PCM audio to the WebSocket client and file');
                // Close the file stream when done
                pcmFileWriteStream.end();
                // Notify the WebSocket client that streaming is finished
                ws.send(JSON.stringify({ key: "message", value: "PCM streaming finished" }));
            });
        };

        // / Function to convert AAC stream to PCM and send via WebSocket
        // const convertAACtoPCMAndStream = (aacStream, ws) => {

        //     // Delete the temp file if it exists
        //     if (fs.existsSync(tempPCMFileName)) {
        //         fs.unlinkSync(tempPCMFileName);
        //     }


        //     // Run FFmpeg
        //     ffmpeg()
        //         .input(audioFilePath)
        //         .saveToFile(tempPCMFileName)

        //     // Handle errors
        //     // ffmpegProcess.stderr.on('data', (data) => {
        //     //     console.error(`FFmpeg error: ${data}`);
        //     // });

        //     // Write AAC stream to FFmpeg stdin
        //     // aacStream.pipe(ffmpegProcess.stdin);



        //     // Wait for FFmpeg to finish
        //     // ffmpegProcess2.on('close', (code) => {
        //     //     console.log(`FFmpeg exited with code ${code}`);
        //     //     // Here you can decide what to do with the temp file
        //     //     // For example, read the file and send its contents to the WebSocket client
        //     //     fs.readFile(tempPCMFileName, (err, data) => {
        //     //         if (err) {
        //     //             console.error('Error reading the temp PCM file:', err);
        //     //             return;
        //     //         }
        //     //         // Example: Sending the file data or just informing the client that the file is ready
        //     //         // ws.send(JSON.stringify({ key: "message", value: "PCM file ready", filePath: tempFilePath }));

        //     //         // Optionally, clean up the temp file after use
        //     //         // fs.unlink(tempPCMFileName, (err) => {
        //     //         //     if (err) console.error('Error deleting temp file:', err);
        //     //         //     else console.log('Temp PCM file deleted successfully');
        //     //         // });
        //     //     });
        //     // });

        //     //AUDIO IS WORKIGN! BUT HORRIBLE!
        //     // Handle errors
        //     // ffmpegProcess.stderr.on('data', (data) => {
        //     //     console.error(`FFmpeg error: ${data}`);
        //     // });

        //     // Stream PCM data to WebSocket client
        //     // ffmpegProcess.stdout.on('data', (chunk) => {
        //     //     // ws.send(chunk); // Send PCM chunk directly
        //     //     ws.send(chunk)
        //     // });

        //     // Write AAC stream to FFmpeg stdin
        //     // aacStream.pipe(ffmpegProcess.stdin);

        //     // aacStream.on('end', () => {
        //     //     ffmpegProcess.stdin.end();
        //     //     console.log('Finished streaming PCM audio to the WebSocket client');
        //     //     // Optionally, send a message to the client indicating streaming is complete
        //     //     ws.send(JSON.stringify({ key: "message", value: "PCM streaming finished" }));
        //     // });

        //     // aacStream.on('error', (error) => {
        //     //     console.error('Stream error:', error);
        //     //     ffmpegProcess.stdin.end();
        //     //     ws.send(JSON.stringify({ key: "error", value: "Error streaming PCM audio" }));
        //     // });
        // };

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