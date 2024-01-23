import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/node";

const routes = Router();

routes.post("/", async (req, res) => {
    try {
        console.log("process-auth body: ", req.body);

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //TODO: create two events to send to loops
        // -> "Sign up",
        //     -> "email_confirmed",
            // "email_confirmed_at" => equals email confirmed -> "app_email_confirmed"
            // "email_confirmed_at" => is null but user exists -> "app_sign_up"
            // also make these posthog events maybe?
            // If i do it on this end need to do it less on front end in different locations

            // //Get messages that have not yet been processed
            // const { data, error } = await supabase
            //     .from("profiles")
            //     .select("*")
            //     .eq("added_to_external_email_system ", false)
            //     .order('created_at', { ascending: true })
            //     .limit(5)

            // if (error) throw new Error(error.message);

            // //Create users in Loops
            // console.log("profile_data", data);

            // let calls: Promise<any>[] = [];

            // // Loop through profiles
            // data.forEach((profile) => {
            //     calls.push(createLoopsContactAndUpdateSupabase(profile.id));
            // });

            // //Run all calls in parallel
            // let result = await Promise.all(calls);

            res.status(200).send();

    } catch (error) {
        console.log("Error managing auth change for supabase user to send event to loops", error);
        Sentry.captureMessage("Error managing auth change for supabase user to send event to loops");
        Sentry.captureException(error);
        // throw error;
        res.status(500).send({ message: error.message });
    }
});

export default routes;
