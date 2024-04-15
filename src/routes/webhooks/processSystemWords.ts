import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
// import { addWords } from "../../words/words";
// import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import nlp from 'es-compromise'
import { OxfordData } from "../../types/oxford";
import { Context } from "./context";

type WordContext = {
    language: string;
    word_id: string;
    word_original_format: string;
    nlp_blob?: any;
    noun_points: number;
    root?: string;
    oxford_lemma?: string;
    oxford_lemma_blob?: OxfordData;
    capitalized: boolean;
}

type ProcessingContext = {
    root_words_from_comporomise: number;
    root_words_from_oxford: number;
    proper_nouns: number;
    no_root_or_lemma: number;
    root_but_no_lemma: number;
    root_but_no_lemma_words: string[];
    no_root_or_lemma_words: string[];
    word_pairs: { lemma: string, root: string }[];
}

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

        let processingContext = new Context<ProcessingContext>({
            root_words_from_comporomise: 0,
            root_words_from_oxford: 0,
            proper_nouns: 0,
            no_root_or_lemma: 0,
            root_but_no_lemma: 0,
            root_but_no_lemma_words: [],
            no_root_or_lemma_words: [],
            word_pairs: []
        });

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
            .limit(2) //TODO: change to 10 when ready

        if (error) throw new Error(error.message);

        let lemma_calls = [];

        data.forEach(async (word) => {

            const wordContext: WordContext = {
                language: word.language,
                word_id: word.word_id,
                word_original_format: word.word_original_format,
                noun_points: 0,
                capitalized: false
            };

            let capitalized = word.word_original_format[0] === word.word_original_format[0].toUpperCase();

            if (capitalized) {
                wordContext.noun_points += 1;
                wordContext.capitalized = true;
            }

            let doc = nlp(word.word_id);
            doc.compute('root'); // get lemma
            let json = doc.json();
            //check if "ProperNoun" exists in terms
            let properNoun = json[0].terms.find(term => term.tags.includes("ProperNoun"));
            // let noun = json[0].terms.find(term => term.tags.includes("Noun"));

            if (properNoun) {
                wordContext.noun_points += 1;
                // processingContext.proper_nouns += 1;
                processingContext.addValues({ proper_nouns: 1 });
            }

            // if (noun) {
            //     wordContext.noun_points += 1;
            // }

            //add root word to the word
            let root = json[0].terms[0].root;


            if (root != undefined) {
                wordContext.root = root;
                processingContext.addValues({ root_words_from_comporomise: 1 });
            }

            lemma_calls.push(getLemma(wordContext, processingContext));
        });

        let lemmas = await Promise.all(lemma_calls);

        // console.log("ProcessingContext: ", JSON.stringify(lemmas.processingContext, null, 2)

        console.log(processingContext.fetchContext());

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

const getLemma = async (word: WordContext, processingContext: Context<ProcessingContext>) => {

    //use root if we have it
    let word_text = word.root || word.word_id;

    const path =
        "/lemmas/" +
        word.language +
        "/" +
        word_text;

    console.log("Path -> " + path);

    // const options = {
    //     // host: "https://od-api.oxforddictionaries.com",
    //     port: "443",
    //     path,
    //     method: "GET",
    //     headers: {
    //         app_id: process.env.OXFORD_API_ID,
    //         app_key: process.env.OXFORD_API_KEY
    //     },
    // };

    try {
        const options = {
            host: "od-api.oxforddictionaries.com",
            port: "443",
            path,
            method: "GET",
            headers: {
                app_id: process.env.OXFORD_API_ID,
                app_key: process.env.OXFORD_API_KEY
            },
        };
        
        const resp = await fetch(`${oxford_base_url}${path}`, {
            method: options.method,
            headers: options.headers,
        });
        // const resp = await fetch(`${oxford_base_url}${path}`, {
        //     method: "GET",
        //     port: "443",
        //     headers: {
        //         app_id: process.env.OXFORD_API_ID,
        //         app_key: process.env.OXFORD_API_KEY
        //     },
        // });

        const body = await resp.text();



        console.log("BODY: ", body, null, 3);

        // const parsed: OxfordData = JSON.parse(body);

        // const lemmaWord = parsed.results?.[0]?.lexicalEntries?.[0]?.inflectionOf?.[0]?.text;

        // if (lemmaWord) {
        //     // const data = await getDefinition(language, lemmaWord);
        //     // processingContext.root_words_from_oxford += 1;
        //     processingContext.addValues({ root_words_from_oxford: 1 });
        //     word.oxford_lemma = lemmaWord;
        //     word.oxford_lemma_blob = parsed;
        //     // return word;
        // } else {
        //     if (word.root) {
        //         // processingContext.root_but_no_lemma += 1;
        //         processingContext.addValues({ root_but_no_lemma: 1, root_but_no_lemma_words: [word.word_id] });
        //         // processingContext.root_but_no_lemma_words.push(word.root);

        //     } else {
        //         // processingContext.no_root_or_lemma += 1;
        //         // processingContext.no_root_or_lemma_words.push(word.word_id);
        //         processingContext.addValues({ no_root_or_lemma: 1, no_root_or_lemma_words: [word.word_id] });
        //     }

        //     // proce.no_root_or_lemma += 1;
        //     console.log("Didnt grab lemma word for ...");
        //     console.log(JSON.stringify(body, null, 3));
        //     // return word;
        // }

        // processingContext.addValues({ word_pairs: [{ word: word.word_id, lemma: lemmaWord, root: word.root }] });

        console.log("Word: ", JSON.stringify(word, null, 2));
        return word;
    } catch (err) {
        console.log("Hit Error in get Lemma. => " + JSON.stringify(err));
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
