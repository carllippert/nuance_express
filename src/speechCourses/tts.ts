import axios from "axios";
import * as mm from 'music-metadata';

export type IAudioMetadata = mm.IAudioMetadata;

import { ConversationMessage, male_voice, female_voice } from './config';

export async function createAudio(conversation: ConversationMessage[]) {
    let calls: any[] = [];

    for (const message of conversation) {
        calls.push(convertTextToSpeech(message.text, message.gender === "M" ? male_voice : female_voice));
    }

    // Call all the text to speech conversions in parallel
    const audioData = await Promise.all(calls);

    // Loop through the conversation and add the audioBuffer to each message
    conversation.forEach((message, index) => {
        message.audioBuffer = audioData[index].buffer;
        message.metadata = audioData[index].metadata;
        // message.metadata = await getAudioDuration(audioBuffers[index]);
    });

    return conversation; // Return the modified conversation with audioBuffer added to each message
}

export async function convertTextToSpeech(text, voice): Promise<{ buffer: Buffer, metadata: IAudioMetadata }> {
    try {
        const response = await axios.post('https://api.openai.com/v1/audio/speech', {
            model: "tts-1",
            voice: voice,
            input: text
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
        });

        let metadata = await getAudioDuration(response.data);

        return { buffer: response.data, metadata }

    } catch (error) {
        console.error('Error converting text to speech:', error);
        throw error;
    }
}

export async function getAudioDuration(buffer): Promise<mm.IAudioMetadata> {
    const metadata = await mm.parseBuffer(buffer, 'audio/mpeg', { duration: true }); //mp3 mimetype
    console.log("metadata calculated");
    return metadata; // Duration in seconds
}