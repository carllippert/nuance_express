import { Router } from "express";
import * as Sentry from "@sentry/node";
import type { Payload } from "./supabase_webhook_types";
import { generateRequestConversation } from "../../speechCourses/generateRequestConversation";

const routes = Router();

//docs for supabase webhooks 
//https://supabase.com/docs/guides/database/webhooks

routes.post("/", async (req, res) => {
    try {
        console.log("process-speech-course-generation-request body: ", req.body);

        let event: Payload = req.body;

        //If the request is new and is a request to generate immediately, then generate the course
        if (event.type === 'INSERT' && event.table === 'speech_course_generation_requests') {
            let row = event.record;
            let generate_immediately = row.generate_immediately;
            let speech_course_generation_request_id = row.speech_course_generation_request_id;

            if (generate_immediately && speech_course_generation_request_id) {
                //generate the course
                await generateRequestConversation(speech_course_generation_request_id);
            }
        }

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
