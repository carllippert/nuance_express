import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { sendEventToLoopsAndUpdateSupabase } from "../libs/sendEvents";

const routes = Router();

//Process webhooks from revenue cat
routes.post("/", async (req, res) => {
    try {
        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //Get messages that have not yet been processed
        const { data, error } = await supabase
            .from("revenuecat_webhooks")
            .select("*")
            .eq("processed", false)
            .eq("skipped", false)
            .eq("processing_error", false)
            .order('created_at', { ascending: true })
            .limit(2)

        console.log("data for processing webhook", data);

        if (error) throw new Error(error.message);

        let calls: Promise<any>[] = [];

        //send events in loops
        data.forEach((revcat_event) => {

            //Parse and send events that matter
            let event_type = revcat_event.event_payload.event.type;
            let event_id = revcat_event.revenuecat_event_id;
            let user_id = revcat_event.user_id;
            

            let formatted_event_type = `revcat_${event_type.toLowerCase()}`;

            calls.push(sendEventToLoopsAndUpdateSupabase(user_id, event_id, formatted_event_type, revcat_event.event_payload.event.environment))
        })

        //Run all calls in parallel
        let result = await Promise.all(calls);

        res.status(200).send({ message: "Messages Processed", data });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).send({ message: error.message });
    }
});

export default routes;
