import express, { Request, Response } from "express";
import cors from "cors";
import whisperRoute from "./routes/whisperRouter";
import talkRoute from "./routes/talk";
import requestSpeechCourseRoute from "./routes/requestSpeechCourse";
import processSpeechCourseRequestRoute from "./routes/webhooks/processSpeechCourseRequest";
import processSpeechCourseAudioGenerationRequestRoute from "./routes/webhooks/processCourseAudioGenerationRequest";

import processMessageRoute from "./routes/webhooks/processMessages";
import wordActivityRoute from "./routes/wordActivity";
import inviteUserRoute from "./routes/inviteUser";
import promoRoute from "./routes/promoCodes";
import webPromoRoute from "./routes/webPromoCode";
import revCatWebhookRoute from "./routes/webhooks/revCatWebhook";
import processRevcatWebhookRoute from "./routes/webhooks/processRevcatWebhooks";
import processAuthChangeRoute from "./routes/webhooks/processAuthChange";
import * as middleware from "./utils/middleware";

import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const app = express();
const port = process.env.PORT || 3000;

//Sentry error reporting
Sentry.init({
  dsn: "https://e6d64a2947ccc486f04f4acbab88c4f2@o1208202.ingest.sentry.io/4506349959577600",
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
    new ProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

// parse json request body
app.use(express.json());

// enable cors
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.status(200).send("Hello from Nuance Express!");
});

//Routes used in applications
app.use("/upload", whisperRoute)
app.use("/word-activity", wordActivityRoute)
app.use("/promo", promoRoute)
app.use("/web-promo", webPromoRoute)
app.use("/talk", talkRoute)
// app.use("/speech-course", speechCourseRoute)

app.use("/invite", inviteUserRoute)

//webhooks from internal systems
app.use("/webhooks/process-messages", processMessageRoute);
app.use("/webhooks/process-revcat-webhooks", processRevcatWebhookRoute);
app.use("/webhooks/process-auth-change", processAuthChangeRoute);

///////////////////////////////////
///////////////////////////////////
///// Speech Course Generation ////
///////////////////////////////////
///////////////////////////////////

//1. User or system makes a request for generation of a speech course
app.use("/request-course", requestSpeechCourseRoute)
//2. Webhooks fire on creation of request to take care of it if its an "immediate" request
app.use("/webhooks/process-speech-course-generation-request", processSpeechCourseRequestRoute);
//3. The text of the course is created and stored in the database
app.use("/webooks/process-course-audio-generation-request", processSpeechCourseAudioGenerationRequestRoute);
//4. The course audio is generated and stored in the database
//5. Course is marked processed and "ready"
//6. Database permisions allow user to download "ready" courses and see processing of their own courses

//Webhooks from external systems
app.use("/webhooks/revenuecat", revCatWebhookRoute);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// custom middleware
app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);

//from this template
// https://dev.to/wizdomtek/typescript-express-building-robust-apis-with-nodejs-1fln
// maybe use zod
//https://zod.dev/
