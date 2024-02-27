import OpenAI from "openai";
import { llm_model } from "./scoringVad";

export const fetchCompletion = async (transcript: string) => {
    try {

        console.log("fetching Completion");

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });



        let system_prompt = `
        Translate this sentence to english from spanish exactly leaving nothing out and adding nothing.
        Use proper pronunciation.`

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: system_prompt },
                { role: "user", content: transcript },
            ],
            model: llm_model,
        });

        let gptResponse = completion.choices[0].message.content
            ? completion.choices[0].message.content
            : "";


        return gptResponse;
    }
    catch (error) {
        console.error('Error fetching completion:', error);
        throw error
    }
}