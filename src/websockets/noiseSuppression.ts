const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
import fs from 'fs';

ffmpeg.setFfmpegPath(ffmpegStatic);

import { Readable, Writable } from 'stream';

export const applyHighPassFilter = async (audioChunk: Buffer, cutoffFrequency: number = 20): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const inputAudioStream = new Readable({
            read() { }
        });
        inputAudioStream.push(audioChunk); // Push the single audio chunk
        inputAudioStream.push(null); // Signal the end of the stream

        let outputBuffer = Buffer.alloc(0); // Initialize an empty Buffer for the output

        ffmpeg(inputAudioStream)
            .inputFormat('s16le') // Specify input format
            .inputOptions(['-ac 1', '-ar 48000']) // Single channel, 48kHz
            .audioFilters(`highpass=f=${cutoffFrequency}`) // Apply the high-pass filter
            .outputFormat('s16le') // Specify output format
            .audioCodec('pcm_s16le') // Ensure the output is PCM
            .on('error', function (err) {
                console.log('An error occurred: ' + err.message);
                reject(err);
            })
            .on('end', function () {
                console.log('High-pass filter applied');
                resolve(outputBuffer); // Resolve with the full output buffer
            })
            .pipe(new Writable({
                write(chunk, encoding, callback) {
                    outputBuffer = Buffer.concat([outputBuffer, chunk]); // Collect chunks into the output buffer
                    callback();
                }
            }));
    });
};


// export const applyHighPassFilter = async (audioChunk: Buffer, cutoffFrequency: number = 20): Promise<Buffer> => {
//     return new Promise((resolve, reject) => {
//         const inputAudioStream = new Readable({
//             read() { }
//         });
//         inputAudioStream.push(audioChunk);
//         inputAudioStream.push(null); // Signal the end of the stream

//         const ffmpegCommand = ffmpeg(inputAudioStream)
//             .inputFormat('s16le')
//             .inputOptions(['-ac 1', '-ar 48000'])
//             .audioFilters(`highpass=f=${cutoffFrequency}`)
//             .outputFormat('s16le')
//             .audioCodec('pcm_s16le'); // Ensure the output is PCM

//         // Collect data chunks from the ffmpeg output stream
//         const chunks = [];
//         ffmpegCommand.on('data', (chunk) => {
//             chunks.push(chunk);
//         });

//         ffmpegCommand.on('end', () => {
//             console.log('High-pass filter applied');
//             const processedAudio = Buffer.concat(chunks);
//             // chunks.push(null); // Signal the end of the stream
//             resolve(processedAudio);
//         });

//         ffmpegCommand.on('error', (err) => {
//             console.log('An error occurred: ' + err.message);
//             reject(err);
//         });

//         // Execute the ffmpeg command
//         ffmpegCommand.pipe();
//     });
// };

// export const applyHighPassFilter = async (audioChunk: Buffer, cutoffFrequency: number = 20): Promise<Buffer> => {
//     return new Promise((resolve, reject) => {
//         const inputAudioStream = new Readable();
//         inputAudioStream.push(audioChunk);
//         inputAudioStream.push(null); // Signal the end of the stream

//         let processedAudio: Buffer = Buffer.from([]);
//         ffmpeg(inputAudioStream)
//             .inputFormat('s16le')
//             .inputOptions(['-f s16le', '-ac 1', '-ar 48000'])
//             .audioFilters(`highpass=f=${cutoffFrequency}`)
//             .on('data', function (chunk) {
//                 processedAudio = Buffer.concat([processedAudio, chunk]);
//             })
//             .on('end', function () {
//                 console.log('High-pass filter applied');
//                 resolve(processedAudio);
//             })
//             .on('error', function (err) {
//                 console.log('An error occurred: ' + err.message);
//                 reject(err);
//             })
//             .outputFormat('s16le')
//             .toFormat('wav')
//             .pipe();
//     });
// }

// Define the applyHighPassFilter method
// const applyHighPassFilter = async (audioChunk: Buffer, cutoffFrequency: number = 20): Promise<Buffer> => {
//     return new Promise((resolve, reject) => {
//         // Create a temporary file to store the incoming audio chunk
//         // Note: For production use, consider using a more robust method for handling temporary files
//         const inputFilePath = './pubilc/uploads/noisy.wav';
//         const outputFilePath = './pubilc/uploads/notNoise.wav';

//         fs.writeFileSync(inputFilePath, audioChunk);

//         ffmpeg(inputFilePath)
//             .audioFilters(`highpass=f=${cutoffFrequency}`)
//             .on('end', function () {
//                 console.log('High-pass filter applied');
//                 // Read the processed audio file and resolve the promise with its Buffer
//                 const processedAudio = fs.readFileSync(outputFilePath);
//                 resolve(processedAudio);

//                 // Cleanup: remove temporary files
//                 fs.unlinkSync(inputFilePath);
//                 fs.unlinkSync(outputFilePath);
//             })
//             .on('error', function (err) {
//                 console.log('An error occurred: ' + err.message);
//                 reject(err);
//             })
//             .saveToFile(outputFilePath);
//     });
// }