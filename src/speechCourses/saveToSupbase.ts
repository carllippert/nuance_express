import { createClient } from "@supabase/supabase-js";

import {
    tts_model,
    male_voice,
    female_voice,
    translation_prompt,
    llm_model
} from "./config";

export async function saveIndividualAudioAssets(speech_course_id, conversation) {
    try {

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //loop through convo and save audio to supabase storage and store audio url in ConverstaionMessage object
        await Promise.all(conversation.map(async (message, index) => {
            console.log("saving conversation message: ", index);
            const { data, error } = await supabase
                .storage
                .from('public-audio')
                .upload(`${speech_course_id}/${message.asset_id}.mp3`, message.audioBuffer);

            console.log("upload data", data);
            message.audioUrl = data.path;

            if (error) {
                console.log(error);
                throw error;
            }
        }));

        //TODO: do some postprocessing to avoid Jim: or Grace: in the message text
        //TOOD: add generation_priority_ranking: 1, //TODO: calculate this
        // loop through the convo and save the audio url and play order to the database
        const { data: assetData, error: assetError } = await supabase
            .from('speech_course_assets')
            .insert(conversation.map((message) => {
                return {
                    speech_course_id: speech_course_id,
                    audio_url: message.audioUrl,
                    play_order: message.play_order,
                    speaker_voice: message.gender === "M" ? male_voice : female_voice,
                    speaker_gender: message.gender,
                    text: message.text, language: message.language,
                    tts_model,
                    public_asset: true,
                    asset_duration_ms: message.metadata.format.duration * 1000, //convert to milliseconds
                    audio_metadata: message.metadata,
                    storage_bucket: "public-audio",
                    speaker_name: message.speaker,
                    parent_asset_id: message.parent_asset_id,
                    pair_asset_id: message.pair_asset_id,
                    add_empty_space_after_playing: true,
                    llm: llm_model,
                    prompt_details: { prompt: translation_prompt, }
                }
            }))

        if (assetError) {
            console.log(assetError);
            throw assetError;
        }

    } catch (error) {
        console.error('Error saving audio assets:', error);
        throw error;
    }
}
