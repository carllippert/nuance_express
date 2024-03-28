import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
// import { addWords } from "../../words/words";
// import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import nlp from 'es-compromise'
import { OxfordData } from "../../types/oxford";

const routes = Router();

//Get words
//Get word translations
//Get word lemmas roots etc
//Get word definitions
//Score words
//Save words and definitions to the database

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
            .limit(10) //TODO: change to 10 when ready

        if (error) throw new Error(error.message);

        // let nouns = [];
        // let proper_nouns = [];
        // let non_proper_noun_nlp_blobs = [];

        let scored_words = [];

        let lemma_calls = [];

        data.forEach(async (word) => {
            let noun_points = 0;

            let capitalized = word.word_original_format[0] === word.word_original_format[0].toUpperCase();

            if (capitalized) {
                noun_points += 1;
            }

            // console.log("Word: ", word);
            let doc = nlp(word.word_id);
            doc.compute('root');
            doc.compute('machine')
            // doc.compute('penn');
            let json = doc.json();
            console.log("doc: ", JSON.stringify(json, null, 2));

            //check if "ProperNoun" exists in terms
            let properNoun = json[0].terms.find(term => term.tags.includes("ProperNoun"));
            let noun = json[0].terms.find(term => term.tags.includes("Noun"));

            if (properNoun) {
                noun_points += 1;
                // console.log("ProperNoun: ", JSON.stringify(properNoun, null, 2));
                // proper_nouns.push(properNoun);
                // proper_nounds.push(properNoun.text);
                // break;
            }

            if (noun) {
                noun_points += 1;
                // console.log("Noun: ", JSON.stringify(noun, null, 2));
                // nouns.push(noun);
            }

            //add root word to the word
            let root = json[0].terms[0].root;
            // console.log("Root: ", JSON.stringify(root, null, 2));

            // let scored = { ...json[0], noun_points, root: root.text };
            let scored: any = { noun_points, text: word.word_id, original_format: word.word_original_format };

            if (root != undefined) {
                scored.root = root;
            }

            // scored_words.push(scored);
            console.log("Scored Words: ", JSON.stringify(scored, null, 2));
            // {
            //     console.log("NOT ProperNoun: ", JSON.stringify(json[0], null, 2));
            //     non_proper_noun_nlp_blobs.push(json[0]);
            // }

            lemma_calls.push(getLemma("es", word.word_id));
        });

        let lemmas = await Promise.all(lemma_calls);

        // console.log("Lemmas: ", JSON.stringify(lemmas, null, 2));

        //Save proper nouns to the database as processed
        //Maybe double check they are proper nouns?

        //Search non proper nouns on oxford dictionary
        //get the lemmas / root words etc

        res.status(200).send({ message: "Words Processed", data });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).send({ message: error.message });
    }
});

let oxford_base_url = "https://od-api.oxforddictionaries.com/api/v2";

// Write a function to call the Oxford Dictionary API to fetch the definition of a provided word
const fetchDefinition = async (word: string) => {
    try {
        const response = await fetch(`${oxford_base_url}/entries/es/${word.toLowerCase()}`, {
            headers: {
                'app_id': 'YOUR_APP_ID',
                'app_key': 'YOUR_APP_KEY'
            }
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching definition:", error);
        return null;
    }
};


const define = async (word: string) => {
    try {
        const data = await getDefinition("es", word);
        if (data.error) {
            const lemmaData = await getDefinitionViaLemma("es", word);
            if (lemmaData.error) {
                throw lemmaData.error;
            } else {
                return lemmaData;
            }
        } else {
            return data;
        }
    } catch (e) {
        console.log("Error in define: ", e);
        throw e;
    }
};

const getDefinition = async (language: string, word: string) => {
    const fields = "definitions";
    const strictMatch = "false";
    const path =
        "/entries/" +
        language +
        "/" +
        word +
        "?fields=" +
        fields +
        "&strictMatch=" +
        strictMatch;

    console.log("Path -> " + path);

    const options = {
        host: "od-api.oxforddictionaries.com",
        port: "443",
        path,
        method: "GET",
        headers: {
            app_id: process.env.OXFORD_APP_ID,
            app_key: process.env.OXFORD_API_KEY
        },
    };

    try {
        const resp = await fetch(`${options.host}:${options.port}${options.path}`, {
            method: options.method,
            headers: options.headers,
        });
        const data = await resp.json();
        console.log("Response From GetIt" + JSON.stringify(data, null, 3));
        return data;
    } catch (err) {
        console.log("Hit Error in get Definition. => " + JSON.stringify(err));
        throw err;
    }
};

const getLemma = async (language: string, word: string) => {

    // const fields = "definitions";
    // const strictMatch = "false";
    const path =
        "/lemmas/" +
        language +
        "/" +
        word;

    console.log("Path -> " + path);

    const options = {
        // host: "https://od-api.oxforddictionaries.com",
        port: "443",
        path,
        method: "GET",
        headers: {
            app_id: process.env.OXFORD_API_ID,
            app_key: process.env.OXFORD_API_KEY
        },
    };

    try {
        const resp = await fetch(`${oxford_base_url}${options.path}`, {
            method: options.method,
            headers: options.headers,
        });
        const body = await resp.text();
        console.log(body, null, 3);
        const parsed: OxfordData = JSON.parse(body);

        const lemmaWord = parsed.results[0].lexicalEntries[0].inflectionOf?.[0].text;

        if (lemmaWord) {
            // const data = await getDefinition(language, lemmaWord);
            return lemmaWord;
        } else {
            console.log("Didnt grab lemma word...");
            throw new Error("No Inflection Found via Lemma");
        }
    } catch (err) {
        throw err;
    }
};


const getDefinitionViaLemma = async (languageBCP: string, word: string) => {
    console.log("Now Trying Lemmas since get defineition failed");

    const fields = "definitions";
    const strictMatch = "false";
    const path =
        "/lemmas/" +
        "es" +
        "/" +
        word;

    console.log("Path -> " + path);

    const options = {
        host: "od-api.oxforddictionaries.com",
        port: "443",
        path,
        method: "GET",
        headers: {
            app_id: process.env.OXFORD_APP_ID,
            app_key: process.env.OXFORD_API_KEY
        },
    };

    try {
        const resp = await fetch(`${options.host}:${options.port}${options.path}`, {
            method: options.method,
            headers: options.headers,
        });
        const body = await resp.text();
        console.log(body, null, 3);
        const parsed: OxfordData = JSON.parse(body);

        const lemmaWord = parsed.results[0].lexicalEntries[0].inflectionOf?.[0].text;

        if (lemmaWord) {
            const data = await getDefinition(languageBCP, lemmaWord);
            return data;
        } else {
            console.log("Didnt grab lemma word...");
            return "No Inflection Found via Lemma";
        }
    } catch (err) {
        throw err;
    }
};




export default routes;
