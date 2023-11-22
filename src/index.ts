import express, { Request, Response } from "express";
import cors from "cors";
import whisperRoute from "./routes/whisperRouter";
import * as middleware from "./utils/middleware";

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const app = express();
const port = process.env.PORT || 3000;

// parse json request body
app.use(express.json());

// enable cors
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, TypeScript Express!");
});

app.use("/upload", whisperRoute);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// custom middleware
app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);

//from this template
// https://dev.to/wizdomtek/typescript-express-building-robust-apis-with-nodejs-1fln
// maybe use zod
//https://zod.dev/
