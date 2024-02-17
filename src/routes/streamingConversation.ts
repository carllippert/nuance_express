import { Router } from "express";
import axios from "axios";
import { pipeline } from "stream";
import { promisify } from "util";

const routes = Router();

routes.post('/transcribe-and-synthesize', async (req, res) => {
    try {
        const openAiSpeechToTextUrl = 'https://api.openai.com/v1/audio/transcriptions';
        const openAiTextToSpeechUrl = 'https://api.openai.com/v1/audio/speech';
        const apiKey = process.env.OPENAI_API_KEY;

        // Step 1: Transcribe the streamed audio input
        const transcriptionResponse = await axios.post(openAiSpeechToTextUrl, req, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'audio/mpeg' // Change this based on your audio input format
            }
        });

        const transcribedText = transcriptionResponse.data.text;

        // Step 2: Generate speech from the transcribed text
        const speechResponse = await axios.post(openAiTextToSpeechUrl, {
            model: "tts-1",
            voice: "nova",
            input: transcribedText
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });

        // Step 3: Stream the audio output
        res.setHeader('Content-Type', 'audio/mpeg');
        const streamPipeline = promisify(pipeline);
        await streamPipeline(speechResponse.data, res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error processing audio');
    }
});

export default routes;
