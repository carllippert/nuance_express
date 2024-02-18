import { tts_model, text_api_provider, audio_api_provider } from "./config";
import { convertTextToSpeech } from "./tts";
import { createClient } from "@supabase/supabase-js";
import { updateCourseStatusIfReady } from "./updateCourseStatus";

export type SpeechCourseAsset = {
    speech_course_asset_id: string;
    created_at: Date;
    speech_course_id: string;
    audio_url?: string | null;
    text: string;
    speaker_voice: string;
    tts_model?: string | null;
    llm?: string | null;
    prompt_details?: Record<string, any> | null;
    language: string;
    play_order: number;
    public_asset: boolean;
    storage_bucket?: string | null;
    speaker_name?: string | null;
    parent_asset_id?: string | null;
    pair_asset_id?: string | null;
    add_empty_space_after_playing: boolean;
    speaker_gender: string;
    asset_duration_ms?: number | null;
    audio_metadata?: Record<string, any> | null;
    ready: boolean;
    generation_priority_ranking: number;
}

export const generateAudioForCourseMessage = async (speechCourseAsset: SpeechCourseAsset) => {
    try {
        //generate audio    
        let audio = await convertTextToSpeech(speechCourseAsset.text, speechCourseAsset.speaker_voice);

        let asset_duration_ms = audio.metadata.format.duration * 1000;  //convert to milliseconds
        let audio_metadata = audio.metadata;

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        let speech_course_id = speechCourseAsset.speech_course_id;
        let asset_id = speechCourseAsset.speech_course_asset_id;
        let storage_bucket = speechCourseAsset.public_asset ? "public-audio" : "private-audio";

        if (asset_id === undefined ||
            speech_course_id === undefined
        ) throw new Error("asset_id or speech_course_id is undefined");

        //save audio to storage
        const { data, error } = await supabase
            .storage
            .from(storage_bucket)
            .upload(`${speech_course_id}/${asset_id}.mp3`, audio.buffer);

        if (error) {
            console.error('Error uploading audio to supabase:', error);
            throw error;
        }

        console.log("upload data", data);
        let audio_url = data.path;
        //save audio to supabase
        const { data: assetData, error: assetError } = await supabase
            .from('speech_course_assets')
            .update({
                speech_course_id,
                audio_url,
                tts_model,
                asset_duration_ms,
                audio_metadata,
                storage_bucket,
                text_api_provider,
                audio_api_provider,
                ready: true
            })
            .eq('speech_course_asset_id', asset_id);

        if (assetError) {
            console.error('Error saving audio to supabase:', assetError);
            throw assetError;
        }

        await updateCourseStatusIfReady(speech_course_id);

        return;
    }
    catch (error) {
        console.error('Error generating audio for course message:', error);
        throw error;
    }
}
