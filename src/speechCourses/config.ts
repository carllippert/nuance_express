import * as mm from 'music-metadata';
export type IAudioMetadata = mm.IAudioMetadata;

//Prompts
export const translation_prompt = `Translate this sentence to spanish from english exactly leaving nothing out and adding nothing. Use proper pronunciation.`

//Voice
export const male_voice = "onyx"
export const female_voice = "nova"

//Models
export const tts_model = "tts-1";
export const llm_model = "gpt-3.5-turbo";
export const text_api_provider = "openai";
export const audio_api_provider = "openai";

export type ConversationFromGPT = {
    title: string;
    description: string;
    emoji: string;
    messages: {
        text: string;
        speaker: string;
        gender: string;
    }[];
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
