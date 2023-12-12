import { Router } from "express";

import multer from "multer";
import OpenAI from "openai";
import fs from "fs";
import jwt from "jsonwebtoken";
import { Language } from "node-nlp";

const routes = Router();

type SupabaseMessage = {
  id: string;
  created_at: string;
  user_id: string;
  response_message_text: string;
  transcription_response_text: string;
  completion_tokens: number;
  total_completion_tokens: number;
  completion_attempts: number;
  detected_completion_language: string;
  detected_transcription_language: string;
  detected_completion_language_confidence: number;
  detected_transcription_language_confidence: number;
  all_completion_responses: any[];
};

import { createClient } from "@supabase/supabase-js";
import { addWords } from "../words/words";

const upload = multer({
  storage: multer.diskStorage({
    destination: "public/uploads",
    filename: (req, file, cb) => cb(null, `tmp-${file.originalname}`),
  }),
});

routes.post("/", upload.single("audioFile"), async (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");

    //prevent wrong language halucinations
    let detected_transcription_language = "";
    let detected_transcription_language_confidence = 0;

    const language = new Language(); //NLP.js

    //check if we have an authorization header
    if (!req.headers.authorization) {
      console.log("No authorization header");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }

    const token = req.headers.authorization.split(" ")[1]; // Get the token from the header

    if (!token) {
      console.log("No token");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }

    // Create a single supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_ANON_KEY || ""
    );

    const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "no-secret";

    let payload = jwt.verify(token, SUPABASE_JWT_SECRET);

    // if (payload) {
    //   console.log("payload:", payload);
    // }

    if (!payload) {
      console.log("Invalid token");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }

    let supabase_user_id = payload.sub.toString();

    console.log("Received file:", req.file.originalname);
    // const created_at_user_time = req.body.created_at_user_time;
    // console.log("created_at_user_time:", created_at_user_time);

    const current_seconds_from_gmt = req.body.seconds_from_gmt;
    const current_user_timezone = req.body.user_time_zone;

    // console.log("supabase_user_id:", supabase_user_id);

    //TODO: fetch previous messages from user ( in last hour ) limit 10
    const recentMessages: SupabaseMessage[] = [];

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });

    const fetchMessages = supabase
      .from("messages")
      .select()
      .eq("user_id", supabase_user_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const transcribeAudio = openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
    });

    const [messageResult, resp] = await Promise.all([
      fetchMessages,
      transcribeAudio,
    ]);

    if (messageResult.data) {
      // console.log("messageData:", messageResult.data);
      //reverse the order so its in convo
      recentMessages.push(...messageResult.data.reverse());
    }

    let transcriptionResponse = resp.text;

    //is it spanish or english?
    let transcriptionGuess = language.guess(transcriptionResponse, [
      "en",
      "es",
    ]);

    console.log("Guessing Transcription Language => ", transcriptionGuess);

    detected_transcription_language = transcriptionGuess[0].alpha2;
    detected_transcription_language_confidence = transcriptionGuess[0].score;

    // console.log("resp:", JSON.stringify(resp.text));

    //detect language

    //Delete file
    fs.unlinkSync(req.file.path);

    let system_prompt = `You are the worlds best spanish tutor.
        I am reading a book in Spanish to learn the language.
          Respond to all sentences spoken in Spanish as an English translation.
          If I speak in English it is always to ask a question.
          You should answer my question in English as my friendly Spanish tutor.
            Never ask a follow up question or ask if I need more help.
            Never try to end the conversation. Only answer or translate.
            If the Spanish is not very good just expect I am bad at reading and try your best to translate instead of asking for help.
            If I ask a question about a word it will be a word I said in the previous sentences I read and I may have pronounced it wrong.
            Never add who you think talked in a sentence.`;

    //save responses
    let {
      completion_text,
      completion_tokens,
      total_completion_tokens,
      detected_completion_language,
      detected_completion_language_confidence,
      completion_attempts,
      all_completion_responses,
    } = await fetchCompletion(
      system_prompt,
      transcriptionResponse,
      detected_transcription_language,
      detected_transcription_language_confidence,
      recentMessages
    );

    //Turn Text into audio
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      // input: "Today is a wonderful day to build something people love!",
      input: completion_text ? completion_text : "I don't know what to say.",
    });

    //Make the buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.setHeader("Content-Type", "application/json; charset=utf-8");

    const response = {
      audio: buffer,
      user_id: supabase_user_id,
    };

    res.status(200).send(response);

    //persist to supabase
    const { data: insertData, error: insertError } = await supabase
      .from("messages")
      .insert([
        {
          user_id: supabase_user_id,
          response_message_text: completion_text,
          transcription_response_text: transcriptionResponse,
          completion_tokens,
          total_completion_tokens,
          detected_transcription_language,
          detected_transcription_language_confidence,
          detected_completion_language,
          detected_completion_language_confidence,
          completion_attempts,
          all_completion_responses,
          current_seconds_from_gmt,
          current_user_timezone,
        },
      ])
      .select();

    //TODO: cant do this until we actually are labelling "question" vs "answer" after transcription
    //we only want to "addWords" to things we are confident are reading transcriptions
    // await addWords(supabase_user_id, insertData[0].id, transcriptionResponse);

    console.log("supabase error:", insertError);
  } catch (error: any) {
    console.log("error:", JSON.stringify(error));
    res.status(500).send({ error: error.message });
  }
});

const fetchCompletion = async (
  system_prompt: string,
  transcript: string,
  transcription_language: string,
  transcription_language_confidence: number,
  recent_messages: SupabaseMessage[]
): Promise<{
  completion_text: string;
  completion_tokens: number;
  total_completion_tokens: number;
  detected_completion_language: string;
  detected_completion_language_confidence: number;
  completion_attempts: number;
  all_completion_responses: any[];
}> => {
  console.log("fetching Completion");
  const language = new Language(); //NLP.js
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
  });

  let gptResponse = "";
  let detected_completion_language = "";
  let detected_completion_language_confidence = 0;
  let completion_tokens = 0;
  let total_completion_tokens = 0;
  let completion_attempts = 0;
  let all_completion_responses = [];

  // Convert SupabaseMessages from recent_messages into the format needed for openai completions api
  // The "response_message_text" is the assistant response
  let formattedMessages: any[] = [];

  recent_messages.forEach((message) => {
    let user_message = {
      role: "user",
      content: message.transcription_response_text,
    };
    formattedMessages.push(user_message);
    let assistant_message = {
      role: "assistant",
      content: message.response_message_text,
    };
    formattedMessages.push(assistant_message);
  });

  let messages = [
    { role: "system", content: system_prompt },
    // ...formattedMessages,
    { role: "user", content: transcript },
  ];

  // console.log("messages:", messages);

  for (let i = 0; i < 3; i++) {
    completion_attempts++;
    const completion = await openai.chat.completions.create({
      // messages: messages,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: transcript },
      ],
      //  {"role": "system", "content": "You are a helpful assistant."},
      // {"role": "user", "content": "Who won the world series in 2020?"},
      // {"role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020."},
      // {"role": "user", "content": "Where was it played?"}
      // ],
      model: "gpt-3.5-turbo",
    });

    all_completion_responses.push(completion);
    console.log("Completion:", completion);

    gptResponse = completion.choices[0].message.content
      ? completion.choices[0].message.content
      : "";

    //detect language
    let completionGuess = language.guess(gptResponse, ["en", "es"]);
    detected_completion_language = completionGuess[0].alpha2;
    detected_completion_language_confidence = completionGuess[0].score;

    // console.log(completion.choices[0]);

    completion_tokens = completion.usage?.total_tokens
      ? completion.usage.total_tokens
      : 0;
    total_completion_tokens += completion_tokens;

    console.log("GPT3 Tokens:", completion_tokens);
    console.log("transcription:", transcript);
    console.log("transcription_language:", transcription_language);
    console.log(
      "transcription_language_confidence:",
      transcription_language_confidence
    );
    console.log("Completion Response:", gptResponse);
    console.log("dected_completion_lanauge:", detected_completion_language);
    console.log(
      "dected_completion_lanauge_confidence:",
      detected_completion_language_confidence
    );

    //shutting this off for now because language detection is not good enough
    break;
    // If user readins in spanish and we return in english ( a translation basically )
    // if (
    //   transcription_language === "es" &&
    //   detected_completion_language === "en"
    // ) {
    //   break;
    // }

    // //if user asks a question in english and we return in english
    // if (
    //   transcription_language === "en" &&
    //   detected_completion_language === "en"
    // ) {
    //   break;
    // }
  }
  let obj = {
    completion_text: gptResponse ? gptResponse : "",
    completion_tokens: completion_tokens ? completion_tokens : 0,
    total_completion_tokens: total_completion_tokens
      ? total_completion_tokens
      : 0,
    detected_completion_language,
    detected_completion_language_confidence,
    completion_attempts,
    all_completion_responses,
  };

  // console.log("GPT Completion Response:", JSON.stringify(obj, null, 3));

  return obj;
};

export default routes;
