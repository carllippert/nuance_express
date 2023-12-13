import OpenAI from "openai";
import { Language } from "node-nlp";

import { CURRENT_CAT_PROMPT } from "./prompts/categorizerPrompt";
import { detect, detectAll } from "tinyld";

export const categorizeUserInput = async (
  transcription: string
): Promise<any> => {
  try {
    //NLP.js
    const language = new Language(); //NLP.js

    //is it spanish or english?
    let transcriptionGuess = language.guess(transcription, ["en", "es"]);

    console.log("Guessing Transcription Language => ", transcriptionGuess);

    let nlp_js_language = transcriptionGuess[0].alpha2;
    let nlp_js_confidence = transcriptionGuess[0].score;
    //TinyLD
    let tinyld_language = await detect(transcription);
    let tinyld_all_languages = await detectAll(transcription);

    //OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });
    //TODO: the biggest goal is to prevent accidentally adding words to the users "learned words"
    //that are the wrong language. So we need to be very confident that the user is speaking
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: CURRENT_CAT_PROMPT.system_prompt },
        { role: "user", content: transcription },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "detect_user_language",
            description:
              "Does different work depending on wether the user is speaking in spanish or english",
            parameters: {
              type: "object",
              properties: {
                isSpanish: {
                  type: "boolean",
                  description: "True if the user is speaking in Spanish.",
                },
                confidence: {
                  type: "number",
                  description: "The confidence of the model in its labeling.",
                },
              },
              required: ["isSpanish", "confidence"],
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "detect_user_language" },
      },
    });

    console.log("categories response => ", JSON.stringify(response, null, 3));

    let args = response.choices[0].message?.tool_calls[0]?.function.arguments;
    let parsedArgs = JSON.parse(args);

    console.log(parsedArgs);

    let gpt3_isSpanish = parsedArgs.isSpanish;
    let gpt3_isSpanish_confidence = parsedArgs.confidence;
    let gpt3_prompt_verison_id = CURRENT_CAT_PROMPT.version_id;
    let spanish_points = 0;
    let english_points = 0;

    if (gpt3_isSpanish) {
      spanish_points += 1;
    } else {
      english_points += 1;
    }

    //point systems for the non LLM stuff
    let low_cost_spanish_points = 0;
    let low_cost_english_points = 0;

    if (nlp_js_language === "es") {
      spanish_points += 1;
      low_cost_spanish_points += 1;
    }
    if (nlp_js_language === "en") {
      english_points += 1;
      low_cost_english_points += 1;
    }
    if (tinyld_language === "es") {
      spanish_points += 1;
      low_cost_spanish_points += 1;
    }
    if (tinyld_language === "en") {
      english_points += 1;
      low_cost_english_points += 1;
    }

    // if (tinyld_language != "es" && tinyld_language != "en") {
    //grab points from the list
    tinyld_all_languages.forEach((language) => {
      if (language.lang === "es") {
        console.log("adding partial points for spanish");
        spanish_points += language.accuracy;
        low_cost_spanish_points += language.accuracy;
      }
      if (language.lang === "en") {
        console.log("adding partial points for english");
        english_points += language.accuracy;
        low_cost_english_points += language.accuracy;
      }
    });
    // }

    let user_input_machine_scoring = {
      input: transcription,
      nlp_js_language,
      nlp_js_confidence,
      gpt3_isSpanish,
      gpt3_isSpanish_confidence,
      gpt3_prompt_verison_id,
      tinyld_language,
      tinyld_all_languages,
      spanish_points,
      english_points,
      low_cost_spanish_points,
      low_cost_english_points,
    };

    return user_input_machine_scoring;
  } catch (error) {
    console.log("error in categorizer:", error);
  }
};
