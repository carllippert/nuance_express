import { WebSocket } from "ws";
import fs from 'fs';


import OpenAI from "openai";
// import { WebSocket } from "ws";
import { Readable } from 'stream';
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

// Tell fluent - ffmpeg where it can find FFmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

const open_ai_audio_format = 'aac';

export enum SHARED_TRANSCRIPTION_STATE {
    CONNECTED = "connected",
    VOICE_DETECTED = "voice_detected",
    VOICE_DETECTION_FINISHED = "voice_detection_finished",
    TRANSCRIBING = "transcribing",
    STREAM_STARTED = "stream_started",
    STREAM_FINISHED = "stream_finished",
    AUTO_PAUSE = "auto_pause"
}

type SERVER_STATE_MESSAGE = {
    key: "server_state",
    value: SHARED_TRANSCRIPTION_STATE
}

export const sendServerStateMessage = (ws: WebSocket, value: SHARED_TRANSCRIPTION_STATE) => {
    const message: SERVER_STATE_MESSAGE = {
        key: "server_state",
        value
    };
    console.log('Sending Server State Message:', message);
    ws.send(JSON.stringify(message));
}

export const genStreamingSpeech = async (speech_text: string, ws: WebSocket) => {
    try {

        console.log("Generating Speech Started")

        let startedStreaming = false;

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

        });

        const pcmAudioFilePath = './public/uploads/tts.pcm';
        const pcmFileWriteStream = fs.createWriteStream(pcmAudioFilePath);

        const convertAACtoPCMAndStream = (audioChunkStream, ws) => {

            const command = ffmpeg()
                .input(audioChunkStream)
                .outputOptions([
                    '-acodec pcm_f32le', // Set audio codec to PCM 32-bit floating-point little endian
                    '-ar 24000', // Set sample rate to 48000 Hz
                    '-ac 1', // Set audio channels to 1 (mono)
                    '-f f32le' // Set format to raw PCM 32-bit floating-point little endian
                ])
                .on('error', (err) => {
                    console.error('FFmpeg error:', err.message);
                    ws.send(JSON.stringify({ key: "error", value: "Error processing audio" }));
                });

            // Use the stream method to obtain a stream from FFmpeg
            const ffmpegStream = command.pipe();

            ffmpegStream.on('data', (chunk) => {
                if (!startedStreaming) {
                    startedStreaming = true;
                    sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.STREAM_STARTED);
                    console.log('Stream Started');
                }

                // Send data chunks to the WebSocket client
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(chunk);
                }
                console.log('Sent a chunk speech to client');
                // Also write the same chunk to the file
                pcmFileWriteStream.write(chunk);
            });

            ffmpegStream.on('end', () => {
                console.log('Finished streaming TTS audio to the WebSocket client');
                // Optionally, send a message to the client indicating streaming is complete
                ws.send(JSON.stringify({ key: "message", value: "TTS streaming finished" }));

                sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.STREAM_FINISHED);
                //reset state
                startedStreaming = false; //unsure if this is necessary
                //finish file
                pcmFileWriteStream.end();
            });

            ffmpegStream.on('error', (error) => {
                console.error('Error streaming TTS audio:', error);
                // Optionally, inform the client about the error
                ws.send(JSON.stringify({ key: "error", value: "Error streaming TTS audio from FFMPeg" }));
            });
        };

        convertAACtoPCMAndStream(stream, ws);

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