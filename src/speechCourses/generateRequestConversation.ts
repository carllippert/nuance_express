import { createClient } from "@supabase/supabase-js";
import { makeSpeechCourseText } from "./makeSpeechCourseText";

export const generateRequestConversation = async (requst_id: string) => {
    try {

        //Fetch request from supabase
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //set processing status on request
        const { data, error }: { data: any, error: any } = await supabase
            .from('speech_course_generation_requests')
            .update({ request_status: "PROCESSING" })
            .eq('speech_course_generation_request_id', requst_id)
            .single()

        if (error) throw error;

        let { duration_minutes, cefr, public_course } = data;

        if (duration_minutes === undefined ||
            cefr === undefined ||
            public_course === undefined
        ) throw new Error("Request data is missing");

        //make the course from params in request
        let course = await makeSpeechCourseText(duration_minutes, cefr, public_course);

        // save processing status on request
        return;

    } catch (error) {
        console.error('Error creating course from request:', error);
        throw error;
    }
}
