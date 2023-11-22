import { Router } from "express";

import multer from "multer";
import OpenAI from "openai";
import fs from "fs";

const routes = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: "public/uploads",
    filename: (req, file, cb) => cb(null, `tmp-${file.originalname}`),
  }),
});

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY || "",
// });

console.log("process.env:", process.env);

routes.post("/", upload.single("audioFile"), async (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");
    console.log("OPEN_AI_KEY", process.env.OPENAI_API_KEY);
    console.log("Received file:", req.file.originalname);
    const userId = req.body.user_id;
    console.log("userId:", userId);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });

    // Convert the buffer to a readable stream
    // const readableStream = new Readable();
    // readableStream.push(req.file.buffer);
    // readableStream.push(null);
    const resp = await openai.audio.translations.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1", //model
    });
    
    // Send audio to whisper ( trying translation api )
    // const resp = await openai.audio.translations.create({
    //   file: req.file.path,
    //   model: "whisper-1", //model
    // });
    // })
    // const resp = await openai.audio.translations(
    //   fs.createReadStream(req.file.path),
    //   "whisper-1"
    // );
    // const resp = await openai.createTranslation({
    //   file: req.file.path,
    //   model: "whisper-1", //model
    // });

    console.log("resp:", JSON.stringify(resp));
    //Delete file
    // fs.unlinkSync(req.file.path);

    //Turn Text into audio
    // const speech = await openai.audio.speech.create({
    //   model: "tts-1",
    //   voice: "alloy",
    //   // input: "Today is a wonderful day to build something people love!",
    //   input: resp.data.translations[0].translation,
    // });

    //Send audio back to user
    // Get audio buffer
    // const buffer = Buffer.from(await speech.arrayBuffer());

    // Set headers and send buffer
    // res.setHeader('Content-Type', 'audio/mpeg');
    //   res.setHeader('Content-Disposition', 'inline');
    // res.setHeader("Content-Type", "application/json");

    // const response = {
    //   audio: buffer,
    //   user_id: userId,
    // };

    // res.setHeader("Content-Type", "application/json");
    // res.status(200).send(response);
    res.status(200).send("ok");
  } catch (error: any) {
    console.log("error:", JSON.stringify(error));
    res.status(500).send({ error: error.message });
  }
});

// routes.post("/", upload.single("file"), async (req, res) => {
//   try {
//     const file = req.file;
//     const response = await axios.post("https://api.openai.com/v1/engines/davinci-codex/completions", file, {
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
//       }
//     });
//     res.status(200).send(response.data);
//   } catch (error) {
//     res.status(500).send({ error: error.message });
//   }
// });

export default routes;
