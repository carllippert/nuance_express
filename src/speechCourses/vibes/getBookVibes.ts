import TokenContext from "../../utils/tokenContext"
import { openai_client } from "../../libs/openai"
import { gpt3_turbo, ChatCompletion } from "../../utils/config";


export const getBookVibes = async (book_data: string[], tokenContext: TokenContext) => {

    let system_prompt = `
    You are the worlds best librarian. You know every book ever written.
    Identify the book title and chapter as well as the key theme, characters, 
    setting of the book for the users provided book excerpt.
    `

    let user_prompt = `
    Evalute this book data
    
    <book excerpt>
    ${book_data.join('\n')}
    </book excerpt>
    `

    const function_name = "get_book_vibes";

    const tools = [
        {
            "type": "function",
            "function": {
                "name": function_name,
                "description": "Identify characteristics of a book excerpt.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {
                            type: "string",
                            description: "What book do you think this is an exerpt from?",
                        },
                        "chapter": {
                            type: "string",
                            description: "What chapter do you think this is an exerpt from?",
                        },
                        "setting": {
                            type: "string",
                            description: "A long sentence describing the setting and environment the characters are in",
                        },
                        "theme": {
                            type: "string",
                            description: "A long sentence describing the key theme of the excerpt",
                        },
                        "summary": {
                            type: "string",
                            description: "A one paragraph summary of the book excerpt"
                        },
                        "characters": {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: {
                                        type: "string",
                                        description: "A single character found in the book data"
                                    },
                                    gender: {
                                        type: "string",
                                        enum: ["M", "F"],
                                        description: "The characters gender"
                                    },
                                },
                                required: ["name", "gender"]
                            }
                        }
                    },
                    required: ["tile", "chapter", "setting", "theme", "summary", "characters"]
                }
            }
        }
    ];

    const messages = [
        {
            role: "system",
            content: system_prompt,
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

        const firstResponse = completion.choices[0].message.tool_calls[0].function.arguments;

        let functionResponse = JSON.parse(firstResponse);

        console.log("Function Response: ", functionResponse);

        // console.log("Tool Calls: ", JSON.stringify(firstResponse));

        //giving each message a UUID
        // let processed_messages = conversation.messages.map((message, index) => {
        //     return { ...message, asset_id: uuid(), language: "en" }
        // })

        // conversation.messages = processed_messages;

        tokenContext.addTokens({
            completion_tokens: completion.usage.completion_tokens,
            prompt_tokens: completion.usage.prompt_tokens,
            total_tokens: completion.usage.total_tokens
        })

        return functionResponse;


    } catch (error) {
        console.error('Error generating conversation:', error);
        throw error;
    }
}

