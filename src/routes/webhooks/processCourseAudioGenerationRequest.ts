import { Router } from "express";
import * as Sentry from "@sentry/node";
import type { Payload } from "./supabase_webhook_types";
// import { generateAudioForCourseMessage } from "../../speechCourses/generateAudioForCourseMessage";

const routes = Router();

routes.post("/", async (req, res) => {
    try {
        console.log("process-course-audio-generation body: ", req.body);

        let event: Payload = req.body;

        //If the request is new and is a request to generate immediately, then generate the course
        // if (event.type === 'INSERT' && event.table === 'speech_course_assets') {
        //     let row = event.record;
        //     // await generateAudioForCourseMessage(row);
        // }

        res.status(200).send();

    } catch (error) {
        console.log("Error creating audio assets for course", error);
        Sentry.captureMessage("Error creating audio assets for course");
        Sentry.captureException(error);
        // throw error;
        res.status(500).send({ message: error.message });
    }
});

export default routes;
