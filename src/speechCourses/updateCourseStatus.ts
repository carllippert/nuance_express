import { createClient } from '@supabase/supabase-js';

export const updateCourseStatusIfReady = async (courseId: string) => {
    try {
        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        // Get all the assets for the course
        const { data: assets, error: assetError } = await supabase
            .from('speech_course_assets')
            .select('*')
            .eq('speech_course_id', courseId);

        if (assetError) {
            console.error('Error getting course assets:', assetError);
            throw assetError;
        }

        // If all assets are ready, update the course status
        if (assets && assets.length > 0 && assets.every(asset => asset.ready)) {
            console.log('All assets are ready for course. Updating Course Status:', courseId);

            let course_word_count = Math.round(assets.reduce((acc, message) => {
                return acc + (message.text.split(" ")).length;
            }, 0));

            let course_audio_duration_ms = 0;
            for (let asset of assets) {
                course_audio_duration_ms += asset.asset_duration_ms;
            }

            const course_audio_duration_seconds = Math.round(course_audio_duration_ms / 1000);
            const words_per_minute = Math.round(course_word_count / (course_audio_duration_ms / 60000));
            const words_per_second = Math.round(course_word_count / (course_audio_duration_ms / 1000));

            const { data: courseData, error: courseError } = await supabase
                .from('speech_courses')
                .update({
                    ready: true,
                    course_audio_duration_ms,
                    words_per_minute,
                    words_per_second,
                    course_word_count,
                    course_audio_duration_seconds
                })
                .eq('speech_course_id', courseId);

            if (courseError) {
                console.error('Error updating course status:', courseError);
                throw courseError;
            }
        } else {
            console.log('Not all assets are ready for course:', courseId);
        }

    }
    catch (error) {
        console.error('Error updating course status:', error);
        throw error;
    }
}
