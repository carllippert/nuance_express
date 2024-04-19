import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import * as middleware from "../utils/middleware";

const routes = Router();

routes.post("/", middleware.authenticateToken, //JWT management
    async (req: middleware.RequestWithUserId, res) => {

        const { language, word } = req.params;

        console.log("web promo params", req.params)

        if (!language) throw new Error("No language provided");
        if (!word) throw new Error("No word provided");

        //fetched from jwt in middlewear
        let supabase_user_id = req.user_id;

        //TODO: fetch definition from  oxford api
        //use the write tools like scoring and lemmas to get the correct info

        //Mark the word that was search somewhere in DB so we know what words the user looked up as part of SRS 
        //implementation in future

        return {
            language,
            word,
            definition: "This is a test definition",
            root: "test",
            relatedWords: ["test", "testing", "tested"],
            relatedPhrases: ["test phrase", "testing phrase", "tested phrase"],
        };

        res.status(200).send({ message: "Hello World!" });
    });

export default routes;
