const average_words_per_minute = 150;
const average_words_per_sentence = 8;

export const calculateLength = (requested_length_in_minutes: number) => {

    let requested_time_minus_user_speaking_space = requested_length_in_minutes / 2;

    let total_words_requested = requested_time_minus_user_speaking_space * average_words_per_minute;
    let total_words_in_english_requested = total_words_requested / 2;

    let requested_number_of_messages = total_words_in_english_requested / average_words_per_sentence;

    console.log("User rquested " + requested_length_in_minutes + " minutes of speech practice");
    console.log("This is " + total_words_requested + " words of speech practice");
    console.log("This is " + requested_number_of_messages + " messages of speech practice");

    let rounded_messages = Math.round(requested_number_of_messages);

    return rounded_messages;
}
