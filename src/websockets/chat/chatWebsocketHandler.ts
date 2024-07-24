import { transcribeAudio } from '../reading/transcribeAudio';
import { genStreamingSpeech } from "../reading/streamingSpeech";
import { fetchCompletion } from "../reading/translateAudio";

import { PostHog } from "posthog-node";

import {
    categorizeUserInput,
} from "../../categorize/scoring";

import { createClient } from "@supabase/supabase-js";

import LogError from "../../utils/errorLogger";
import { BaseWebsocketHandler } from "../utils/scoringVad";

export const CLIENT_SENT_SAMPLE_RATE = 48000

export const transcription_model = "whisper-1"
export const text_to_speech_model = 'tts-1'
export const llm_model = "gpt-3.5-turbo"


export class ChatWebsocketHandler extends BaseWebsocketHandler {
    protected async processUserAudio(audioData: Buffer, user_id: string): Promise<void> {
        try {

            const spanish_transcript: string = await transcribeAudio(audioData);

            if (spanish_transcript === "" || spanish_transcript === null || spanish_transcript === undefined) {
                //TODO: we don't want to save this to the DB
                //We do not want to translate it. 
                //We should just send the user a sorry message
                let user_message = "Oops. Sorry. We got confused by some noise. Just keep reading and avoid noisy areas if possible."

                genStreamingSpeech(user_message, this.ws, this.resetVadState.bind(this));
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

                genStreamingSpeech(english_transcript, this.ws, this.resetVadState.bind(this));

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