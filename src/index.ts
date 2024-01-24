import express, { Request, Response } from "express";
import cors from "cors";
import whisperRoute from "./routes/whisperRouter";
import processMessageRoute from "./routes/processMessages";
import wordActivityRoute from "./routes/wordActivity";
import promoRoute from "./routes/promoCodes";
import webPromoRoute from "./routes/webPromoCode";
import revCatWebhookRoute from "./routes/revCatWebhook";
import processRevcatWebhookRoute from "./routes/processRevcatWebhooks";
import processNewUserRoute from "./routes/processNewProfile";
import processAuthChangeRoute from "./routes/processAuthChange";
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

//webhooks from internal systems
app.use("/webhooks/process-new-user", processNewUserRoute);
app.use("/webhooks/process-messages", processMessageRoute);
app.use("/webhooks/process-revcat-webhooks", processRevcatWebhookRoute);
app.use("/webhooks/process-auth-change", processAuthChangeRoute)

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
