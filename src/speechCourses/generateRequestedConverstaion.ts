import { createClient } from "@supabase/supabase-js";
import { makeSpeechCourseText } from "./makeSpeechCourseText";

export const generateRequestedConversation = async (request_id: string) => {
    try {

        //Fetch request from supabase
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //set processing status on request
        const { data, error } = await supabase
            .from('speech_course_generation_requests')
            .update({ request_status: "PROCESSING" })
            .eq('speech_course_generation_request_id', request_id)
            .select();

        if (error) throw error;
        // speech_course_id 
        console.log('data:', JSON.stringify(data, null, 2));

        // let { duration_minutes, cefr, public_course } = data;
        let request = data[0];
        let duration_minutes = request.duration_minutes;
        let cefr = request.cefr;
        let public_course = request.public_course;
        let speech_course_id = request.speech_course_id;

        if (duration_minutes === undefined ||
            cefr === undefined ||
            public_course === undefined ||
            speech_course_id === undefined
        ) throw new Error("Request data is missing");

        //make the course from params in request
        let course = await makeSpeechCourseText(duration_minutes, cefr, public_course, speech_course_id);

        // save processing status on request
        return;

    } catch (error) {
        console.error('Error creating course from request:', error);
        throw error;
    }
}