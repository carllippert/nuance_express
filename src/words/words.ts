import { createClient } from "@supabase/supabase-js";

type UserWords = {
  word_id: string;
  language: string | null;
  message_id: string;
  user_id: string;
};

type SystemWords = {
  word_id: string;
  language: string | null;
};

export const addWords = async (
  user_id: string,
  message_id: string,
  spanishPhrase: string,
  language: string = "es"
) => {
  try {
    // Create a single supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    let words = spanishPhrase.split(" ");

    //TODO: Name detection -> keep the names in the database but don't use them in flashcards
    //We can use them to make better content because names make things more personal

    //remove punctuation but keep Spanish characters
    words = words.map((word) =>
      word.replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ]/g, "")
    );
    //remove empty strings
    words = words.filter((word) => word.trim() !== "");

    const systemWords: SystemWords[] = [];
    const userWords: UserWords[] = [];

    words.forEach((word) => {
      systemWords.push({
        word_id: word,
        language,
      });
      userWords.push({
        user_id,
        word_id: word,
        language,
        message_id,
      });
    });

    const { data: system_words_data, error: system_words_error } =
      await supabase.from("system_words").upsert(systemWords).select();

    if (system_words_error) {
      console.log("system_words_error:", system_words_error);
    }

    //log each occurance. we will count stuff in sql
    const { data: user_words_data, error: user_words_error } = await supabase
      .from("user_words")
      .insert(userWords)
      .select();

    if (user_words_error) {
      console.log("user_words_error:", user_words_error);
    }
  } catch (error) {
    console.log("error updating words:", error);
  }
};
