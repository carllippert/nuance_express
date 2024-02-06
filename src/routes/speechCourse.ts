import { Router } from "express";
import { v4 as uuid } from 'uuid';
import { createClient } from "@supabase/supabase-js";

// const stream = require('stream');

// import fs from "fs";
// import { PostHog } from 'posthog-node'

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
        // const speech_course_id = uuid();

        let user_prompt = 'Make me a conversation between Harry Potter and Hermione Granger about the Chamber of Secrets 10 messages long in english at a CEFR level of A2'
        let conversation = await generateConverstaion(user_prompt);

        // Create a single supabase client
        // const supabase = createClient(
        //     process.env.SUPABASE_URL || "",
        //     process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        // );

        // //Create Speach course in supabase
        // const { data, error } = await supabase
        //     .from('speech_courses')
        //     .insert(
        //         { speech_course_id: speech_course_id }
        //     )

        // if (error) {
        //     console.log(error);
        //     throw error;
        // }

        //TODO: Give each conversation message a UUID
        // hp_convo = hp_convo.map((message, index) => {
        //     return { ...message, asset_id: uuid() }
        // });


        // loop through the convo and translate all the message. 
        // const conversation: ConversationMessage[] = await translateConversation(hp_convo);

        // //loop through the convo and create 
        // console.log(conversation);


        //TODO: add back after we have tested some of the other stuff
        //loop through the convo 
        // const audioConverstaion: ConversationMessage[] = await createAudio(conversation);

        // await saveIndividualAudioAssets(speech_course_id, audioConverstaion);

        // //save url to storage object in speeh_course table
        // const { data: speech_course_data, error: speech_course_error } = await supabase
        //     .from('speech_course')
        //     .update({ public_course: true, ready: true })
        //     .eq('speech_course_id', speech_course_id)


        // if (speech_course_error) {
        //     console.log(speech_course_error);
        //     throw speech_course_error;
        // }

        res.status(200).send(conversation);
    } catch (error) {
        // console.error('Err  or:', error.message);
        res.status(500).send(error);
    }
});

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

async function translateText(text): Promise<{ text: string, tokens: number }> {

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
        const tokens = completion.usage.completion_tokens;
        return { text: firstResponse, tokens }
    } catch (error) {
        console.error('Error translating text:', error);
        throw error;
    }
}

async function translateConversationMessage(message: ConversationMessage): Promise<ConversationMessage[]> {
    const translatedText = await translateText(message.text);

    let new_message_uuid = uuid();
    let newMessage: ConversationMessage = {
        ...message,
        text: translatedText.text,
        language: "es",
        asset_id: new_message_uuid,
        parent_asset_id: message.asset_id,
        pair_asset_id: message.asset_id
    };

    let updatedMessage = { ...message, pair_asset_id: new_message_uuid };
    return [updatedMessage, newMessage];
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


async function generateConverstaion(user_prompt: string) {

    let schema = {
        "type": "array",
        "description": "The conversation messages",
        "items": {
            "type": "object",
            "properties": {
                "message_text": {
                    "type": "string",
                    "description": "The message text"
                }
            },
            "required": ["message_text"]
        }
    }

    const function_name = "create_conversation";

    // const tools = [
    //     {
    //         "type": "function",
    //         "function": {
    //             "name": "create_conversation",
    //             "description": "Create a conversation between two people",
    //             "parameters": {
    //                 "type": "array",
    //                 "description": "The conversation messages",
    //                 "items": {
    //                     "type": "object",
    //                     "properties": {
    //                         "text": {
    //                             "type": "string",
    //                             "description": "The message text"
    //                         }
    //                     },
    //                 }
    //             }
    //         }
    //     }
    // ];
    //works
    // const tools = [
    //     {
    //         "type": "function",
    //         "function": {
    //             "name": "create_conversation",
    //             "description": "create a conversation between two people",
    //             "parameters": {
    //                 "type": "object",
    //                 "properties": {
    //                     "text": {
    //                         "type": "string",
    //                         "description": "The message text",
    //                     },
    //                 },
    //                 "required": ["text"],
    //             },
    //         }
    //     }
    // ];
    //works ad returns array
    // const tools = [
    //     {
    //         "type": "function",
    //         "function": {
    //             "name": "create_conversation",
    //             "description": "create a conversation between two people",
    //             "parameters": {
    //                 "type": "object",
    //                 "properties": {
    //                     "messages": {
    //                         type: "array",
    //                         items: {
    //                             type: "object",
    //                             properties: {
    //                                 text: {
    //                                     type: "string",
    //                                     description: "The message text"
    //                                 }
    //                             },
    //                             required: ["text"]
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // ];

    const tools = [
        {
            "type": "function",
            "function": {
                "name": "create_conversation",
                "description": "create a conversation between two people. don't put names in front of the messages.",
                "parameters": {
                    "type": "object",
                    "properties": {
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
                                        description: "The person speakings gender"
                                    }
                                },
                                required: ["text"]
                            }
                        }
                    }
                }
            }
        }
    ];


    let course_generation_prompt = `You are an excellent spanish teacher with in depth knowledge of CEFR standards.`

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
            model: "gpt-3.5-turbo",
            messages,
            tools: tools,
        }

        // console.log("Options: " + options);

        let headers = {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }

        const response = await axios.post('https://api.openai.com/v1/chat/completions', options, headers);

        // console.log(JSON.stringify(response.data));
        let completion: ChatCompletion = response.data;

        const firstResponse = completion.choices[0].message.tool_calls[0].function.arguments;

        let parsed = JSON.parse(firstResponse);

        console.log("Tool Calls: ", JSON.stringify(firstResponse));

        const tokens = completion.usage.completion_tokens;

        return parsed;
    } catch (error) {
        console.error('Error translating text:', error);
        throw error;
    }
}

// const messages = [{"role": "user", "content": "What's the weather like in Boston today?"}];
// const tools = [
//     {
//       "type": "function",
//       "function": {
//         "name": "get_current_weather",
//         "description": "Get the current weather in a given location",
//         "parameters": {
//           "type": "object",
//           "properties": {
//             "location": {
//               "type": "string",
//               "description": "The city and state, e.g. San Francisco, CA",
//             },
//             "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
//           },
//           "required": ["location"],
//         },
//       }
//     }
// ];

// const response = await openai.chat.completions.create({
//   model: "gpt-3.5-turbo",
//   messages: messages,
//   tools: tools,
//   tool_choice: "auto",
// });

export default routes

