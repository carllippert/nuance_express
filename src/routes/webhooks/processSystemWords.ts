import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
// import { addWords } from "../../words/words";
// import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import nlp from 'es-compromise'

const routes = Router();

routes.get("/", async (req, res) => {
    try {
        console.log("process-system_words body: ", req.body);

        // Create a single supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //Get words that have not been processed
        const { data, error } = await supabase
            .from("system_words")
            .select("*")
            .eq("processing_status", "NEW")
            .order('created_at', { ascending: true })
            .limit(100) //TODO: change to 10 when ready

        if (error) throw new Error(error.message);

        data.forEach(async (word) => {
            // console.log("Word: ", word);
            let doc = nlp(word.word_id);
            let json = doc.json();
            console.log(JSON.stringify(json[0].terms, null, 2));

            let doc2 = nlp(word.word_id);
            doc2.compute('root')
            // retrieve them from .json() response
            console.log("root: ", doc.json()[0].terms.map(t => t.root || t.normal))
        });

        res.status(200).send({ message: "Words Processed", data });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).send({ message: error.message });
    }
});

export default routes;
