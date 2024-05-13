import WebSocket from "ws";
const VAD = require('node-vad');
import { transcribeAudio } from './transcribeAudio';
import { SHARED_TRANSCRIPTION_STATE, genStreamingSpeech, sendServerStateMessage } from "./streamingSpeech";
import { fetchCompletion } from "./translateAudio";

import { PostHog } from "posthog-node";

import {
    categorizeUserInput,
} from "../categorize/scoring";

import { createClient } from "@supabase/supabase-js";
import { applyHighPassFilter } from "./noiseSuppression";
import LogError from "../utils/errorLogger";

///Adjustments
let VAD_MODE = VAD.Mode.NORMAL
export const CLIENT_SENT_SAMPLE_RATE = 48000
const SPEECH_START_THRESHOLD = 10 // Number of consecutive speech detections needed to confirm start
const SPEECH_END_THRESHOLD = 10 // Number of consecutive speech detections needed to confirm end

const AUTO_PAUSE_THRESHOLD = 20000 // 20 seconds
const AUTO_CUTOFF_THRESHOLD = 60000 // 60 seconds
const HEARTBEAT_INTERVAL = 1000 * 10; // 5 seconds 
//Seems in bad connections this maybe gets drowned out by upstreaming data?
//failing while in argentina intermittently
const HEARTBEAT_VALUE = new Uint8Array([0]);

export const transcription_model = "whisper-1"
export const text_to_speech_model = 'tts-1'
export const llm_model = "gpt-3.5-turbo"

function ping(ws) {
    // Create a buffer with a single byte of value 0
    console.log("ping");
    ws.send(HEARTBEAT_VALUE, { binary: true });
}

export class WebSocketWithVAD {

    private isAlive = true;

    private vadProcessor = new VAD(VAD_MODE);

    ///for scoring the user start and stop of speech
    private notVoiceScore = 0; // Score to track silence occurrences
    private voiceScore = 0; // Score to track voice occurrences

    //flag for if we have decided the user is speaking
    private isUserSpeaking = false;

    //will use for auto pause system
    private firstChunkTime: Date = null;
    //Will use for auto cutoff system
    private firstVoiceChunkTime: Date = null;

    private audioBuffer: Buffer = Buffer.alloc(0);

    constructor(
        private ws: WebSocket,
        private user_id: string,
        private current_user_timezone: string,
        private current_seconds_from_gmt: string
    ) {
        this.setupWebSocket();
        this.setupHeartbeat();
    }

    private setupWebSocket(): void {
        this.ws.on("message", (message: WebSocket.Data) => {
            if (Buffer.isBuffer(message)) {
                // Check if the message is a pong
                if (message.length === 1 && message[0] === 0x00) {
                    console.log("Received pong");
                    this.isAlive = true;
                    // Handle pong (e.g., update heartbeat timestamp)
                } else {
                    // Process as audio chunk
                    this.processAudioChunk(message);
                }
            }
        });
    }

    private setupHeartbeat() {
        let interval = setInterval(() => {
            //connectino is dead ( we never received pong )
            if (!this.isAlive) {
                console.log("Terminating dead connection. No Pong received.");

                //Close gracefully and tell client to try again essentially
                this.ws.send(JSON.stringify({ key: "error", value: "4000" }));
                // We use code 4000 thouse but currently app reads it from above send not from actual close frame
                this.ws.close(4000, 'Connection was closed abnormally');
                /// 4000 is an open code https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.2
                return;
            }
            //set to false every time
            //gets turned true when the pong is received
            this.isAlive = false;
            ping(this.ws);
        }, HEARTBEAT_INTERVAL);

        this.ws.on('close', () => {
            clearInterval(interval);
        });
    }

    //zero minimum scores
    private addVoiceScore = () => {
        this.voiceScore = Math.max(this.voiceScore + 1, 0);
        this.notVoiceScore = Math.max(this.notVoiceScore - 1, 0);
        console.log("Voice Score: voice - " + this.voiceScore + ", notVoice - " + this.notVoiceScore);
    }

    //change this so that we just zero out silence score when we start speaking
    //removing teh flag for isUserSpeaking because it means we get "isUserSpeaking" just by accumulating random 
    //wins from voice being detected
    private addNotVoiceScore = () => {
        this.notVoiceScore = Math.max(this.notVoiceScore + 1, 0);
        this.voiceScore = Math.max(this.voiceScore - 1, 0);
        console.log("Voice Score: voice - " + this.voiceScore + ", notVoice - " + this.notVoiceScore);
    }

    private setUserIsSpeaking = () => {
        this.isUserSpeaking = true;
        this.firstVoiceChunkTime = new Date();
        //set counters back to zero when we notice user is speaking
        //Because now the score switches to determening when user has stopped speaking
        this.resetVoiceScores();
    }


    private resetVoiceScores = () => {
        this.notVoiceScore = 0;
        this.voiceScore = 0;
    }

    private resetVadState = () => {
        this.resetVoiceScores();
        this.isUserSpeaking = false;
        this.audioBuffer = Buffer.alloc(0);
        this.firstChunkTime = null;
        this.firstVoiceChunkTime = null;
    }

    private async processAudioChunk(audioChunk: Buffer): Promise<void> {
        console.log("Received audio chunk");

        this.ws.send(JSON.stringify({ key: "message", value: "Processing Audio Chunk" }));
        if (this.firstChunkTime == null) {
            this.firstChunkTime = new Date();
            console.log("Settig First Chunk Time:", this.firstChunkTime);
        }

        //Push unchanged audio always into the audiobuffer used fro transcribing
        this.audioBuffer = Buffer.concat([this.audioBuffer, audioChunk]);
        //Noise cancelling for things like airconditioning and machine humming
        let noiseSupppressedAudio = await applyHighPassFilter(audioChunk, 300);

        this.vadProcessor.processAudio(noiseSupppressedAudio, CLIENT_SENT_SAMPLE_RATE).then((res: any) => {
            switch (res) {
                case VAD.Event.VOICE:
                    this.ws.send(JSON.stringify({ key: "vad", value: "voice" }));
                    console.log("-- voice --");
                    this.addVoiceScore();

                    //if we have enough voice detections to confirm speech start
                    if (this.voiceScore > SPEECH_START_THRESHOLD && !this.isUserSpeaking) {
                        // Confirmed speech start
                        console.log("Confirmed speech start");
                        this.ws.send(JSON.stringify({ key: "message", value: "Confirmed Speech Start" }));
                        sendServerStateMessage(this.ws, SHARED_TRANSCRIPTION_STATE.VOICE_DETECTED);

                        this.setUserIsSpeaking();
                    }

                    //we have enough voice time to cutoff the user and do the work
                    if (this.isUserSpeaking && this.firstVoiceChunkTime != null && (Date.now() - this.firstVoiceChunkTime.getTime()) > AUTO_CUTOFF_THRESHOLD) {
                        console.log(`More than ${AUTO_CUTOFF_THRESHOLD / 1000} seconds have passed since the first voice audio chunk was received`);
                        console.log("Auto cuttoff for long content: " + this.firstVoiceChunkTime.toISOString());
                        this.ws.send(JSON.stringify({ key: "message", value: "Starting Transcription" }));
                        sendServerStateMessage(this.ws, SHARED_TRANSCRIPTION_STATE.TRANSCRIBING);
                        //transcribe and stream speech
                        this.transcribeAndStreamSpeech(this.audioBuffer, this.user_id).catch(console.error);
                        //reset state for next audio message
                        this.resetVadState();
                    }
                    break;
                case VAD.Event.NOISE:
                case VAD.Event.SILENCE:
                    const eventType = res === VAD.Event.NOISE ? "noise" : "silence";
                    console.log(`-- ${eventType} --`);
                    this.addNotVoiceScore()
                    this.ws.send(JSON.stringify({ key: "vad", value: eventType }));
                    //The Happy Path. We started then stopped speaking 
                    if (this.notVoiceScore > SPEECH_END_THRESHOLD && this.isUserSpeaking) {
                        this.ws.send(JSON.stringify({ key: "message", value: "Starting Transcription" }));
                        sendServerStateMessage(this.ws, SHARED_TRANSCRIPTION_STATE.TRANSCRIBING);
                        //transcribe and stream speech
                        this.transcribeAndStreamSpeech(this.audioBuffer, this.user_id).catch(console.error);
                        //reset state for next audio message
                        this.resetVadState();
                    }

                    //Auto Pause: We never started talking enough so we pause. 
                    if (this.firstChunkTime != null && (Date.now() - this.firstChunkTime.getTime()) > AUTO_PAUSE_THRESHOLD && !this.isUserSpeaking) {
                        console.log("More than 20 seconds have passed since the first audio chunk was received");
                        console.log("Auto pausing: " + this.firstChunkTime.toISOString());
                        //AUTO_PAUSE 
                        sendServerStateMessage(this.ws, SHARED_TRANSCRIPTION_STATE.AUTO_PAUSE);
                        this.resetVadState();
                    }
                    break;
                case VAD.Event.ERROR:
                    console.error("-- error --");
                    this.ws.send(JSON.stringify({ key: "vad", value: "error" }));
                    this.resetVadState();
                    break;
                default:
                    LogError(Error("Error or unknown VAD event"), "Error or unknown VAD event");
                    break;
            }
        }).catch((error: any) => {
            LogError(error, "Error processing audio");
            // this.ws.send(JSON.stringify({ key: "error", value: "Error processing audio" }));
            // this.resetVadState();
        });
    }

    private async transcribeAndStreamSpeech(audioData: Buffer, user_id: string): Promise<void> {
        try {

            const spanish_transcript: string = await transcribeAudio(audioData);

            if (spanish_transcript === "" || spanish_transcript === null || spanish_transcript === undefined) {
                //TODO: we don't want to save this to the DB
                //We do not want to translate it. 
                //We should just send the user a sorry message
                let user_message = "Oops. Sorry. We got confused by some noise. Just keep reading and avoid noisy areas if possible."

                genStreamingSpeech(user_message, this.ws, this.resetVadState);
                //"Oops sorry about that. Keep reading and we will try to transcribe again."
                try {
                    const posthog = new PostHog(process.env.POSTHOG_API_KEY || "")

                    posthog.capture({
                        distinctId: user_id.toUpperCase(),
                        event: "empty_transcription",
                        properties: {
                            message_input_classification: "reading",
                            message_input_classifier: "none",  //in future maybe it can be automatic  with AI
                            transcription_model,
                        },
                    });

                } catch (error: any) {
                    LogError(error, "Error in posthog event capture");
                }

            } else {

                const english_transcript: string = await fetchCompletion(spanish_transcript)
                console.log("Transcription:", spanish_transcript);

                this.ws.send(JSON.stringify({
                    key: "transcription",
                    value: english_transcript,
                    key2: "es",
                    value2: spanish_transcript
                }));

                genStreamingSpeech(english_transcript, this.ws, this.resetVadState);

                try {
                    //save to DB and analytics 
                    //is it english or spanish?
                    let user_input_machine_scoring = await categorizeUserInput(spanish_transcript);

                    //langauge detection on our output
                    let application_response_machine_scoring = await categorizeUserInput(
                        english_transcript,
                    );

                    // Create a single supabase client
                    const supabase = createClient(
                        process.env.SUPABASE_URL || "",
                        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
                    );

                    //persist to supabase
                    const { data: insertData, error: insertError } = await supabase
                        .from("messages")
                        .insert([
                            {
                                message_input_classification: "reading",
                                message_input_classifier: "none",
                                user_id,
                                response_message_text: english_transcript,
                                transcription_response_text: spanish_transcript,
                                current_seconds_from_gmt: Number(this.current_seconds_from_gmt),
                                current_user_timezone: this.current_user_timezone,
                                user_input_machine_scoring,
                                application_response_machine_scoring,
                            },
                        ])
                        .select();

                    if (insertError) {
                        LogError(insertError, "Error in message persistance");
                    }

                } catch (error: any) {
                    LogError(error, "Error in message persistance");
                }

                try {
                    const posthog = new PostHog(process.env.POSTHOG_API_KEY || "")

                    posthog.capture({
                        distinctId: user_id.toUpperCase(),
                        event: "server_generated_message_content",
                        properties: {
                            message_input_classification: "reading",
                            message_input_classifier: "none",
                            transcription_model,
                            text_to_speech_model,
                            llm_model,
                            response_message_text: english_transcript,
                            transcription_response_text: spanish_transcript,
                        },
                    });

                } catch (error: any) {
                    LogError(error, "Error in posthog event capture");
                }
            }

        } catch (error) {
            LogError(error, "Error transcribing audio");
            this.ws.send(JSON.stringify({ key: "error", value: "Error transcribing audio" }));
        }
    }

}