import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/node";
import { createLoopsContact, createLoopsContactAndUpdateSupabase, identifyUser, sendEventToLoopsAndPosthog } from "../../libs/sendEvents";

const routes = Router();

type InsertPayload = {
    type: 'INSERT'
    table: string
    schema: string
    record: any
    old_record: null
}
type UpdatePayload = {
    type: 'UPDATE'
    table: string
    schema: string
    record: any
    old_record: any
}
type DeletePayload = {
    type: 'DELETE'
    table: string
    schema: string
    record: null
    old_record: any
}

//docs for supabase webhooks 
//https://supabase.com/docs/guides/database/webhooks

routes.post("/", async (req, res) => {
    try {
        console.log("process-auth body: ", req.body);

        let event = req.body;

        //user is brand new in the auth table
        //send event to loops
        if (event.type === 'INSERT' && event.table === 'users') {
            let row = event.record;
            let userId = row.id;
            let email = row.email;
            //Add User as contact to Loops
            let newUserRes = await createLoopsContact(email, userId);
            let res = await sendEventToLoopsAndPosthog(email, userId, "app_sign_up");
            await identifyUser(email, userId);
        } else {
            //Maybe this is where apple id stuff shows up?
            
        }

        if (event.type === 'UPDATE' && event.table === 'users') {
            //Do what needs to be done
            let row = event.record;
            let oldRow = event.old_record
            if (row && oldRow) {
                if (oldRow.confirmed_at === null && row.confirmed_at !== null) {
                    //auth_confirmed
                    let row = event.record;
                    let userId = row.id;
                    let email = row.email;
                    let res = await sendEventToLoopsAndPosthog(email, userId, "auth_confirmed");
                    await identifyUser(email, userId);
                } else {
                    console.log("No auth events we care to listen too");
                }
            }
        }

        res.status(200).send();

    } catch (error) {
        console.log("Error managing auth change for supabase user to send event to loops", error);
        Sentry.captureMessage("Error managing auth change for supabase user to send event to loops");
        Sentry.captureException(error);
        // throw error;
        res.status(500).send({ message: error.message });
    }
});

export default routes;
