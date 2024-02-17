import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/node";

const routes = Router();

//sample webhook events from revenue cat
// https://www.revenuecat.com/docs/sample-events

routes.post("/", async (req, res) => {
    try {

        console.log(req.body);

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        // double check we have a user_id ( revenuecat in some cases may create random id's)
        //$RCAnonymousID
        let user_id = req.body.event.original_app_user_id;
        let is_anon_id = false;
        let revenuecat_event_id = req.body.event.id;

        // flag user id as "anon_id" if prefixed with $RCAnonymousID
        if (user_id.startsWith("$RCAnonymousID")) {
            is_anon_id = true;
        }

        let insertBlob = {
            event_payload: req.body,
            revenuecat_event_id,
            is_anon_id,
        }

        if (!is_anon_id) {
            insertBlob["user_id"] = user_id
        }

        console.log("insert into supabase", insertBlob);

        const { data: insertedData, error: insertionError } = await supabase
            .from("revenuecat_webhooks")
            .insert(insertBlob)

        if (insertionError) {
            console.log("Error inserting revenuecat_webhooks into supabase", insertionError);
            // Capture error in Sentry
            Sentry.captureMessage("Error inserting revenuecat_webhooks into supabase");
            Sentry.captureException(insertionError);
        }

        //send success to revenue cat
        res.status(200).send();

    } catch (error) {
        console.log("Error:", error);
        res.status(500).send({ message: error.message });
    }
});

export default routes;
