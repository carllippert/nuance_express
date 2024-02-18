import { Router } from "express";

import { createAndSaveSpeechCourseText } from "../../../speechCourses/makeSpeechCourseText";

const routes = Router();

routes.get('/:minutes/:secret', async (req, res) => {
    try {
        const { minutes, secret } = req.params;
        console.log("Course params", req.params)

        if (!secret) throw new Error("No secret provided")
        if (!minutes) throw new Error("No minutes provided")

        let secretArg = "magic"
        if (secretArg !== secret) throw new Error("Invalid secret")

        let cefr = `A1`;
        let public_course = true;
        let speech_course_id = await createAndSaveSpeechCourseText(Number(minutes), cefr, public_course);

        res.status(200).send({ speech_couse_id: speech_course_id });
    } catch (error) {
        res.status(500).send(error);
    }
});

export default routes;