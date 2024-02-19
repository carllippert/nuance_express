import * as mm from 'music-metadata';
export type IAudioMetadata = mm.IAudioMetadata;

//Prompts
export const translation_prompt = `Translate this sentence to spanish from english exactly leaving nothing out and adding nothing. Use proper pronunciation.`

//Voice
export const male_voice = "onyx"
export const female_voice = "nova"

//Models
export const tts_model = "tts-1";
export const gpt3_turbo = "gpt-3.5-turbo";
export const text_api_provider = "openai";
export const audio_api_provider = "openai";
export const gpt4 = "gpt-4";
export const course_system_version = "0.0.0"; //increment this when the course system changes meaningfully


export type ConversationFromGPT = {
    title: string;
    description: string;
    emoji: string;
    messages: ConversationMessage[];
}

export type ChatCompletion = {
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

export type ConversationMessage = {
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


export const default_course_creation_system_prompt = `You are an excellent spanish teacher with in depth knowledge of CEFR standards.`
export const default_course_creation_user_prompt = `I would like to learn spanish.`


// let user_prompt =
//     `Make me a conversation between two unique characters in the harry potter universe.
// The conversation should be ${num_of_messages} messages long
// with short sentences in english at a CEFR level of ${cefr}.

// The converstion should have a well defined beginning, middle and end.

// The length of the converstaion is VERY IMPORTANT. 

// We will be translating the converstaion into Spanish 
// and then generating audio from it so use simple language and words. 
// `

// let system_prompt = `You are an excellent spanish teacher with in depth knowledge of CEFR standards.`
