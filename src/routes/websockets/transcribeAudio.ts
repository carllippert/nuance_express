import { transciption_model } from "../reading/readingRoute";
import OpenAI from "openai";

export const transcribeAudio = async (audioData: Buffer) => {
    try {

        console.log("Transcribing Audio");
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });

        const file = new File([audioData], 'audio.wav', { type: 'audio/wav' });

        const transcript = await openai.audio.transcriptions.create({
            file,
            model: transciption_model,
            language: "es",
            prompt: "¿Qué pasa? - dijo Ron"
        });

        console.log("Websocketed Transcript: ", transcript);

        // Implementation goes here
        return transcript.text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw error
    }
}