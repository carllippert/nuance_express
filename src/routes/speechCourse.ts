import { Router } from "express";
import { v4 as uuid } from 'uuid';
import { createClient } from "@supabase/supabase-js";

import axios from "axios";
import * as mm from 'music-metadata';

const male_voice = "onyx"
const female_voice = "nova"
const translation_prompt = `Translate this sentence to spanish from english exactly leaving nothing out and adding nothing. Use proper pronunciation.`
const llm = ""

//statics
let text_to_speech_model = "tts-1";
let llm_model = "gpt-3.5-turbo";

type ConversationFromGPT = {
    title: string;
    description: string;
    emoji: string;
    messages: {
        text: string;
        speaker: string;
        gender: string;
    }[];
}

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
            tool_calls: any[];
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
    speaker: string;
    text: string;
    play_order?: number;
    audioBuffer?: Buffer;
    metadata?: mm.IAudioMetadata;
    audioUrl?: string;
    asset_id?: string;
    pair_asset_id?: string
    parent_asset_id?: string
}

// let hp_convo: ConversationMessage[] = [
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "Hermione, have you found anything about the Chamber of Secrets in these old books?" },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "Not yet, Harry. There are so many books, but very few mention the Chamber." },
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "It feels like we're looking for a needle in a haystack." },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "We can't give up. The Chamber is a part of Hogwarts' history; there has to be something." },
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "I just wish we had more clues. Do you think it's really real?" },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "I believe it is. The attacks on the students must be related." },
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "But who could be behind them?" },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "That's what we need to figure out. Oh, look at this old scroll!" },
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "Does it say anything about the Chamber?" },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "It mentions a hidden room created by one of the founders. It could be a lead." },
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "That's our best lead yet. We should tell Ron." },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "Definitely. Let's find him after we're done here." },
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "Have you noticed anything strange about the attacks, Hermione?" },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "Yes, all the victims have been found near water. It's peculiar." },
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "Water... that might be important." },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "I'm also trying to understand more about that mysterious voice you heard." },
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "I still can't believe I'm the only one who heard it." },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "There must be a reason for that. We'll figure it out, Harry." },
//     { language: "en", gender: "Male", speaker: "Harry Potter", text: "Thanks, Hermione. I don't know what I'd do without you and Ron." },
//     { language: "en", gender: "Female", speaker: "Hermione Granger", text: "We're a team, Harry. We'll solve this together." }
// ]

const routes = Router();

routes.get('/', async (req, res) => {
    try {
        //Create a "id for the speech practice"
        const speech_course_id = uuid();

        let aggregate_prompt_tokens = 0;
        let aggregate_total_tokens = 0;
        let aggregate_completion_tokens = 0;

        //TODO: calculate what our target CEFR and length should be from some user data
        //TODO: calculate how to know in advance the rough audio length of a course

        let length = 5;
        let cefr = `A2`;

        //TODO: allow passing in of speech_course_id in_case its an immediate request from clien
        //If client passes the ID we can then manage coredata on return because we know course id in advance

        // let user_prompt = `Make me a conversation between Harry Potter
        //  and Hermione Granger about the Chamber of Secrets 
        //  ${length} messages long in english at a CEFR level of ${cefr}`

        // let user_prompt = `Make me a conversation between an elf and a dwarf
        //  in the Lord of the Rings talking about how to spend a good afternoon
        //  ${length} messages long in english at a CEFR level of ${cefr}`

        // let user_prompt = `Make me a conversation between some characters in Dragon Ball Z
        //   about how to advance in life
        //  ${length} messages long in english at a CEFR level of ${cefr}. 
        //  Make it fun and interesting. With each message being about 1 sentence long.`


        let user_prompt = `Make me a conversation between some characters in Alice and Wonderland, pick a fun scene, 
       ${length} messages long in english at a CEFR level of ${cefr}. 
        With each message being about 1 sentence long.`

        let { conversation, prompt_tokens, total_tokens, completion_tokens } = await generateConverstaion(user_prompt);

        //Count tokens form generating the convo
        aggregate_prompt_tokens += prompt_tokens;
        aggregate_total_tokens += total_tokens;
        aggregate_completion_tokens += completion_tokens;

        console.log("prompt_tokens", prompt_tokens);
        console.log("total_tokens", total_tokens);
        console.log("completion_tokens", completion_tokens);

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        // //Create Speach course in supabase
        const { data, error } = await supabase
            .from('speech_courses')
            .insert(
                { speech_course_id: speech_course_id }
            )

        if (error) {
            console.log(error);
            throw error;
        }

        //giving each message a UUID
        let convo = conversation.messages.map((message, index) => {
            return { ...message, asset_id: uuid(), language: "en" }
        })

        // loop through the convo and translate all the message. 
        const translated_conversation = await translateConversation(convo);

        console.log(translated_conversation);

        //count tokens fpr work done translating
        aggregate_prompt_tokens += translated_conversation.prompt_tokens;
        aggregate_total_tokens += translated_conversation.total_tokens;
        aggregate_completion_tokens += translated_conversation.completion_tokens;

        //TODO: add back after we have tested some of the other stuff
        //loop through the convo 
        const audioConverstaion: ConversationMessage[] = await createAudio(translated_conversation.messages);

        await saveIndividualAudioAssets(speech_course_id, audioConverstaion);

        //Calculate total duration of the audio
        let course_duration_ms = audioConverstaion.reduce((acc, message) => {
            return acc + (message.metadata.format.duration * 1000); //convert to milliseconds
        }, 0);

        //calculate course duration in minutes
        let course_duration_seconds = Math.round(course_duration_ms / 1000);

        let course_words = Math.round(audioConverstaion.reduce((acc, message) => {
            return acc + (message.text.split(" ")).length;
        }, 0));

        const words_per_minute = Math.round(course_words / (course_duration_ms / 60000));
        const words_per_second = Math.round(course_words / (course_duration_ms / 1000));

        // //save url to storage object in speeh_course table
        const { data: speech_course_data, error: speech_course_error } = await supabase
            .from('speech_courses')
            .update({
                public_course: true,
                ready: true,
                course_title: conversation.title,
                course_description: conversation.description,
                course_emoji: conversation.emoji,
                prompt_tokens: aggregate_prompt_tokens,
                total_tokens: aggregate_total_tokens,
                completion_tokens: aggregate_completion_tokens,
                cefr,
                course_duration_ms,
                words_per_minute,
                words_per_second,
                course_word_count: course_words,
                course_duration_seconds
            })
            .eq('speech_course_id', speech_course_id)

        if (speech_course_error) {
            console.log(speech_course_error);
            throw speech_course_error;
        }

        res.status(200).send({ speech_couse_id: speech_course_id });
    } catch (error) {
        res.status(500).send(error);
    }
});

async function createAudio(conversation: ConversationMessage[]) {
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
                .upload(`${speech_course_id}/${message.asset_id}.mp3`, message.audioBuffer);

            console.log("upload data", data);
            message.audioUrl = data.path;

            if (error) {
                console.log(error);
                throw error;
            }
        }));

        //TODO: do some postprocessing to avoid Jim: or Grace: in the message text

        // loop through the convo and save the audio url and play order to the database
        const { data: assetData, error: assetError } = await supabase
            .from('speech_course_assets')
            .insert(conversation.map((message) => {
                return {
                    speech_course_id: speech_course_id,
                    audio_url: message.audioUrl,
                    play_order: message.play_order,
                    speaker_voice: message.gender === "M" ? male_voice : female_voice,
                    speaker_gender: message.gender,
                    text: message.text, language: message.language,
                    tts_model: text_to_speech_model,
                    public_asset: true,
                    asset_duration_ms: message.metadata.format.duration * 1000, //convert to milliseconds
                    audio_metadata: message.metadata,
                    storage_bucket: "public-audio",
                    speaker_name: message.speaker,
                    parent_asset_id: message.parent_asset_id,
                    pair_asset_id: message.pair_asset_id,
                    add_empty_space_after_playing: true,
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


async function convertTextToSpeech(text, voice): Promise<{ buffer: Buffer, metadata: mm.IAudioMetadata }> {
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

async function getAudioDuration(buffer): Promise<mm.IAudioMetadata> {
    const metadata = await mm.parseBuffer(buffer, 'audio/mpeg', { duration: true }); //mp3 mimetype
    console.log("metadata :: ", metadata)
    return metadata; // Duration in seconds
}

async function translateText(text): Promise<{ text: string, completion_tokens: number, prompt_tokens: number, total_tokens: number }> {

    try {
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
        const completion_tokens = completion.usage.completion_tokens;
        const prompt_tokens = completion.usage.prompt_tokens;
        const total_tokens = completion.usage.total_tokens;

        return { text: firstResponse, completion_tokens, prompt_tokens, total_tokens }
    } catch (error) {
        console.error('Error translating text:', error);
        throw error;
    }
}

async function translateConversationMessage(message: ConversationMessage):
    Promise<{ messages: ConversationMessage[], total_tokens: number, prompt_tokens: number, completion_tokens: number }> {

    const { text, completion_tokens, prompt_tokens, total_tokens } = await translateText(message.text);

    let new_message_uuid = uuid();

    let newMessage: ConversationMessage = {
        ...message,
        text: text,
        language: "es",
        asset_id: new_message_uuid,
        parent_asset_id: message.asset_id,
        pair_asset_id: message.asset_id
    };

    let updatedMessage = { ...message, pair_asset_id: new_message_uuid };

    return { messages: [updatedMessage, newMessage], completion_tokens, total_tokens, prompt_tokens }
}

async function translateConversation(conversation: ConversationMessage[]):
    Promise<{ messages: ConversationMessage[], prompt_tokens: number, total_tokens: number, completion_tokens: number }> {

    let translatedConversation: ConversationMessage[] = [];
    let play_order = 0;

    let propmt_tokens = 0;
    let completion_tokens = 0;
    let total_tokens = 0;

    const translationPromises = conversation.map((conversationMessage) => {
        return translateConversationMessage(conversationMessage);
    });

    // call all translation in parallel
    const translatedResponses = await Promise.all(translationPromises);

    //loop through to results
    translatedResponses.forEach((response) => {
        propmt_tokens += response.prompt_tokens;
        completion_tokens += response.completion_tokens;
        total_tokens += response.total_tokens;

        //loop through response and add a play order
        response.messages.forEach((message) => {
            message.play_order = play_order++;
        });

        translatedConversation = [...translatedConversation, ...response.messages];
    });

    return { messages: translatedConversation, prompt_tokens: propmt_tokens, total_tokens, completion_tokens }
}

async function generateConverstaion(user_prompt: string): Promise<{ conversation: ConversationFromGPT, completion_tokens: number, prompt_tokens: number, total_tokens: number }> {
    const function_name = "create_conversation";

    const tools = [
        {
            "type": "function",
            "function": {
                "name": function_name,
                "description": "Create a conversation between two people. don't put names in front of the messages. ",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {
                            type: "string",
                            description: "A short fun title for the conversation. Don't say 'conversation' in the title",
                        },
                        "description": {
                            type: "string",
                            description: "A longer description of the conversation"
                        },
                        "emoji": {
                            type: "string",
                            description: "A single emoji to represent the conversation"
                        },
                        "messages": {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    text: {
                                        type: "string",
                                        description: "The message text"
                                    },
                                    speaker: {
                                        type: "string",
                                        description: "The person speaking"
                                    },
                                    gender: {
                                        type: "string",
                                        enum: ["M", "F"],
                                        description: "The person speakings gender"
                                    }
                                },
                                required: ["text"]
                            }
                        }
                    },
                    required: ["messages", "emoji", "title", "description"]
                }
            }
        }
    ];

    //TODO: Require moderation for user prompts
    //TODO: inject book history into system prompt
    //TODO: add a "scene" perhaps to the function call to set the setting of the story as part of the intro?
    let course_generation_prompt = `You are an excellent spanish teacher with in depth knowledge of CEFR standards. `

    const messages = [
        {
            role: "system",
            content: course_generation_prompt,
        },
        {
            role: "user",
            content: user_prompt
        }
    ]

    try {

        let options = {
            model: llm_model,
            messages,
            tools: tools,
        }

        let headers = {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }

        const response = await axios.post('https://api.openai.com/v1/chat/completions', options, headers);

        let completion: ChatCompletion = response.data;

        const firstResponse = completion.choices[0].message.tool_calls[0].function.arguments;

        let parsed = JSON.parse(firstResponse);

        console.log("Tool Calls: ", JSON.stringify(firstResponse));

        const completion_tokens = completion.usage.completion_tokens;
        const prompt_tokens = completion.usage.prompt_tokens;
        const total_tokens = completion.usage.total_tokens;

        return {
            conversation: parsed,
            completion_tokens,
            prompt_tokens,
            total_tokens
        }

    } catch (error) {
        console.error('Error translating text:', error);
        throw error;
    }
}

export default routes