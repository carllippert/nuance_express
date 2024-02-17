import { v4 as uuid } from 'uuid';
import { createClient } from "@supabase/supabase-js";

export const requestCourse = async (
    duration_minutes: number,
    cefr: string,
    public_course: boolean,
    generate_immediately: boolean,
    requested_by: string = "SYSTEM"
) => {

    try {
        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //Create a "id for the speech practice" 
        const speech_course_id = uuid();
        const speech_course_generation_request_id = uuid();

        const { data, error } = await supabase
            .from('speech_course_generation_requests')
            .insert(
                {
                    speech_course_generation_request_id,
                    public_course,
                    requested_by,
                    duration_minutes,
                    generate_immediately,
                    cefr,
                    speech_course_id: speech_course_id,
                }
            )

        if (error) throw error;

        return { speech_course_id, speech_course_generation_request_id };

    } catch (error) {
        console.error('Error creating request for speech course:', error);
        throw error;
    }
}