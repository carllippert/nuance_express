
import TokenContext from '../utils/tokenContext';
import { fetchReadingContext } from './fetchReadingContext';
import { generateBaseCourseConversation } from './generateConversation';
import { calculateLength } from './utils/calculateLength';

export const makeBookDataEnrichedSpeechCourse = async (
    requested_length_in_minutes: number,
    cefr: string,
    tokenContext: TokenContext
) => {
    //fetch book data from users
    //Hard coded to carl for testing
    let book_data = await fetchReadingContext("f1f14a10-dfa5-470c-b01c-ac6a533cd453");
    //make it into a prompt
    // let user_prompt = "Write me a story";
    // let system_prompt = "Im a teacher, I know a lot about books. I can help you write a story."

    let num_of_messages = calculateLength(requested_length_in_minutes);

    let user_prompt = `
        Make a conversation based on this book content provided in backets below.

        <book data>
        ${book_data}
        </book data>

        The conversation should be ${num_of_messages} messages long 
        with short sentences in english at a CEFR level of ${cefr}.

        The converstion should have a well defined beginning, middle and end.

        Do not make it shorter than asked!
    `

    console.log("user_prompt", user_prompt)


    //`Make me a conversation between two unique characters in the harry potter universe.
    // The conversation should be ${num_of_messages} messages long
    // with short sentences in english at a CEFR level of ${cefr}.

    // The converstion should have a well defined beginning, middle and end.

    // The length of the converstaion is VERY IMPORTANT. 

    // We will be translating the converstaion into Spanish 
    // and then generating audio from it so use simple language and words. 
    // `

    let system_prompt = `You are an excellent spanish teacher with in depth knowledge of CEFR standards.`

    //make a conversation
    let res = await generateBaseCourseConversation(user_prompt, system_prompt, num_of_messages, tokenContext);

    //Send the convo
    return res;
}
