import * as Sentry from "@sentry/node";

const LogError = (error: any, message: string) => {
    Sentry.captureMessage(message);
    let error_id = Sentry.captureException(error);
    console.error(`Sentry Error ID: ${error_id}: ${message}`);
}

export default LogError;