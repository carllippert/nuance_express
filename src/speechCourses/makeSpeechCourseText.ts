import { v4 as uuid } from 'uuid';

import { generateBaseCourseConversation } from "./generateConversation";
import { translateConversation } from "./translate";
import { saveSpeechCourseText } from './saveCourseText';
import { calculateLength } from './utils/calculateLength';

import TokenContext from '../utils/tokenContext';

export const makeEnglishCourseText = async (
    requested_length_in_minutes: number,
    cefr: string,
    tokenContext: TokenContext,
) => {
    try {

        //TODO: calculate what our target CEFR and length should be from some user data
        //TODO: calculate how to know in advance the rough audio length of a course
        //TODO: template user_prompt into a larger prompt to get usefull output

        let num_of_messages = calculateLength(requested_length_in_minutes);

        //prevent too long courses
        if (num_of_messages >= 150) {
            num_of_messages = 150;
        }

        let user_prompt =
        `Make me a conversation between two unique characters in the harry potter universe.
         The conversation should be ${num_of_messages} messages long
          with short sentences in english at a CEFR level of ${cefr}.

          The converstion should have a well defined beginning, middle and end.

          The length of the converstaion is VERY IMPORTANT. 

          We will be translating the converstaion into Spanish 
          and then generating audio from it so use simple language and words. 
          `

        let { conversation } = await generateBaseCourseConversation(user_prompt, num_of_messages,  tokenContext);

        //giving each message a UUID
        let messages = conversation.messages.map((message, index) => {
            return { ...message, asset_id: uuid(), language: "en" }
        })

        return {
            requested_messages: num_of_messages,
            messages_length: conversation.messages.length,
            title: conversation.title,
            description: conversation.description,
            emoji: conversation.emoji,
            cefr,
            messages,
        }

    } catch (error) {
        throw error;
    }
}

export const makeCourseText = async (
    requested_length_in_minutes: number,
    cefr: string,
    public_course: boolean,
    tokenContext: TokenContext,
    speech_course_id_arg?: string
) => {
    try {
        let speech_course_id = speech_course_id_arg || uuid();

        const {
            title,
            emoji,
            description,
            messages: english_messages
        } = await makeEnglishCourseText(requested_length_in_minutes, cefr, tokenContext);

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
