import OpenAI from "openai";
import { WebSocket } from "ws";
import fs from 'fs';
import axios from 'axios';

const open_ai_audio_format = 'pcm';

export enum SHARED_TRANSCRIPTION_STATE {
    CONNECTED = "connected",
    VOICE_DETECTED = "voice_detected",
    VOICE_DETECTION_FINISHED = "voice_detection_finished",
    TRANSCRIBING = "transcribing",
    STREAM_STARTED = "stream_started",
    STREAM_FINISHED = "stream_finished"
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

        let startedStreaming = false;

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });


        const openAiUrl = 'https://api.openai.com/v1/audio/speech';
        const apiKey = process.env.OPENAI_API_KEY;

        const stream = await axios.post(openAiUrl, {
            model: "tts-1",
            voice: "nova",
            input: speech_text,
            response_format: open_ai_audio_format
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream' // Important for handling the response as a stream
        });


        //Nice for testing what the audio sounds like on this end
        const openAiAudioFilePath = './public/uploads/tts.' + open_ai_audio_format;
        const opneAiFileWriteStream = fs.createWriteStream(openAiAudioFilePath);

        stream.data.pipe(opneAiFileWriteStream);
        opneAiFileWriteStream.on('finish', () => {
            console.log('Audio data saved to file:', openAiAudioFilePath);

        });

        const pcmAudioFilePath = './public/uploads/tts.pcm';
        const pcmFileWriteStream = fs.createWriteStream(pcmAudioFilePath);


        // Stream the audio data back to the WebSocket client
        stream.data.on('data', (chunk) => {
            // console.log('Received a chunk of TTS audio data');
            if (!startedStreaming) {
                startedStreaming = true;
                sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.STREAM_STARTED);
                console.log('Stream Started');
            }
            // console.log('Sent TTS Chunk');
            ws.send(chunk);
        });

        stream.data.on('end', () => {
            console.log('Finished streaming TTS audio to the WebSocket client');
            // Optionally, send a message to the client indicating streaming is complete
            ws.send(JSON.stringify({ key: "message", value: "TTS streaming finished" }));
            // ws.send(JSON.stringify({ key: "server_state", value: "stream_finished" }));
            sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.STREAM_FINISHED);
            startedStreaming = false; //unsure if this is necessary
        });

        stream.data.on('error', (error) => {
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