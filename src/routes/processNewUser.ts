//TODO: when a user is first created add them to Loops


import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { createLoopsContactAndUpdateSupabase } from "../libs/loops";
import * as Sentry from "@sentry/node";

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
            .from("profiles")
            .select("*")
            .eq("added_to_external_email_system ", false)
            .order('created_at', { ascending: true })
            .limit(5)

        if (error) throw new Error(error.message);

        //Create users in Loops
        console.log("profile_data", data);

        let calls: Promise<any>[] = [];

        // Loop through profiles
        data.forEach((profile) => {
            calls.push(createLoopsContactAndUpdateSupabase(profile.id));
        });

        //Run all calls in parallel
        let result = await Promise.all(calls);

        res.status(200).send({ message: "External Emails Added to Loops", result });

    } catch (error) {
        console.log("Error creating contact in loops for new profiles", error);
        Sentry.captureMessage("Error creating contact in loops for new profiles");
        Sentry.captureException(error);
        throw error;
        res.status(500).send({ message: error.message });
    }
});

export default routes;
