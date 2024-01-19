import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { addWords } from "../words/words";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

const routes = Router();

routes.get("/", async (req, res) => {
    try {
        console.log("process-message body: ", req.body);

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //Get messages that have not yet been processed
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("message_processed", false)
            .eq("message_input_classification", "reading")
            .eq("processing_skipped", false) //we havent already tried to process it
            .order('created_at', { ascending: true })
            .limit(10)

        if (error) throw new Error(error.message);

        //Create Words in "System"  
        let calls: Promise<any>[] = [];
        const skipped_calls: PostgrestFilterBuilder<any, any, null, unknown, unknown>[] = [];

        // Loop through messages
        console.log("data", data);

        data.forEach((message) => {

            //Evaluate the message on if we should actually beleive it is english
            //we have low confidence these are spanish words meant to go in the spanish word list
            if (message.user_input_machine_scoring.spanish_points < 2) {

                console.log("Spanish point < 2 -> Skipping");
                //Skip processing this message
                skipped_calls.push(supabase.from("messages").update({
                    processing_skipped: true,
                    processing_skipped_time: new Date().toISOString(),
                    processing_skipped_reason: "We think its not spanish even though its labeled as reading. Spanish point from our point system < 2"
                }).eq("id", message.id))

            } else {

                console.log("Spanish point >= 2 -> Processing -> real points: " + message.user_input_machine_scoring.spanish_points);
                console.log("spanish_points_type: " + typeof message.user_input_machine_scoring.spanish_points);

                calls.push(addWords(
                    message.user_id,
                    message.id,
                    message.created_at,
                    message.transcription_response_text
                ))
            }
        })

        //Run all calls in parallel
        await Promise.all(calls);
        await Promise.all(skipped_calls);

        res.status(200).send({ message: "Messages Processed", data });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).send({ message: error.message });
    }
});

export default routes;
