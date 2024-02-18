import axios from 'axios';
import { v4 as uuid } from 'uuid';
import { translation_prompt, ChatCompletion, ConversationMessage } from "./utils/config";
import TokenContext from '../utils/tokenContext';

export async function translateText(text): Promise<{ text: string, completion_tokens: number, prompt_tokens: number, total_tokens: number }> {

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

export async function translateConversationMessage(message: ConversationMessage):
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

export async function translateConversation(conversation: ConversationMessage[], tokenContext: TokenContext):
    Promise<{ messages: ConversationMessage[], tokenContext: TokenContext }> {

    let translatedConversation: ConversationMessage[] = [];

    let play_order = 0;

    const translationPromises = conversation.map((conversationMessage) => {
        return translateConversationMessage(conversationMessage);
    });

    // call all translation in parallel
    const translatedResponses = await Promise.all(translationPromises);

    //loop through to results
    translatedResponses.forEach((response) => {
        
        tokenContext.addTokens({
            completion_tokens: response.completion_tokens,
            prompt_tokens: response.prompt_tokens,
            total_tokens: response.total_tokens
        });

        //loop through response and add a play order
        response.messages.forEach((message) => {
            message.play_order = play_order++;
        });

        translatedConversation = [...translatedConversation, ...response.messages];
    });

    return { messages: translatedConversation, tokenContext }
}