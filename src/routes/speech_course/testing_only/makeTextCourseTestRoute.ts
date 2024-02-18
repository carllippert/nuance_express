import { Router } from "express";
import { makeEnglishCourseText } from "../../../speechCourses/makeSpeechCourseText";

import TokenContext from "../../../utils/tokenContext";

const routes = Router();

routes.get('/:minutes/:cefr/:secret', async (req, res) => {
    try {
        const { minutes, secret, cefr } = req.params;
        console.log("Course params", req.params)

        if (!minutes) throw new Error("No minutes provided")
        if (!cefr) throw new Error("No cefr provided")
        if (!secret) throw new Error("No secret provided")

        let secretArg = "magic"
        if (secretArg !== secret) throw new Error("Invalid secret")

        let tokenContext = new TokenContext();

        let course = await makeEnglishCourseText(Number(minutes), cefr, tokenContext);

        res.status(200).send({ course, ...tokenContext.fetchContext() });
    } catch (error) {
        res.status(500).send(error);
    }
});

export default routes;