import { Router } from "express";
import axios from "axios";
import multer from "multer";
import OpenAI from "openai";

const routes = Router();
const upload = multer();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

console.log("process.env:", process.env);

// const response = await openai.listEngines();

// // Multer for handling file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/') // make sure this folder exists
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.originalname)
//   }
// });

// const upload = multer({ storage: storage });

routes.post("/", upload.single("audioFile"), (req, res) => {
  console.log("Received file:", req.file.originalname);
  const userId = req.body.user_id;
  console.log("userId:", userId);
  res.send("File uploaded successfully.");
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
