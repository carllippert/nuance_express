import { v4 as uuid } from 'uuid';
import { createClient } from "@supabase/supabase-js";

import { generateConversation } from "./generateConversation";
import { translateConversation } from "./translate";
// import { saveIndividualAudioAssets } from "./saveToSupbase";
// import { createAudio } from "./tts"
import { saveCourseText } from './saveCourseText';

const average_words_per_minute = 150;
const average_words_per_sentence = 8;

export const makeSpeechCourseText = async (
    requested_length_in_minutes: number,
    cefr: string,
    public_course: boolean
) => {
    try {
        //Create a "id for the speech practice"
        const speech_course_id = uuid();

        let aggregate_prompt_tokens = 0;
        let aggregate_total_tokens = 0;
        let aggregate_completion_tokens = 0;

        //TODO: calculate what our target CEFR and length should be from some user data
        //TODO: calculate how to know in advance the rough audio length of a course
        //TODO: template user_prompt into a larger prompt to get usefull output

        let requested_time_minus_user_speaking_space = requested_length_in_minutes / 2;

        let total_words_requested = requested_time_minus_user_speaking_space * average_words_per_minute;
        let total_words_in_english_requested = total_words_requested / 2;

        let requested_number_of_messages = total_words_in_english_requested / average_words_per_sentence;

        console.log("User rquested " + requested_length_in_minutes + " minutes of speech practice");
        console.log("This is " + total_words_requested + " words of speech practice");
        console.log("This is " + requested_number_of_messages + " messages of speech practice");

        // -> about 150 words per minute
        // -> we double the words because we do english and spanish
        // -> then take the time of the lesson we want and divide by 2 ( half space for user )

        let rounded_messages = Math.round(requested_number_of_messages);

        let user_prompt = `Make me a conversation between two unique characters in the harry potter universe.
         The conversation should be ${rounded_messages} messages long with short sentences in english at a CEFR level of ${cefr}.`

        //TODO: allow passing in of speech_course_id in_case its an immediate request from client
        //If client passes the ID we can then manage coredata on return because we know course id in advance

        let { conversation, prompt_tokens, total_tokens, completion_tokens } = await generateConversation(user_prompt);

        //Count tokens form generating the convo
        aggregate_prompt_tokens += prompt_tokens;
        aggregate_total_tokens += total_tokens;
        aggregate_completion_tokens += completion_tokens;

        console.log("prompt_tokens", prompt_tokens);
        console.log("total_tokens", total_tokens);
        console.log("completion_tokens", completion_tokens);

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        // //Create Speach course in supabase
        const { data, error } = await supabase
            .from('speech_courses')
            .insert(
                { speech_course_id: speech_course_id }
            )

        if (error) {
            console.log(error);
            throw error;
        }

        //giving each message a UUID
        let convo = conversation.messages.map((message, index) => {
            return { ...message, asset_id: uuid(), language: "en" }
        })

        // loop through the convo and translate all the message. 
        const translated_conversation = await translateConversation(convo);

        console.log(translated_conversation);

        //count tokens fpr work done translating
        aggregate_prompt_tokens += translated_conversation.prompt_tokens;
        aggregate_total_tokens += translated_conversation.total_tokens;
        aggregate_completion_tokens += translated_conversation.completion_tokens;

        //TODO: add back after we have tested some of the other stuff
        //loop through the convo 
        ////////////////////////////////////////////////////////////////////// 
        ////// BIG REFACTOR //////////
        ////////////////////////////////////////////////////////////////////////////////////////////////
        //TODO: refactor this out into a processing job because our rate limit is 100 Requests Per Minute

        //Save individual messages
        await saveCourseText(speech_course_id, translated_conversation.messages);
        // const audioConversation: ConversationMessage[] = await createAudio(translated_conversation.messages);

        // await saveIndividualAudioAssets(speech_course_id, audioConversation);

        //Calculate total duration of the audio
        // let course_duration_ms = audioConversation.reduce((acc, message) => {
        //     return acc + (message.metadata.format.duration * 1000); //convert to milliseconds
        // }, 0);

        //calculate course duration in minutes
        // let course_duration_seconds = Math.round(course_duration_ms / 1000);

        let course_words = Math.round(translated_conversation.messages.reduce((acc, message) => {
            return acc + (message.text.split(" ")).length;
        }, 0));

        // const words_per_minute = Math.round(course_words / (course_duration_ms / 60000));
        // const words_per_second = Math.round(course_words / (course_duration_ms / 1000));

        // //save url to storage object in speeh_course table
        const { data: speech_course_data, error: speech_course_error } = await supabase
            .from('speech_courses')
            .update({
                public_course,
                ready: true,
                course_title: conversation.title,
                course_description: conversation.description,
                course_emoji: conversation.emoji,
                prompt_tokens: aggregate_prompt_tokens,
                total_tokens: aggregate_total_tokens,
                completion_tokens: aggregate_completion_tokens,
                cefr,

                // course_duration_ms,
                // words_per_minute,
                // words_per_second,
                course_word_count: course_words,
                // course_duration_seconds
            })
            .eq('speech_course_id', speech_course_id)

        if (speech_course_error) {
            console.log(speech_course_error);
            throw speech_course_error;
        }

        return speech_course_id;

    } catch (error) {
        throw error;
    }
};

export default makeSpeechCourseText