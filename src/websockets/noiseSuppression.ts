const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
import fs from 'fs';

ffmpeg.setFfmpegPath(ffmpegStatic);

import { Readable, Writable } from 'stream';

export const applyHighPassFilter = async (audioChunk: Buffer, cutoffFrequency: number): Promise<Buffer> => {
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
                // console.log('High-pass filter applied');
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

