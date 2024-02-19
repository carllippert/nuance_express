import { v4 as uuid } from 'uuid';
import { ConversationFromGPT, ChatCompletion, gpt3_turbo } from "./utils/config";
import { openai_client } from '../libs/openai';
import TokenContext from "../utils/tokenContext";

export async function generateBaseCourseConversation(user_prompt: string, sytsem_prompt: string, requested_messages_length: number, tokenContext: TokenContext): Promise<ConversationFromGPT> {
    const function_name = "create_conversation";

    const tools = [
        {
            "type": "function",
            "function": {
                "name": function_name,
                "description": "Create a conversation between two people. Never put names in front of the messages. ",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {
                            type: "string",
                            description: "A 2 or 3 word fun title for the conversation. Never say 'conversation' in the title",
                        },
                        "description": {
                            type: "string",
                            description: "A short sentence description of the conversation and scene"
                        },
                        "emoji": {
                            type: "string",
                            description: "A single emoji to represent the conversation"
                        },
                        "messages": {
                            type: "array",
                            description: "The array of " + requested_messages_length + " messages in this conversation",
                            items: {
                                type: "object",
                                properties: {
                                    text: {
                                        type: "string",
                                        description: "The message text"
                                    },
                                    speaker: {
                                        type: "string",
                                        description: "The name of the person who is speaking"
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
    // let course_generation_prompt = `You are an excellent spanish teacher with in depth knowledge of CEFR standards.`

    const messages = [
        {
            role: "system",
            content: sytsem_prompt,
        },
        {
            role: "user",
            content: user_prompt
        }
    ]

    try {


        let options = {
            model: gpt3_turbo,
            messages,
            tools: tools,
            max_tokens: 4096,
        }

        const response = await openai_client.post('/chat/completions', options);

        let attempts = response.config['axios-retry'].retryCount;

        console.log("Retry Attempts in genreateConversation: ", attempts);

        let completion: ChatCompletion = response.data;

        console.log("Completion: ", JSON.stringify(completion));

        const firstResponse = completion.choices[0].message.tool_calls[0].function.arguments;

        let conversation: ConversationFromGPT = JSON.parse(firstResponse);

        console.log("Tool Calls: ", JSON.stringify(firstResponse));

        //giving each message a UUID
        let processed_messages = conversation.messages.map((message, index) => {
            return { ...message, asset_id: uuid(), language: "en" }
        })

        conversation.messages = processed_messages;

        tokenContext.addTokens({
            completion_tokens: completion.usage.completion_tokens,
            prompt_tokens: completion.usage.prompt_tokens,
            total_tokens: completion.usage.total_tokens
        })

        return conversation;

    } catch (error) {
        console.error('Error generating conversation:', error);
        throw error;
    }
}