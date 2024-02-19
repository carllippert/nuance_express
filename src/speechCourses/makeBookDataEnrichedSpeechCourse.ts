
import TokenContext from '../utils/tokenContext';
import { fetchReadingContext } from './fetchReadingContext';
import { generateBaseCourseConversation } from './generateConversation';
import { calculateLength } from './utils/calculateLength';
import { getBookVibes } from './vibes/getBookVibes';

export const makeBookDataEnrichedSpeechCourse = async (
    requested_length_in_minutes: number,
    cefr: string,
    tokenContext: TokenContext
) => {
    //fetch book data from users
    //Hard coded to carl for testing

    let book_data = await fetchReadingContext("f1f14a10-dfa5-470c-b01c-ac6a533cd453");


    let book_vibes = await getBookVibes(book_data, tokenContext);

    // console.log("book_vibes", book_vibes)

    //make it into a prompt
    // let user_prompt = "Write me a story";
    // let system_prompt = "Im a teacher, I know a lot about books. I can help you write a story."

    let num_of_messages = calculateLength(requested_length_in_minutes);

    // let user_prompt = `
    //     Make a conversation with this book content provided below in backets below as inspiration. 
    //     Use it to pick th scene and the characters but do not make an exact copy. Write it like fanfiction.

    //     <book data>
    //     ${book_data.join('\n')}
    //     </book data>

    //     The conversation should be ${num_of_messages} messages long 
    //     with short sentences in english at a CEFR level of ${cefr}.

    //     The converstion should have a well defined beginning, middle and end.

    //     Do not make it shorter than asked!
    // `

    let user_prompt = "Make me todays course"

    console.log("user_prompt", user_prompt)

    let system_prompt = `You are an excellent spanish teacher with in depth knowledge of CEFR standards.
    Your job is to create a conversation between two people ( give them names ) for a language learning course.

    The conversation should be ${num_of_messages} messages long and be at a CEFR level of ${cefr}.

    You have been given the users most recent reading activity to use as inspiration.
    Do not copy book content but use it to pick the scene and the characters.

    The converstion should have a well defined beginning, middle and end.

    Do not make it shorter than asked!

    <book data>
    ${book_data.join('\n')}
    </book data>
    `

    console.log("system_prompt", system_prompt)

    //make a conversation
    let res = await generateBaseCourseConversation(user_prompt, system_prompt, tokenContext);

    //Send the convo
    return { requested_messages: num_of_messages, messages: res.messages.length, book_vibes, conversation: res, }
}
