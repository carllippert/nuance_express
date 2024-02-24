import { transciption_model } from "../routes/reading/readingRoute";
import OpenAI from "openai";
import fs from "fs";

export const transcribeAudio = async (audioData: Buffer) => {
    try {


        console.log("Transcribing Audio Started");

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });

        const uniqueIdentifier = Math.floor(Math.random() * 100) + 1;
        // Prepend the WAV header to the raw PCM data
        const wavData = addWavHeader(audioData);

        const tempFilePath = `./public/uploads/user.wav`;

        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        fs.writeFileSync(tempFilePath, wavData);

        const transcript = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: transciption_model,
            language: "en",
            // prompt: "¿Qué pasa? - dijo Ron"
            prompt: "What's up? - said Ron"
        });

        // console.log("Websocketed Transcript: ", transcript);

        // Clean up the temporary file
        // fs.unlinkSync(tempFilePath); //Remove if you want to listen to audio

        // Implementation goes here
        return transcript.text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw error
    }
}

// Add the WAV header to PCM data
function addWavHeader(pcmData, sampleRate = 44100, bitsPerSample = 16, channels = 1) {
    const byteRate = sampleRate * bitsPerSample * channels / 8;
    const blockAlign = bitsPerSample * channels / 8;
    const dataSize = pcmData.length;
    const chunkSize = 36 + dataSize;

    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);                                 // ChunkID
    buffer.writeInt32LE(chunkSize, 4);                       // ChunkSize
    buffer.write('WAVE', 8);                                 // Format
    buffer.write('fmt ', 12);                                // Subchunk1ID
    buffer.writeInt32LE(16, 16);                             // Subchunk1Size
    buffer.writeInt16LE(1, 20);                              // AudioFormat
    buffer.writeInt16LE(channels, 22);                       // NumChannels
    buffer.writeInt32LE(sampleRate, 24);                     // SampleRate
    buffer.writeInt32LE(byteRate, 28);                       // ByteRate
    buffer.writeInt16LE(blockAlign, 32);                     // BlockAlign
    buffer.writeInt16LE(bitsPerSample, 34);                  // BitsPerSample
    buffer.write('data', 36);                                // Subchunk2ID
    buffer.writeInt32LE(dataSize, 40);                       // Subchunk2Size

    return Buffer.concat([buffer, pcmData], 44 + dataSize);
}
