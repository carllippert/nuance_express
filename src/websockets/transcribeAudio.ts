import OpenAI from "openai";
import fs from "fs";

import path from "path";
import os from "os";
import LogError from "../utils/errorLogger";

import { CLIENT_SENT_SAMPLE_RATE, transcription_model } from "../websockets/scoringVad";

export const transcribeAudio = async (audioData: Buffer) => {
    try {
        console.log("Transcribing Audio Started");

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });

        // Prepend the WAV header to the raw PCM data
        const wavData = addWavHeader(audioData);

        // Create a temporary file path
        const randomSuffix = Math.floor(Math.random() * 1000);
        const tempFileName = `user_audio_${Date.now()}_${randomSuffix}.wav`;
        const tempFilePath = path.join(os.tmpdir(), tempFileName);
        // const tempFileName = `user_audio_${Date.now()}.wav`;
        // const tempFilePath = path.join(os.tmpdir(), tempFileName);

        // Write the audio data to the temporary file
        fs.writeFileSync(tempFilePath, wavData);

        // Use the temporary file for transcription
        const transcript = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: transcription_model,
            language: "es",
            prompt: "¿Qué pasa? - dijo Ron"
        });

        // Delete the temporary file after use
        fs.unlinkSync(tempFilePath);

        return transcript.text;
    } catch (error) {
        LogError(error, 'Error transcribing audio');
        throw error;
    }
};
// Add the WAV header to PCM data
function addWavHeader(pcmData, sampleRate = CLIENT_SENT_SAMPLE_RATE, bitsPerSample = 16, channels = 1) {
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
