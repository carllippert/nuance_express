import { v4 as uuid } from 'uuid';

import { generateBaseCourseConversation } from "./generateConversation";
import { translateConversation } from "./translate";
import { saveSpeechCourseText } from './saveCourseText';
import { calculateLength } from './utils/calculateLength';

import TokenContext from '../utils/tokenContext';
import { ConversationFromGPT, default_course_creation_system_prompt, default_course_creation_user_prompt } from './utils/config';

export const makeCourseText = async (
    requested_length_in_minutes: number,
    cefr: string,
    public_course: boolean,
    tokenContext: TokenContext,
    speech_course_id_arg?: string
) => {
    try {
        let speech_course_id = speech_course_id_arg || uuid();

        let { emoji, description, messages: english_messages, title }: ConversationFromGPT = await generateBaseCourseConversation(default_course_creation_user_prompt, default_course_creation_system_prompt, tokenContext);

        // loop through the convo and translate all the message. 
        const { messages } = await translateConversation(english_messages, tokenContext);

        return {
            speech_course_id,
            public_course,
            title,
            description,
            emoji,
            cefr,
            messages,
        }

    } catch (error) {
        throw error;
    }
};


export const createAndSaveSpeechCourseText = async (
    requested_length_in_minutes: number,
    cefr: string,
    public_course: boolean,
    speech_course_id_arg?: string
) => {
    try {

        const tokenContext = new TokenContext();

        const {
            speech_course_id,
            title,
            description,
            emoji,
            messages,
        } = await makeCourseText(
            requested_length_in_minutes,
            cefr,
            public_course,
            tokenContext,
            speech_course_id_arg,
        );

        await saveSpeechCourseText(
            speech_course_id,
            public_course,
            title,
            description,
            emoji,
            cefr,
            messages,
            tokenContext
        );

        return speech_course_id;

    } catch (error) {
        throw error;
    }
};
