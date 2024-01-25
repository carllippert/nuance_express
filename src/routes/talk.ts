
import { Router } from "express";
import axios from "axios";

import multer from "multer";
import OpenAI from "openai";
import fs from "fs";
import { PostHog } from 'posthog-node'

import * as middleware from "../utils/middleware";
import {
    categorizeUserInput,
} from "../categorize/scoring";

const routes = Router();

routes.get('/:secret/:text', async (req, res) => {
    try {
        // const { text } = req.body;
        const { text, secret } = req.params;

        if (!text) {
            return res.status(400).send('Text is required');
        }

        if(secret !== "magic"){
            return res.status(400).send('Invalid secret');
        }

        const openAiUrl = 'https://api.openai.com/v1/audio/speech';
        const apiKey = process.env.OPENAI_API_KEY;

        const response = await axios.post(openAiUrl, {
            model: "tts-1",
            voice: "nova",
            input: text
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream' // Important for handling the response as a stream
        });

        // Set the content type to audio/mpeg
        res.setHeader('Content-Type', 'audio/mpeg');

        // Stream the audio from OpenAI's response to the client
        response.data.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error synthesizing speech');
    }
});

export default routes;