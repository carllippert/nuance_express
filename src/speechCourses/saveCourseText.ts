import { createClient } from "@supabase/supabase-js";

import {
    male_voice,
    female_voice,
    translation_prompt,
    llm_model,
    text_api_provider
} from "./config";

export async function saveCourseText(speech_course_id, conversation) {
    try {
        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //TODO: do some postprocessing to avoid Jim: or Grace: in the message text
        //TOOD: add generation_priority_ranking: 1, //TODO: calculate this
        // loop through the convo and save the audio url and play order to the database
        const { data: assetData, error: assetError } = await supabase
            .from('speech_course_assets')
            .insert(conversation.map((message) => {
                return {
                    speech_course_id: speech_course_id,
                    play_order: message.play_order,
                    speaker_voice: message.gender === "M" ? male_voice : female_voice,
                    speaker_gender: message.gender,
                    text: message.text, language: message.language,
                    public_asset: true,
                    ready: false,
                    // generation_priority_ranking: 1, //TODO: calculate this based on "immediately or not"
                    speaker_name: message.speaker,
                    parent_asset_id: message.parent_asset_id,
                    pair_asset_id: message.pair_asset_id,
                    add_empty_space_after_playing: true,
                    llm: llm_model,
                    text_api_provider,
                    prompt_details: { prompt: translation_prompt }
                }
            }))

        if (assetError) {
            console.log(assetError);
            throw assetError;
        }

        return assetData;

    } catch (error) {
        console.error('Error saving course text:', error);
        throw error;
    }
}