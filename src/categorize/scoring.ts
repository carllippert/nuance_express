import OpenAI from "openai";
import { Language } from "node-nlp";

import { detect, detectAll } from "tinyld";

export type TinyLDLanguageResponse = {
  lang: string;
  accuracy: number;
};

export type UserInputMachineScoring = {
  input: string;
  nlp_js_language: string;
  nlp_js_confidence: number;
  gpt3_isSpanish?: boolean;
  gpt3_isSpanish_confidence?: number;
  gpt3_prompt_version_id?: string;
  tinyld_language: string;
  tinyld_all_languages: TinyLDLanguageResponse[];
  spanish_points: number;
  english_points: number;
  low_cost_spanish_points: number;
  low_cost_english_points: number;
};

export const categorizeUserInput = async (
  transcription: string
): Promise<UserInputMachineScoring> => {
  try {
    //NLP.js
    const language = new Language(); //NLP.js

    //is it spanish or english?
    let transcriptionGuess = language.guess(transcription, ["en", "es"]);

    // //console.log("Guessing Transcription Language => ", transcriptionGuess);

    let nlp_js_language = transcriptionGuess[0].alpha2;
    let nlp_js_confidence = transcriptionGuess[0].score;
    //TinyLD
    let tinyld_language = await detect(transcription);
    let tinyld_all_languages = await detectAll(transcription);

    //OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });

    let spanish_points = 0;
    let english_points = 0;

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
        // //console.log("adding partial points for spanish");
        spanish_points += language.accuracy;
        low_cost_spanish_points += language.accuracy;
      }
      if (language.lang === "en") {
        // //console.log("adding partial points for english");
        english_points += language.accuracy;
        low_cost_english_points += language.accuracy;
      }
    });
    // }

    let user_input_machine_scoring = {
      input: transcription,
      nlp_js_language,
      nlp_js_confidence,
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
