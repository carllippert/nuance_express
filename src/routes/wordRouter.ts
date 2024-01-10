import { Router } from "express";
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


  
const routes = Router();

routes.get("/:user_id", async (req, res) => {
    const user_id = req.params.user_id;

    if (!user_id) throw new Error("No file uploaded");
    await idempotentAddWords(user_id);

    res.status(200).send({ message: "Hello World!" });
});

const idempotentAddWords = async (user_id: string) => {
    try {
        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || "");

        //fetch "unprocessed" messages
        const { data: messages, error: messages_error } =
            await supabase
                .from("messages")
                .select("*")
                .eq("user_id", user_id)
                .eq("words_processed", false)
                .limit(5);  

        if (messages_error) {
            console.log("messages_error:", messages_error);
            return messages_error;
        }

        if (!messages) {
            console.log("No messages found");
            return;
        }

        console.log("messages:", messages);

        //for each message
      


        //add to system words
        //add to user words
        //deal with language



    } catch (error) {
        console.log("error:", error);
        return error;
    }
}

export default routes;
