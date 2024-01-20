import { createClient } from "@supabase/supabase-js";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

export type UserWords = {
  word_id: string;
  word_original_format: string;
  language: string;
  created_at: string;
  message_id: string;
  user_id: string;
};

export type SystemWords = {
  word_id: string;
  word_original_format: string; //keep original format for trying to figure out if its a name etc. 
  language: string;
  created_at: string;
};

export const addWords = async (
  user_id: string,
  message_id: string,
  message_created_at: string,
  spanishPhrase: string,
  language: string = "es"
) => {
  try {
    // Create a single supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    type word = { original_format: string; lower_case: string };

    let original_words = spanishPhrase.split(" ");

    let words: word[] = [];

    //TODO: Name detection -> keep the names in the database but don't use them in flashcards
    //We can use them to make better content because names make things more personal

    //remove punctuation but keep Spanish characters
    original_words = original_words.map((word) =>
      word.replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ]/g, "")
    );
    //remove empty strings
    original_words = original_words.filter((word) => word.trim() !== "");

    original_words.forEach((word) => {
      words.push({
        original_format: word,
        lower_case: word.toLowerCase(),
      })
    });

    const systemCalls: PostgrestFilterBuilder<any, any, null, unknown, unknown>[] = [];
    const userWords: UserWords[] = [];

    words.forEach((word) => {
      //Make individual calls to update "system_words"
      systemCalls.push(
        supabase.from("system_words").upsert({
          word_id: word.lower_case,
          word_original_format: word.original_format,
          language,
          created_at: message_created_at
        })
      );
      //Make array to bulk update "user_words"
      userWords.push({
        user_id,
        created_at: message_created_at, //so processing time is not used. Instead we use "utterance" time more or less
        word_id: word.lower_case,
        word_original_format: word.original_format,
        language,
        message_id,
      });
    });

    // Promise all the systemCalls and throw error if errors out
    const systemCallsResults = await Promise.all(systemCalls);
    const systemCallsErrors = systemCallsResults.filter((result) => result.error);
    if (systemCallsErrors.length > 0) {
      throw new Error("Error in systemCalls: " + systemCallsErrors.map((error) => error.error.message).join(", "));
    }

    //log each occurance. we will count stuff in sql
    const { data: user_words_data, error: user_words_error } = await supabase
      .from("user_words")
      .insert(userWords)
      .select();

    if (user_words_error) {
      throw new Error("Error in user_words: " + user_words_error.message);
    }

    //update supabase to say the "message_processed" and "message_processed_time"
    const { data: updateData, error: updateError } = await supabase
      .from("messages")
      .update({ message_processed: true, message_processed_time: new Date().toISOString() })
      .eq("id", message_id);

    if (updateError) {
      throw new Error("Error updating message_processed: " + updateError.message);
    }
  } catch (error) {
    throw new Error(error.message);
  }
};
