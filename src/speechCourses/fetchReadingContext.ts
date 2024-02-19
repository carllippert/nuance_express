import { UUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const fetchReadingContext = async (user_id: UUID) => {
    try {
        //fetch users reading activity for last 24 hours in supabase
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //fetch last 20 messages of reading activity
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("user_id", user_id)
            .eq("message_input_classification", "reading") //Don't grab questions from the user
            .eq("message_processed", true) //only messages we beleive are Spanish
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error("Error fetching reading context:", error);
            throw error;
        }

        // console.log("data", data);

        //loop through data and only return the "response_message_text"
        let response_messages = data.map((message: any) => {
            return message.response_message_text;
        });

        console.log("response_messages", response_messages);

        return response_messages.reverse();
    }
    catch (error) {
        console.error("Error fetching reading context:", error);
        throw error;
    }
}   
