import axios from 'axios';
import { ConversationFromGPT, ChatCompletion, llm_model } from "./config";
import { openai_client } from '../libs/openai';

export async function generateConversation(user_prompt: string): Promise<{ conversation: ConversationFromGPT, completion_tokens: number, prompt_tokens: number, total_tokens: number }> {
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

        // let headers = {
        //     headers: {
        //         'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        //         'Content-Type': 'application/json'
        //     }
        // }

        const response = await openai_client.post('/chat/completions', options);

        let attempts = response.config['axios-retry'].retryCount;

        console.log("Retry Attempts in genreateConversation: ", attempts);

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
        console.error('Error generating conversation:', error);
        throw error;
    }
}