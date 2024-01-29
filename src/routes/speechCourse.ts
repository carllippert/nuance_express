import { Router } from "express";
import { v4 as uuid } from 'uuid';
import { createClient } from "@supabase/supabase-js";

const stream = require('stream');

const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

// Tell fluent-ffmpeg where it can find FFmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);


import fs from "fs";
import { PostHog } from 'posthog-node'

import axios from "axios";

const male_voice = "onyx"
const female_voice = "nova"
const translation_prompt = `Translate this sentence to spanish from english exactly leaving nothing out and adding nothing. Use proper pronunciation.`
const llm = ""

//statics
let text_to_speech_model = "tts-1";
let llm_model = "gpt-3.5-turbo";

type ChatCompletion = {
    id: string;
    object: string;
    created: number;
    model: string;
    system_fingerprint: string;
    choices: {
        index: number;
        message: {
            role: string;
            content: string;
        };
        logprobs: null;
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
type ConversationMessage = {
    language: string;
    gender: string;
    sender: string;
    text: string;
    play_order?: number;
    audioBuffer?: Buffer;
    audioUrl?: string;
}

let hp_convo: ConversationMessage[] = [
    { language: "en", gender: "Male", "sender": "Harry Potter", "text": "Hermione, have you found anything about the Chamber of Secrets in these old books?" },
    { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "Not yet, Harry. There are so many books, but very few mention the Chamber." },
    // { language: "en", gender: "Male", "sender": "Harry Potter", "text": "It feels like we're looking for a needle in a haystack." },
    // { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "We can't give up. The Chamber is a part of Hogwarts' history; there has to be something." },
    // { language: "en", gender: "Male", "sender": "Harry Potter", "text": "I just wish we had more clues. Do you think it's really real?" },
    // { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "I believe it is. The attacks on the students must be related." },
    // { language: "en", gender: "Male", "sender": "Harry Potter", "text": "But who could be behind them?" },
    // { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "That's what we need to figure out. Oh, look at this old scroll!" },
    // { language: "en", gender: "Male", "sender": "Harry Potter", "text": "Does it say anything about the Chamber?" },
    // { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "It mentions a hidden room created by one of the founders. It could be a lead." },
    // { language: "en", gender: "Male", "sender": "Harry Potter", "text": "That's our best lead yet. We should tell Ron." },
    // { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "Definitely. Let's find him after we're done here." },
    // { language: "en", gender: "Male", "sender": "Harry Potter", "text": "Have you noticed anything strange about the attacks, Hermione?" },
    // { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "Yes, all the victims have been found near water. It's peculiar." },
    // { language: "en", gender: "Male", "sender": "Harry Potter", "text": "Water... that might be important." },
    // { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "I'm also trying to understand more about that mysterious voice you heard." },
    // { language: "en", gender: "Male", "sender": "Harry Potter", "text": "I still can't believe I'm the only one who heard it." },
    // { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "There must be a reason for that. We'll figure it out, Harry." },
    // { language: "en", gender: "Male", "sender": "Harry Potter", "text": "Thanks, Hermione. I don't know what I'd do without you and Ron." },
    // { language: "en", gender: "Female", "sender": "Hermione Granger", "text": "We're a team, Harry. We'll solve this together." }
]

const routes = Router();

routes.get('/', async (req, res) => {
    try {
        //Create a "id for the speech practice"
        const speech_course_id = uuid();

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //Create Speach course in supabase
        const { data, error } = await supabase
            .from('speech_course')
            .insert(
                { speech_course_id: speech_course_id }
            )

        if (error) {
            console.log(error);
            throw error;
        }

        // loop through the convo and translate all the message. 
        const conversation: ConversationMessage[] = await translateConversation(hp_convo);

        //loop through the convo and create 
        console.log(conversation);

        //loop through the convo 
        const audioConverstaion: ConversationMessage[] = await createAudio(conversation);

        await saveIndividualAudioAssets(speech_course_id, audioConverstaion);



        // const audioTool = ffmpeg();
        // let fullAudioBuffer = Buffer.alloc(0);
        // loop through ConverstaionMessage and concat all audio buffers into one audio buffer
        // audioConverstaion.forEach((message) => {

        //     const messageAudioLength = message.audioBuffer.length / (44100 * 2) * 1000; // length in milliseconds
        //     // const silentAudioDuration = 5000; // in milliseconds
        //     // const sampleRate = 44100; // standard sample rate for audio
        //     // const numChannels = 2; // stereo audio

        //     const silentAudioDuration = 5000; // in milliseconds
        //     const sampleRate = 44100; // standard sample rate for audio
        //     const numChannels = 2; // stereo audio

        //     const numSamples = (silentAudioDuration / 1000) * sampleRate * numChannels;
        //     const emptyBuffer = Buffer.alloc(numSamples * 2); // 2 bytes per sample for 16-bit audio


        //     fullAudioBuffer = Buffer.concat([fullAudioBuffer, message.audioBuffer]);
        //     fullAudioBuffer = Buffer.concat([fullAudioBuffer, emptyBuffer]);
        // });



        // use ffmpeg to concat the audio conversation messages
        // let fullAudioBuffer = audioTool.concat(audioConverstaion.map((message) => message.audioBuffer));


        // Note: The above line is a placeholder and may need to be adjusted based on the actual implementation of ffmpeg in the codebase.
        // Ensure that the correct ffmpeg command and options are used for concatenating the audio conversation messages.
        //   let fullAudioBuffer = Buffer.concat(audioConverstaion.map((message) => {
        //     return message.audioBuffer;
        // }));

        let fullAudioBuffer = Buffer.alloc(0);
        // let silence = await generateSilentAudioBuffer(5);

        // for (const message of audioConverstaion) {
        //     const silence = await generateSilentAudioBuffer(5);
        //     console.log("silence: ", silence, "length: ", silence.length);
        //     fullAudioBuffer = Buffer.concat([fullAudioBuffer, message.audioBuffer, silence]);
        // }

        // for (const message of audioConverstaion) {
        //     // Add the message's audio buffer
        //     fullAudioBuffer = Buffer.concat([fullAudioBuffer, message.audioBuffer]);

        //     // Add the silent audio buffer after each message
        //     const silence = await generateSilentAudioBuffer(5);
        //     fullAudioBuffer = Buffer.concat([fullAudioBuffer, silence]);
        // }

        for (let i = 0; i < audioConverstaion.length; i++) {
            // Add the message's audio buffer
            fullAudioBuffer = Buffer.concat([fullAudioBuffer, audioConverstaion[i].audioBuffer]);

            // Add the silent audio buffer after each message, except for the last one
            if (i < audioConverstaion.length - 1) {
                const silence = await generateSilentAudioBuffer(5);
                fullAudioBuffer = Buffer.concat([fullAudioBuffer, silence]);
            }
        }

        // loop through ConverstaionMessage and concat all audio buffers into one audio buffer
        // let fullAudioBufferWithSilence = [];
        // audioConverstaion.forEach((message, index) => {
        //     fullAudioBufferWithSilence.push(message.audioBuffer);
        //     if (index < audioConverstaion.length - 1) {
        //         // Add an empty audio chunk of the same length as the current audio chunk
        //         const emptyAudioChunk = Buffer.alloc(message.audioBuffer.length);
        //         fullAudioBufferWithSilence.push(emptyAudioChunk);
        //     }
        // });
        // let fullAudioBuffer = Buffer.concat(fullAudioBufferWithSilence);

        //save audio to supabase storage and store audio url in ConverstaionMessage object
        const { data: full_conversation_data, error: full_conversation_error } = await supabase
            .storage
            .from('public-audio')
            .upload(`${speech_course_id}/full_conversation.mp3`, fullAudioBuffer);

        if (full_conversation_error) {
            console.log(full_conversation_error);
            throw full_conversation_error;
        }

        // //save url to storage object in speeh_course table
        const { data: speech_course_data, error: speech_course_error } = await supabase
            .from('speech_course')
            .update({ full_audio_url: full_conversation_data.path, public_course: true, ready: true })
            .eq('speech_course_id', speech_course_id)


        if (speech_course_error) {
            console.log(speech_course_error);
            throw speech_course_error;
        }

        res.status(200).send(speech_course_id);
    } catch (error) {
        console.error('Err  or:', error);
        res.status(500).send('Error processing conversation');
    }
});

function generateSilentAudioBuffer(durationInSeconds): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const audioStream = new stream.PassThrough();
        ffmpeg()
            .input('anullsrc') // Generate silent audio
            .inputFormat('lavfi')
            .audioFrequency(24000)
            .audioChannels(1)
            .format('s16le') // Output raw PCM data
            .duration(durationInSeconds)
            .pipe(audioStream);
        const chunks = [];
        audioStream.on('data', chunk => chunks.push(chunk));
        audioStream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
        });
        audioStream.on('error', reject);
    });
}



async function createAudio(conversation) {
    let calls: any[] = [];

    for (const message of conversation) {
        calls.push(convertTextToSpeech(message.text, message.sender === "Man" ? male_voice : female_voice));
        // const audioBuffer = await convertTextToSpeech(message.text, message.sender === "Man" ? male_voice : female_voice);
        // message.audioBuffer = audioBuffer; // Add audioBuffer as a key in the conversation objects
    }

    // Call all the text to speech conversions in parallel
    const audioBuffers = await Promise.all(calls);

    // Loop through the conversation and add the audioBuffer to each message
    conversation.forEach((message, index) => {
        message.audioBuffer = audioBuffers[index];
    });

    return conversation; // Return the modified conversation with audioBuffer added to each message
}

async function saveIndividualAudioAssets(speech_course_id, conversation) {
    try {

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //loop through convo and save audio to supabase storage and store audio url in ConverstaionMessage object
        await Promise.all(conversation.map(async (message, index) => {
            console.log("saving conversation message: ", index);
            const { data, error } = await supabase
                .storage
                .from('public-audio')
                .upload(`${speech_course_id}/${message.play_order}.mp3`, message.audioBuffer);

            console.log("upload data", data);
            message.audioUrl = data.path;

            if (error) {
                console.log(error);
                throw error;
            }
        }));

        // loop through the convo and save the audio url and play order to the database
        const { data: assetData, error: assetError } = await supabase
            .from('speech_course_assets')
            .insert(conversation.map((message) => {
                return {
                    speech_course_id: speech_course_id,
                    audio_url: message.audioUrl,
                    play_order: message.play_order,
                    voice: message.gender === "Male" ? male_voice : female_voice,
                    text: message.text, language: message.language,
                    tts_model: text_to_speech_model,
                    llm,
                    prompt_details: { prompt: translation_prompt, }
                }
            }))

        if (assetError) {
            console.log(assetError);
            throw assetError;
        }

    } catch (error) {
        console.error('Error saving audio assets:', error);
        throw error;
    }
}


async function convertTextToSpeech(text, voice) {
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

        return response.data;
    } catch (error) {
        console.error('Error converting text to speech:', error);
        throw error;
    }
}

async function translateText(text) {
    try {
        // const translationPrompt = `Translate this to ${targetLanguage}: ${text}`;


        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    "role": "system",
                    "content": translation_prompt,
                },
                {
                    "role": "user",
                    "content": text
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(JSON.stringify(response.data));
        let completion: ChatCompletion = response.data;

        const firstResponse = completion.choices[0].message.content;
        return firstResponse;
    } catch (error) {
        console.error('Error translating text:', error);
        throw error;
    }
}

async function translateConversationMessage(message: ConversationMessage): Promise<ConversationMessage[]> {
    const translatedText = await translateText(message.text);

    let newMessage: ConversationMessage = { ...message, text: translatedText, language: "es" };
    return [message, newMessage];
}

async function translateConversation(conversation: ConversationMessage[]): Promise<ConversationMessage[]> {
    let translatedConversation: ConversationMessage[] = [];
    let play_order = 0;

    const translationPromises = conversation.map((conversationMessage) => {
        return translateConversationMessage(conversationMessage);
    });

    // call all translation in parallel
    const translatedResponses = await Promise.all(translationPromises);

    //loop through to results
    translatedResponses.forEach((response) => {

        //loop through response and add a play order
        response.forEach((message) => {
            message.play_order = play_order++;
        });

        translatedConversation = [...translatedConversation, ...response];
    });


    return translatedConversation;
}


export default routes

