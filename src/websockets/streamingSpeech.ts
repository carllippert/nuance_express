import { WebSocket } from "ws";

import OpenAI from "openai";

import { Readable } from 'stream';
import { text_to_speech_model } from "./scoringVad";
import LogError from "../utils/errorLogger";
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegStatic);

const open_ai_audio_format = 'aac';

export enum SHARED_TRANSCRIPTION_STATE {
    CONNECTED = "connected",
    VOICE_DETECTED = "voice_detected",
    TRANSCRIBING = "transcribing",
    STREAM_STARTED = "stream_started",
    STREAM_FINISHED = "stream_finished",
    AUTO_PAUSE = "auto_pause",
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

const convertAACtoPCMAndStream = (audioChunkStream, ws, startedStreaming, reset) => {
    const command = ffmpeg()
        .input(audioChunkStream)
        .outputOptions([
            '-acodec pcm_f32le', // Set audio codec to PCM 32-bit floating-point little endian
            '-ar 24000', // Set sample rate to 48000 Hz
            '-ac 1', // Set audio channels to 1 (mono)
            '-f f32le', // Set format to raw PCM 32-bit floating-point little endian
        ])
        .on('start', commandLine => {
            console.log('Spawned ffmpeg with command: ' + commandLine);
        })
        .on('stderr', stderrLine => {
            console.log("stderr: ", stderrLine);
            // LogError(new Error(stderrLine), 'An stderr occurred while converting AAC to PCM');
        })
        .on('error', (err, stdout, stderr) => {
            console.error("stdout:\n" + stdout);
            console.error("stderr:\n" + stderr);
            LogError(err, 'An error occurred while converting AAC to PCM');
            ws.send(JSON.stringify({ key: "error", value: "Error processing audio" }));
        });

    const ffmpegStream = command.pipe();

    ffmpegStream.on('data', (chunk) => {
        if (!startedStreaming) {
            startedStreaming = true;
            sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.STREAM_STARTED);
            console.log('Stream Started');
        }

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk);
        }

        console.log('Sent a chunk speech to client');
    });

    ffmpegStream.on('end', () => {
        console.log('Finished streaming TTS audio to the WebSocket client');
        ws.send(JSON.stringify({ key: "message", value: "TTS streaming finished" }));
        sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.STREAM_FINISHED);
        reset();
        startedStreaming = false;
    });

    ffmpegStream.on('error', (err, stdout, stderr) => {
        console.error("stdout:\n" + stdout);
        console.error("stderr:\n" + stderr);
        LogError(err, 'An error occurred while streaming TTS audio');
        ws.send(JSON.stringify({ key: "error", value: "Error streaming TTS audio from FFMPeg" }));
    });

    ffmpegStream.on('close', () => {
        console.log('FFmpeg stream closed');
    });

    // Ensure proper cleanup in case of errors
    ffmpegStream.on('error', () => {
        ffmpegStream.end();
    });
};

export const genStreamingSpeech = async (speech_text, ws, reset) => {
    try {
        console.log("Generating Speech Started");

        let startedStreaming = false;

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });

        const response = await openai.audio.speech.create({
            model: text_to_speech_model,
            voice: "nova",
            input: speech_text,
            response_format: open_ai_audio_format
        });

        const stream = response.body as unknown as Readable;

        convertAACtoPCMAndStream(stream, ws, startedStreaming, reset);

        stream.on('error', (error) => {
            LogError(error, 'An error occurred while streaming TTS audio from OpenAI');
            ws.send(JSON.stringify({ key: "error", value: "Error streaming TTS audio" }));
        });

        //TODO: this might be wrong but letting it fly to see what happens. 
        // Add a timeout to handle cases where the response might hang
        const timeout = setTimeout(() => {
            LogError(new Error('Timeout'), 'Timeout while waiting for OpenAI response');
            ws.send(JSON.stringify({ key: "error", value: "Timeout while waiting for OpenAI response" }));
        }, 80000); // 30 seconds timeout

        stream.on('end', () => {
            clearTimeout(timeout);
        });

    } catch (error) {
        LogError(error, 'An error occurred while generating speech');
        ws.send(JSON.stringify({ key: "error", value: "Error generating speech" }));
        throw error;
    }
}

// const convertAACtoPCMAndStream = (audioChunkStream, ws, startedStreaming, reset) => {

//     const command = ffmpeg()
//         .input(audioChunkStream)
//         .outputOptions([
//             '-acodec pcm_f32le', // Set audio codec to PCM 32-bit floating-point little endian
//             '-ar 24000', // Set sample rate to 48000 Hz
//             '-ac 1', // Set audio channels to 1 (mono)
//             '-f f32le', // Set format to raw PCM 32-bit floating-point little endian
//             // Apply an equalizer filter to reduce harsh frequencies and loudnorm for normalization
//             // '-af equalizer=f=5000:width_type=h:width=2000:g=-10'
//             //  loudnorm=I=-23:LRA=7:TP=-2"'
//         ])
//         // .audioFilters('equalizer=f=4000:width_type=h:width=2000:g=-10') // Apply the high-pass filter
//         // .audioFilters(`highpass=f=${cutoffFrequency}`) // Apply the high-pass filter
//         .on('stderr', function (stderrLine) {
//             LogError(new Error(stderrLine), 'An stdError occurred while converting AAC to PCM');
//         })
//         .on('error', (err, stdout, stderr) => {
//             console.error("stdout:\n" + stdout);
//             console.error("stderr:\n" + stderr);
//             LogError(err, 'An error occurred while converting AAC to PCM');
//             ws.send(JSON.stringify({ key: "error", value: "Error processing audio" }));

//         });

//     // Use the stream method to obtain a stream from FFmpeg
//     const ffmpegStream = command.pipe();

//     ffmpegStream.on('data', (chunk) => {
//         if (!startedStreaming) {
//             startedStreaming = true;
//             sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.STREAM_STARTED);
//             console.log('Stream Started');
//         }

//         // Send data chunks to the WebSocket client
//         if (ws.readyState === WebSocket.OPEN) {
//             ws.send(chunk);
//         }

//         console.log('Sent a chunk speech to client');
//     });

//     ffmpegStream.on('end', () => {
//         console.log('Finished streaming TTS audio to the WebSocket client');
//         // Optionally, send a message to the client indicating streaming is complete
//         ws.send(JSON.stringify({ key: "message", value: "TTS streaming finished" }));

//         sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.STREAM_FINISHED);
//         //reset vad state here again ( we do it when we start transcribing)
//         //but it seems that sometimes chunks are still inflight and land and trigger auto-pause
//         //because the state is not reset yet on the random chunks arriving. 
//         reset();
//         //reset local state
//         startedStreaming = false; //unsure if this is necessary
//         //finish file
//         // pcmFileWriteStream.end();
//     });
//     ffmpegStream.on('stderr', function (stderrLine) {
//         LogError(new Error(stderrLine), 'An stdError occurred while streaming audio back?');
//     })
//     ffmpegStream.on('error', (err, stdout, stderr) => {
//         console.error("stdout:\n" + stdout);
//         console.error("stderr:\n" + stderr);
//         LogError(err, 'An error occurred while streaming TTS audio');
//         ws.send(JSON.stringify({ key: "error", value: "Error streaming TTS audio from FFMPeg" }));
//     });

//     // Ensure proper cleanup in case of errors
//     ffmpegStream.on('error', () => {
//         ffmpegStream.end();
//     });
// };


// export const genStreamingSpeech = async (speech_text: string, ws: WebSocket, reset: () => void) => {
//     try {

//         console.log("Generating Speech Started")

//         let startedStreaming = false;

//         const openai = new OpenAI({
//             apiKey: process.env.OPENAI_API_KEY || "",
//         });

//         const response = await openai.audio.speech.create({
//             model: text_to_speech_model,
//             voice: "nova",
//             input: speech_text,
//             response_format: open_ai_audio_format
//         });

//         const stream = response.body as unknown as Readable;

//         convertAACtoPCMAndStream(stream, ws, startedStreaming, reset);

//         stream.on('error', (error) => {
//             LogError(error, 'An error occurred while streaming TTS audio from openAI');
//             ws.send(JSON.stringify({ key: "error", value: "Error streaming TTS audio" }));
//         });

//     } catch (error) {
//         LogError(error, 'An error occurred while generating speech');
//         ws.send(JSON.stringify({ key: "error", value: "Error generating speech" }));
//         throw error;
//     }
// }

