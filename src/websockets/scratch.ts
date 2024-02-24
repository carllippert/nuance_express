// const ffmpegStatic = require('ffmpeg-static');
// const ffmpeg = require('fluent-ffmpeg');

// Tell fluent-ffmpeg where it can find FFmpeg
// ffmpeg.setFfmpegPath(ffmpegStatic);


        // const response = await openai.audio.speech.create({
        //     model: 'tts-1',
        //     voice: 'alloy',
        //     input: speech_text,
        //     response_format: open_ai_audio_format
        // });

        // const stream = response.body as unknown as Readable;


        
// const convertAACtoPCMAndStream = (aacStream, ws) => {

//     const command = ffmpeg()
//         .input(aacStream)
//         .inputOptions(['-report'])
//         // .format('aac')
//         // .audioCodec('pcm_s16le') // Set output codec to PCM signed 16-bit little endian
//         // .format('s16le') // Set format to raw PCM
//         .outputOptions([
//             '-acodec pcm_s16le', // Set audio codec to PCM signed 16-bit little endian
//             '-ar 48000', // Set sample rate to 24000 Hz
//             '-ac 1', // Set audio channels to 1 (mono)
//             '-f s16le' // Set format to raw PCM
//         ])
//         .on('error', (err) => {
//             console.error('FFmpeg error:', err.message);
//             ws.send(JSON.stringify({ key: "error", value: "Error processing audio" }));
//         });

//     // Use the stream method to obtain a stream from FFmpeg
//     const ffmpegStream = command.pipe();

//     ffmpegStream.on('data', (chunk) => {
//         // Send data chunks to the WebSocket client
//         if (ws.readyState === WebSocket.OPEN) {
//             ws.send(chunk);
//         }
//         console.log('Sent a chunk of PCM audio data to the WebSocket client');
//         // Also write the same chunk to the file
//         pcmFileWriteStream.write(chunk);
//     });

//     ffmpegStream.on('end', () => {
//         console.log('Finished streaming PCM audio to the WebSocket client and file');
//         // Close the file stream when done
//         pcmFileWriteStream.end();
//         // Notify the WebSocket client that streaming is finished
//         ws.send(JSON.stringify({ key: "server_state", value: "stream_finished" }));
//         ws.send(JSON.stringify({ key: "message", value: "PCM streaming finished" }));
//     });
// };

// / Function to convert AAC stream to PCM and send via WebSocket
// const convertAACtoPCMAndStream = (aacStream, ws) => {

//     // Delete the temp file if it exists
//     if (fs.existsSync(tempPCMFileName)) {
//         fs.unlinkSync(tempPCMFileName);
//     }


//     // Run FFmpeg
//     ffmpeg()
//         .input(audioFilePath)
//         .saveToFile(tempPCMFileName)

//     // Handle errors
//     // ffmpegProcess.stderr.on('data', (data) => {
//     //     console.error(`FFmpeg error: ${data}`);
//     // });

//     // Write AAC stream to FFmpeg stdin
//     // aacStream.pipe(ffmpegProcess.stdin);



//     // Wait for FFmpeg to finish
//     // ffmpegProcess2.on('close', (code) => {
//     //     console.log(`FFmpeg exited with code ${code}`);
//     //     // Here you can decide what to do with the temp file
//     //     // For example, read the file and send its contents to the WebSocket client
//     //     fs.readFile(tempPCMFileName, (err, data) => {
//     //         if (err) {
//     //             console.error('Error reading the temp PCM file:', err);
//     //             return;
//     //         }
//     //         // Example: Sending the file data or just informing the client that the file is ready
//     //         // ws.send(JSON.stringify({ key: "message", value: "PCM file ready", filePath: tempFilePath }));

//     //         // Optionally, clean up the temp file after use
//     //         // fs.unlink(tempPCMFileName, (err) => {
//     //         //     if (err) console.error('Error deleting temp file:', err);
//     //         //     else console.log('Temp PCM file deleted successfully');
//     //         // });
//     //     });
//     // });

//     //AUDIO IS WORKIGN! BUT HORRIBLE!
//     // Handle errors
//     // ffmpegProcess.stderr.on('data', (data) => {
//     //     console.error(`FFmpeg error: ${data}`);
//     // });

//     // Stream PCM data to WebSocket client
//     // ffmpegProcess.stdout.on('data', (chunk) => {
//     //     // ws.send(chunk); // Send PCM chunk directly
//     //     ws.send(chunk)
//     // });

//     // Write AAC stream to FFmpeg stdin
//     // aacStream.pipe(ffmpegProcess.stdin);

//     // aacStream.on('end', () => {
//     //     ffmpegProcess.stdin.end();
//     //     console.log('Finished streaming PCM audio to the WebSocket client');
//     //     // Optionally, send a message to the client indicating streaming is complete
//     //     ws.send(JSON.stringify({ key: "message", value: "PCM streaming finished" }));
//     // });

//     // aacStream.on('error', (error) => {
//     //     console.error('Stream error:', error);
//     //     ffmpegProcess.stdin.end();
//     //     ws.send(JSON.stringify({ key: "error", value: "Error streaming PCM audio" }));
//     // });
// };

// convertAACtoPCMAndStream(stream, ws);



// const simplePcmAudio = './public/uploads/simple_tts.pcm';

// ffmpeg()
//     .input(openAiAudioFilePath)
//     .saveToFile(simplePcmAudio)

// ffmpeg()
//     .input(openAiAudioFilePath)
//     .inputOptions(['-report'])
//      // Uncomment to generate a detailed FFmpeg report (Note: May need to set the FFREPORT environment variable)
//     .on('stderr', function (stderrLine) {
//         console.log('Stderr output: ' + stderrLine);
//     })
//     .on('end', function () {
//         console.log('File has been converted succesfully');
//     })
//     .on('error', function (err, stdout, stderr) {
//         console.log('Cannot process video: ' + err.message);
//         console.log('FFmpeg stderr: ' + stderr);
//     })
//     .saveToFile(simplePcmAudio);



        // Set the content type to audio/mpeg
        // res.setHeader('Content-Type', 'audio/mpeg');

        // Stream the audio from OpenAI's response to the client
        // response.data.pipe(res);

        // const stream = response.body as unknown as Readable;