import { createClient } from "@supabase/supabase-js";

import {
    male_voice,
    female_voice,
    translation_prompt,
    gpt3_turbo,
    text_api_provider,
    course_system_version
} from "../utils/config";

import { ConversationMessage } from "../utils/config";

import TokenContext from '../utils/tokenContext';

export const saveSpeechCourseText = async (
    speech_course_id: string,
    public_course: boolean,
    title: string,
    description: string,
    emoji: string,
    cefr: string,
    messages: ConversationMessage[],
    tokenContext: TokenContext
) => {
    try {
        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //Create course to have valid table relationship
        const { data, error } = await supabase
            .from('speech_courses')
            .insert(
                { speech_course_id: speech_course_id }
            )

        if (error) {
            console.log(error);
            throw error;
        }


        //TODO: do some postprocessing to avoid Jim: or Grace: in the message text
        //TOOD: add generation_priority_ranking: 1, //TODO: calculate this
        // loop through the convo and save the audio url and play order to the database

        //Save individual messages in asset table
        const { data: assetData, error: assetError } = await supabase
            .from('speech_course_assets')
            .insert(messages.map((message) => {
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
                    llm: gpt3_turbo,
                    text_api_provider,
                    prompt_details: { prompt: translation_prompt }
                }
            }))

        if (assetError) {
            console.log(assetError);
            throw assetError;
        }

        //Save generated data to base course we stubbed out earlier
        const { data: speech_course_data, error: speech_course_error } = await supabase
            .from('speech_courses')
            .update({
                public_course,
                course_system_version,
                ready: false,
                course_title: title,
                course_description: description,
                course_emoji: emoji,
                prompt_tokens: tokenContext.aggregate_prompt_tokens,
                total_tokens: tokenContext.aggregate_total_tokens,
                completion_tokens: tokenContext.aggregate_completion_tokens,
                cefr,
            })
            .eq('speech_course_id', speech_course_id)

        if (speech_course_error) {
            console.log(speech_course_error);
            throw speech_course_error;
        }
    }
    catch (error) {
        throw error;
    }
};