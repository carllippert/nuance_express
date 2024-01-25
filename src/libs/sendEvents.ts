import * as Sentry from "@sentry/node";
import { createClient } from "@supabase/supabase-js";
import { PostHog } from 'posthog-node'

export const createLoopsContact = async (email, userId) => {
    try {

        console.log("Creating contact in Loops: ", email, " - ", userId);

        const resp = await fetch('https://app.loops.so/api/v1/contacts/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`
            },
            body: JSON.stringify({
                email,
                userId
            })
        });
        return resp;
    } catch (error) {
        console.error("Error creating contact in Loops:", error);
        Sentry.captureMessage("Error creating contact in Loops");
        Sentry.captureException(error);
        throw error;
    }
}

export const createLoopsContactAndUpdateSupabase = async (userId) => {
    try {

        // Get profile data
        const supabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );

        //get user details from supabase auth
        const { data, error } = await supabase.auth.admin.getUserById(userId)

        if (error) {
            throw new Error(error.message);
        }

        let email = data.user.email;

        //TODO: deal with this if we change the type of authentication we offer
        if (!email) {
            console.log("No email for user", userId);
            throw new Error("No email for user in supabase auth");
        }

        let loopsContact = await createLoopsContact(email, userId);

        console.log("loopsContact", loopsContact);
        //update supabase
        const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .update({ added_to_external_email_system: true })
            .eq("id", userId)

        if (profileError) {
            throw new Error(error.message);
        }

    } catch (error) {
        console.error("Error updating profile with loops external email system:", error);
        Sentry.captureMessage("Error updating profile with loops external email system.");
        Sentry.captureException(error);
        throw error;
    }
}

//Only do if "environment" != "SANDBOX" for revenuecat
export const sendEventToLoopsAndPosthog = async (email: string, userId: string, eventName: string, environment: "PRODUCTION" | "SANDBOX" = "PRODUCTION") => {
    if (environment === "PRODUCTION") {
        try {
            const resp = await fetch('https://app.loops.so/api/v1/events/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`
                },
                body: JSON.stringify({ email, eventName })
            });

            //send same events to posthog
            const posthog = new PostHog(process.env.POSTHOG_API_KEY || "")

            console.log("Adding Event to Posthog for: ", email, " - ", userId , " - ", eventName);
        
            posthog.capture({
                distinctId: userId.toUpperCase(), 
                event: eventName,
            });

            return resp;

        } catch (error) {
            Sentry.captureMessage("Error sending event to Loops");
            Sentry.captureException(error);
            console.error("Error sending event to Loops:", error);
            throw error;
        }

    } else {
        console.log("Skipping sending event to loops because environment is SANDBOX");
        return;
    }
}

export const sendEventToLoopsAndUpdateSupabase = async (userId: string, revenuecat_event_id: string, eventName: string, environment: "PRODUCTION" | "SANDBOX") => {
    const supabase = createClient(
        process.env.SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    if (environment === "PRODUCTION") {
        try {
            //get user details from supabase auth
            const { data, error } = await supabase.auth.admin.getUserById(userId)

            if (error) {
                throw new Error(error.message);
            }

            let email = data.user.email;

            let result = await sendEventToLoopsAndPosthog(email, userId, eventName, environment);

            let { data: processingData, error: processingError } = await supabase
                .from("revenuecat_webhooks")
                .update({
                    processed: true,
                    processed_at: new Date().toISOString()
                })
                .eq("revenuecat_event_id", revenuecat_event_id);

            if (processingError) {
                throw new Error(error.message);
            }

        } catch (error) {
            //save error to supabase
            let { data, error: supaError } = await supabase
                .from("revenuecat_webhooks")
                .update({
                    processing_error: true,
                    processed_at: new Date().toISOString(),
                    processing_error_payload: { message: error.message }
                })
                .eq("revenuecat_event_id", revenuecat_event_id);

            if (supaError) {
                Sentry.captureMessage("Error saving error to supabase");
                Sentry.captureException(error);
                console.error("Error saving error to supabase:", error);
                throw error;
            }

            Sentry.captureMessage("Error sending event to Loops");
            Sentry.captureException(error);
            console.error("Error sending event to Loops:", error);
            throw error;
        }
    } else {
        try {
            //mark as skipped for sandbox
            let { data: processingData, error: processingError } = await supabase
                .from("revenuecat_webhooks")
                .update({
                    skipped: true,
                    skip_reason: "SANDBOX",
                    processed_at: new Date().toISOString()
                })
                .eq("revenuecat_event_id", revenuecat_event_id);

            if (processingError) {
                throw new Error(processingError.message);
            }
            console.log("Marking webhook as skipped because environment is SANDBOX");
            return;
        } catch (error) {
            Sentry.captureMessage("Error marking event as SKIPPED for sandbox");
            Sentry.captureException(error);
            console.error("Error marking event as SKIPPED for sandbox:", error);
            throw error;
        }
    }
}

