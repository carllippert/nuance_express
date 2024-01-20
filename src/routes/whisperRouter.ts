import { Router } from "express";

import multer from "multer";
import OpenAI from "openai";
import fs from "fs";
import { PostHog } from 'posthog-node'

import * as middleware from "../utils/middleware";
import {
  UserInputMachineScoring,
  categorizeUserInput,
} from "../categorize/scoring";

const routes = Router();

type SupabaseMessage = {
  id: string;
  created_at: string;
  user_id: string;
  message_input_classification: string;
  message_input_classifier: string;
  response_message_text: string;
  transcription_response_text: string;
  completion_tokens: number;
  total_completion_tokens: number;
  completion_attempts: number;
  all_completion_responses: any[];
  user_input_machine_scoring?: any;
  application_response_machine_scoring?: any;
};

import { createClient } from "@supabase/supabase-js";

//statics
let transciption_model = "whisper-1";
let text_to_speech_model = "tts-1";
let llm_model = "gpt-3.5-turbo";

//file upload stuff for audio
const upload = multer({
  storage: multer.diskStorage({
    destination: "public/uploads",
    filename: (req, file, cb) => cb(null, `tmp-${file.originalname}`),
  }),
});

//Main route for reading experience
routes.post(
  "/",
  middleware.authenticateToken, //JWT management
  upload.single("audioFile"),
  async (req: middleware.RequestWithUserId, res) => {
    try {
      if (!req.file) throw new Error("No file uploaded");
      //Logging Data
      const message_start_time = new Date();
      let message_end_time: Date;
      let message_time_duration: number;
      let transcription_start_time: Date;
      let transcription_end_time: Date;
      let transcription_time_duration: number;
      let speech_generation_start_time: Date;
      let speech_generation_end_time: Date;
      let speech_generation_time_duration: number;

      //Aggregate data
      let speed_data: any;

      // Create a single supabase client
      const supabase = createClient(
        process.env.SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );

      let supabase_user_id = req.user_id;

      const current_seconds_from_gmt = req.body.seconds_from_gmt;
      const current_user_timezone = req.body.user_time_zone;

      let is_question: Boolean;

      if (req.body.is_question == "true") {
        is_question = Boolean(true);
      } else {
        is_question = Boolean(false);
      }

      //Top Level State
      let user_message: string;
      let prompt: string;

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || "",
      });

      //body values come in as strings
      if (is_question) {
        console.log("User is asking a question");

        const trnascription_start_time = new Date();
        const transcript = await openai.audio.transcriptions.create({
          file: fs.createReadStream(req.file.path),
          model: transciption_model,
          language: "en",
          prompt: `What does "quirro" mean in spanish?`
        });

        transcription_end_time = new Date();
        transcription_time_duration = transcription_end_time.getTime() - trnascription_start_time.getTime();

        console.log("user_transcript:", transcript)

        user_message = transcript.text;

        //set prompt
        prompt = `You are the worlds best spanish tutor.
           I am reading books in Spanish to learn the language.
           You should answer my question in English as my friendly Spanish tutor.
            Never ask a follow up question or ask if I need more help.
            Never try to end the conversation. Only answer the question. 
            If I ask a question about a word it will be a word I said in the previous sentences I read and I may have pronounced it wrong.`;

      } else {
        console.log("User is reading to get translation");
        //Translate and send back
        transcription_start_time = new Date();
        const transcript = await openai.audio.transcriptions.create({
          file: fs.createReadStream(req.file.path),
          model: transciption_model,
          language: "es",
          prompt: "¿Qué pasa? - dijo Ron"
        });
        transcription_end_time = new Date();
        transcription_time_duration = transcription_end_time.getTime() - transcription_start_time.getTime();

        console.log("user_transcript:", transcript)

        user_message = transcript.text;

        //set prompt
        prompt = `
        Translate this sentence to english from spanish exactly leaving nothing out and adding nothing.
        Use proper pronunciation.`
      }

      let {
        completion_text,
        completion_tokens,
        total_completion_tokens,
        completion_attempts,
        all_completion_responses,
        llm_time_duration,
        llm_start_time,
        llm_end_time
      } = await fetchCompletion(prompt, user_message);

      //is it english or spanish?
      let user_input_machine_scoring = await categorizeUserInput(user_message);

      //Delete file
      fs.unlinkSync(req.file.path);

      speech_generation_start_time = new Date();
      //Turn Text into audio
      const mp3 = await openai.audio.speech.create({
        model: text_to_speech_model,
        voice: "nova",
        // input: "Today is a wonderful day to build something people love!",
        input: completion_text ? completion_text : "I don't know what to say.",
        // input: transcriptionResponse, 
      });

      speech_generation_end_time = new Date();
      speech_generation_time_duration = speech_generation_end_time.getTime() - speech_generation_start_time.getTime();

      //Make the buffer
      const buffer = Buffer.from(await mp3.arrayBuffer());

      res.setHeader("Content-Type", "application/json; charset=utf-8");

      const response = {
        audio: buffer,
        user_id: supabase_user_id,
      };
      message_end_time = new Date();
      message_time_duration = message_end_time.getTime() - message_start_time.getTime();
      res.status(200).send(response);

      try {
        //langauge detection on our output
        let application_response_machine_scoring = await categorizeUserInput(
          completion_text,
        );

        speed_data = {
          message_start_time,
          message_end_time,
          message_time_duration,
          transcription_start_time,
          transcription_end_time,
          transcription_time_duration,
          speech_generation_start_time,
          speech_generation_end_time,
          speech_generation_time_duration,
          llm_start_time,
          llm_end_time,
          llm_time_duration
        }

        //persist to supabase
        const { data: insertData, error: insertError } = await supabase
          .from("messages")
          .insert([
            {
              message_input_classification: is_question ? "question" : "reading",
              message_input_classifier: "in_app_button",  //in future maybe it can be automatic  with AI
              user_id: supabase_user_id,
              response_message_text: completion_text,
              transcription_response_text: user_message,
              completion_tokens,
              total_completion_tokens,
              completion_attempts,
              all_completion_responses,
              current_seconds_from_gmt,
              current_user_timezone,
              user_input_machine_scoring,
              application_response_machine_scoring,
              speed_data,
            },
          ])
          .select();

      } catch (error: any) {
        console.log("error in message persistance:", JSON.stringify(error));
      }

      try {
        const posthog = new PostHog(process.env.POSTHOG_API_KEY || "")

        posthog.capture({
          distinctId: supabase_user_id.toUpperCase(),
          event: "message_received",
          properties: {
            message_input_classification: is_question ? "question" : "reading",
            message_input_classifier: "in_app_button",  //in future maybe it can be automatic  with AI
            transciption_model,
            text_to_speech_model,
            llm_model,
            total_completion_tokens,
            //timing data
            ...speed_data,
          },
        });

      } catch (error: any) {
        console.log("error in posthog event capture:", JSON.stringify(error));
      }
      // console.log("supabase error:", insertError);
    } catch (error: any) {
      console.log("error:", JSON.stringify(error));
      res.status(500).send({ error: error.message });
    }
  }
);

//TODO: should i use function calling to do the "question or transcription" detection?
const fetchCompletion = async (
  system_prompt: string,
  transcript: string
): Promise<{
  completion_text: string;
  completion_tokens: number;
  total_completion_tokens: number;
  completion_attempts: number;
  all_completion_responses: any[];
  llm_time_duration: number;
  llm_start_time: Date;
  llm_end_time: Date;
}> => {
  console.log("fetching Completion");

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
  });

  let gptResponse = "";
  let completion_tokens = 0;
  let total_completion_tokens = 0;
  let completion_attempts = 0;
  let all_completion_responses = [];

  console.log("transcript:", transcript);
  console.log("system_prompt:", system_prompt);

  let llm_start_time = new Date();
  for (let i = 0; i < 3; i++) {
    completion_attempts++;
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: transcript },
      ],
      model: llm_model,
    });

    all_completion_responses.push(completion);
    console.log("Completion:", completion);

    gptResponse = completion.choices[0].message.content
      ? completion.choices[0].message.content
      : "";

    completion_tokens = completion.usage?.total_tokens
      ? completion.usage.total_tokens
      : 0;
    total_completion_tokens += completion_tokens;

    console.log("GPT3 Tokens:", completion_tokens);
    console.log("transcription:", transcript);

    console.log("Completion Response:", gptResponse);

    break;
  }
  let llm_end_time = new Date();
  let llm_time_duration = llm_end_time.getTime() - llm_start_time.getTime();

  let obj = {
    completion_text: gptResponse ? gptResponse : "",
    completion_tokens: completion_tokens ? completion_tokens : 0,
    total_completion_tokens: total_completion_tokens
      ? total_completion_tokens
      : 0,
    completion_attempts,
    all_completion_responses,
    llm_time_duration,
    llm_start_time,
    llm_end_time
  };

  return obj;
};


export default routes;
