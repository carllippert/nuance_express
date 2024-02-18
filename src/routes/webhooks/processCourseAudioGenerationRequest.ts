import { Router } from "express";
import * as Sentry from "@sentry/node";
import type { Payload } from "./supabase_webhook_types";
import { generateAudioForCourseMessage } from "../../speechCourses/generateAudioForCourseMessage";

const routes = Router();

routes.post("/", async (req, res) => {
    try {
        console.log("process-course-audio-generation body: ", req.body);

        let event: Payload = req.body;

        //signal webhook received
        res.status(200).send();

        // Defer the processing of the event to ensure immediate response
        setImmediate(async () => {
            // If the request is new and is a request to generate immediately, then generate the course
            if (event.type === 'INSERT' && event.table === 'speech_course_assets') {
                let row = event.record;
                try {
                    await generateAudioForCourseMessage(row);
                } catch (error) {
                    console.log("Error in audio generation", error);
                    Sentry.captureMessage("Error in audio generation");
                    Sentry.captureException(error);
                }
            }
        });

    } catch (error) {
        console.log("Error in audio webhook", error);
        Sentry.captureMessage("Error in audio webhook");
        Sentry.captureException(error);
    }
});

export default routes;
