import { Router } from "express";

import multer from "multer";
import OpenAI from "openai";
import fs from "fs";
import jwt from "jsonwebtoken";

const routes = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: "public/uploads",
    filename: (req, file, cb) => cb(null, `tmp-${file.originalname}`),
  }),
});

routes.post("/", upload.single("audioFile"), async (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");

    //check if we have an authorization header
    if (!req.headers.authorization) {
      console.log("No authorization header");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }

    const token = req.headers.authorization.split(" ")[1]; // Get the token from the header

    console.log("token:", token);

    if (!token) {
      console.log("No token");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }

    const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "no-secret";

    let payload = jwt.verify(token, SUPABASE_JWT_SECRET);

    if (payload) {
      console.log("payload:", payload);
    }

    if (!payload) {
      console.log("Invalid token");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }


    console.log("Received file:", req.file.originalname);
    const userId = req.body.user_id;
    console.log("userId:", userId);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });

    const resp = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
    });

    console.log("resp:", JSON.stringify(resp.text));

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

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: resp.text },
        // {
        //   role: "assistant",
        //   content: "The Los Angeles Dodgers won the World Series in 2020.",
        // },
        // { role: "user", content: "Where was it played?" },
      ],
      model: "gpt-3.5-turbo",
    });

    console.log("Completion:", completion);

    let gptResponse = completion.choices[0].message.content;

    console.log(completion.choices[0]);

    //Turn Text into audio
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      // input: "Today is a wonderful day to build something people love!",
      input: gptResponse ? gptResponse : "I don't know what to say.",
    });

    //Make the buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.setHeader("Content-Type", "application/json; charset=utf-8");

    const response = {
      audio: buffer,
      user_id: userId,
    };

    res.status(200).send(response);
  } catch (error: any) {
    console.log("error:", JSON.stringify(error));
    res.status(500).send({ error: error.message });
  }
});

export default routes;
