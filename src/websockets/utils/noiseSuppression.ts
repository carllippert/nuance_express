const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegStatic);

import { Readable, Writable } from 'stream';
import LogError from '../../utils/errorLogger';

export const applyHighPassFilter = async (audioChunk: Buffer, cutoffFrequency: number): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const inputAudioStream = new Readable({
            read() {}
        });
        inputAudioStream.push(audioChunk); // Push the single audio chunk
        inputAudioStream.push(null); // Signal the end of the stream

        let outputBuffer = Buffer.alloc(0); // Initialize an empty Buffer for the output

        const command = ffmpeg(inputAudioStream)
            .inputFormat('s16le') // Specify input format
            .inputOptions(['-ac 1', '-ar 48000']) // Single channel, 48kHz
            .audioFilters(`highpass=f=${cutoffFrequency}`) // Apply the high-pass filter
            .outputFormat('s16le') // Specify output format
            .audioCodec('pcm_s16le'); // Ensure the output is PCM

        command
            .on('start', commandLine => {
                console.log('Spawned ffmpeg with command: ' + commandLine);
            })
            .on('stderr', stderrLine => {
                console.log("stderr: ", stderrLine); 
                // LogError(new Error(stderrLine), 'An stderr occurred while applying the high-pass filter');
            })
            .on('error', (err, stdout, stderr) => {
                if (err.message.includes('Output stream closed')) {
                    console.log('Output stream closed for high pass filter. Not logging as error.');
                    return;
                } else {
                    console.error('FFmpeg error:', err.message);
                    if (stdout) console.error('FFmpeg stdout:', stdout);
                    if (stderr) console.error('FFmpeg stderr:', stderr);
                    LogError(err, 'An error occurred while applying the high-pass filter');
                    reject(err);
                }
            })
            .on('end', () => {
                console.log('High-pass filter applied');
                resolve(outputBuffer); // Resolve with the full output buffer
            });

        const writableStream = new Writable({
            write(chunk, encoding, callback) {
                outputBuffer = Buffer.concat([outputBuffer, chunk]); // Collect chunks into the output buffer
                callback();
            }
        });

        command.pipe(writableStream);

        // Ensure proper cleanup in case of errors
        writableStream.on('error', (error) => {
            LogError(error, 'An error occurred in the writable stream');
            reject(error);
        });

        // Add a timeout to handle cases where the ffmpeg process might hang
        const timeout = setTimeout(() => {
            const error = new Error('FFmpeg processing timeout');
            LogError(error, 'Timeout while processing audio');
            reject(error);
            command.kill('SIGKILL');
        }, 30000); // 30 seconds timeout

        writableStream.on('finish', () => {
            clearTimeout(timeout);
        });
    });
};

// export const applyHighPassFilter = async (audioChunk: Buffer, cutoffFrequency: number): Promise<Buffer> => {
//     return new Promise((resolve, reject) => {
//         const inputAudioStream = new Readable({
//             read() { }
//         });
//         inputAudioStream.push(audioChunk); // Push the single audio chunk
//         inputAudioStream.push(null); // Signal the end of the stream

//         let outputBuffer = Buffer.alloc(0); // Initialize an empty Buffer for the output

//         ffmpeg(inputAudioStream)
//             .inputFormat('s16le') // Specify input format
//             .inputOptions(['-ac 1', '-ar 48000']) // Single channel, 48kHz
//             .audioFilters(`highpass=f=${cutoffFrequency}`) // Apply the high-pass filter
//             .outputFormat('s16le') // Specify output format
//             .audioCodec('pcm_s16le') // Ensure the output is PCM
//             .on('stderr', function (stderrLine) {
//                 LogError(new Error(stderrLine), 'An stdErr occurred while applying the high-pass filter');
//             })
//             .on('error', function (err, stdout, stderr) {
//                 //common error: Output stream closed not important I think
//                 if (err.message.includes('Output stream closed')) {
//                     console.log('Output stream closed for high pass filter. Not Logging as error.');
//                     return;
//                 } else {
//                     console.error("stdout:\n" + stdout);
//                     console.error("stderr:\n" + stderr);
//                     console.error('An error occurred: ' + err.message);
//                     LogError(err, 'An error occurred while applying the high-pass filter');
//                     reject(err);
//                 }
//             })
//             .on('end', function () {
//                 console.log('High-pass filter applied');
//                 resolve(outputBuffer); // Resolve with the full output buffer
//             })
//             .pipe(new Writable({
//                 write(chunk, encoding, callback) {
//                     outputBuffer = Buffer.concat([outputBuffer, chunk]); // Collect chunks into the output buffer
//                     callback();
//                 }
//             }))
            
//     });
// };

