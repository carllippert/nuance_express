import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { addWords } from "../words/words";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

const routes = Router();

//Process webhooks from revenue cat
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
            .from("revenuecat_webhooks")
            .select("*")
            .eq("processed", false)
            .eq("skip", false)
            .eq("processing_error", false)
            .order('created_at', { ascending: true })
            .limit(2)

        console.log("data for processing webhook", data);

        if (error) throw new Error(error.message);

        //Create Words in "System"  
        let calls: Promise<any>[] = [];

        //send events in loops
        

        res.status(200).send({ message: "Messages Processed", data });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).send({ message: error.message });
    }
});

export default routes;
