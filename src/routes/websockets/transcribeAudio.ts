import { transciption_model } from "../reading/readingRoute";
import OpenAI from "openai";
import fs from "fs";

export const transcribeAudio = async (audioData: Buffer) => {
    try {
        console.log("Transcribing Audio Started");

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
        });

          // Prepend the WAV header to the raw PCM data
          const wavData = addWavHeader(audioData);

          // Write the WAV data to a temporary file
        //   const tempFilePath = './temp_audio.wav';
        //   fs.writeFileSync(tempFilePath, wavData);
        const tempFilePath =  "./public/uploads/temp_streamed_audio.wav"
        fs.writeFileSync(tempFilePath, wavData);

        const transcript = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: transciption_model,
            language: "es",
            prompt: "¿Qué pasa? - dijo Ron"
        });

        console.log("Websocketed Transcript: ", transcript);

        // Clean up the temporary file
        fs.unlinkSync(tempFilePath);

        // Implementation goes here
        return transcript.text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw error
    }
}

// Add the WAV header to PCM data
function addWavHeader(pcmData, sampleRate = 16000, bitsPerSample = 16, channels = 1) {
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

function writeWavFile(audioData, filePath, sampleRate, bitsPerSample, channels) {
    const byteRate = sampleRate * bitsPerSample * channels / 8;
    const blockAlign = bitsPerSample * channels / 8;
    const dataSize = audioData.length;
    const chunkSize = 36 + dataSize;
    const sampleLength = dataSize / (bitsPerSample / 8);

    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeInt32LE(chunkSize, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeInt16LE(1, 20); // AudioFormat (PCM = 1)
    buffer.writeInt16LE(channels, 22);
    buffer.writeInt32LE(sampleRate, 24);
    buffer.writeInt32LE(byteRate, 28);
    buffer.writeInt16LE(blockAlign, 32);
    buffer.writeInt16LE(bitsPerSample, 34);

    // data subchunk
    buffer.write('data', 36);
    buffer.writeInt32LE(dataSize, 40);
    audioData.copy(buffer, 44);

    fs.writeFileSync(filePath, buffer);
}