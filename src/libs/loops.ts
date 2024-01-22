import * as Sentry from "@sentry/node";
import { createClient } from "@supabase/supabase-js";

const createLoopsContact = async (email, userId) => {
    try {
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
export const sendEventToLoops = async (email: string, eventName: string, environment: "PRODUCTION" | "SANDBOX") => {
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

