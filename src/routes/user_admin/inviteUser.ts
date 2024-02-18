import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const routes = Router();

type PromoCode = {
    promo_code_id: number;
    created_at: string;
    used_by_user_id: string | null;
    promo_code: string;
    used_at: string | null;
    promo_ends_at: string | null;
    good_until: string | null;
    locked_to_email: string | null;
    used: boolean;
    duration: string;
}

type Entitlement = {
    expires_date: string | null;
    grace_period_expires_date: string | null;
    purchase_date: string | null;
    product_identifier: string;
}

type Subscription = {
    expires_date: string;
    purchase_date: string;
    original_purchase_date: string;
    ownership_type: "PURCHASED" | "FAMILY_SHARED";
    period_type: "normal" | "trial" | "intro";
    store: "app_store" | "mac_app_store" | "play_store" | "amazon" | "stripe" | "promotional";
    is_sandbox: boolean;
    unsubscribe_detected_at: string | null;
    billing_issues_detected_at: string | null;
    grace_period_expires_date: string | null;
    refunded_at: string | null;
    auto_resume_date: string | null;
}

type NonSubscription = {
    id: string;
    purchase_date: string;
    store: "app_store" | "mac_app_store" | "play_store" | "amazon" | "stripe";
    is_sandbox: boolean;
}

type Experiment = {
    id: string;
    variant: "a" | "b";
}

type SubscriberAttribute = {
    value: string;
    updated_at_ms: number;
}


type Subscriber = {
    original_app_user_id: string;
    original_application_version: string | null;
    original_purchase_date: string | null;
    management_url: string | null;
    first_seen: string;
    last_seen: string;
    entitlements: Record<string, Entitlement>;
    subscriptions: Record<string, Subscription>;
    non_subscriptions: Record<string, NonSubscription[]>;
    other_purchases: Record<string, NonSubscription[]>; // Deprecated. See non_subscriptions
    subscriber_attributes: Record<string, SubscriberAttribute>;
    experiment: Experiment;
};

// -> Create supabase user
// -> Create Revcat User
// -> Create Promo Code ( kinda gives us a list of existing promos )
// -> Give  revcat user promo
// -> create an event that fires an email on loops
// -> Create a way to "change password" for the user

routes.get("/:invite_email/:secret",
    async (req, res) => {
        try {
            const { invite_email, secret } = req.params;

            // console.log("promoCode", promoCode)
            // console.log("user_id", user_id)
            // console.log("secret", secret)
            console.log("web promo params", req.params)

            if (!invite_email) throw new Error("No user id provided");
            if (!secret) throw new Error("No secret provided")

            let secretArg = "magic"

            if (secretArg !== secret) throw new Error("Invalid secret")

            // Create a single supabase client
            const supabase = createClient(
                process.env.SUPABASE_URL || "",
                process.env.SUPABASE_SERVICE_ROLE_KEY || ""
            );

            let password = generateSimplePassword();

            // Create a new user
            // const { data, error } = await supabase.auth.admin.inviteUserByEmail(invite_email, { redirectTo: "nuance://login-callback" })
            const { data, error } = await supabase.auth.admin.createUser({
                email: invite_email,
                password,
                email_confirm: true
            })


            if (error) {
                console.log("Invite User By Email Error", error);
                throw new Error("Cannot Invite user By Email: " + error.message);
            }
            if (!data) throw new Error("Failed to invite user by email");

            const user_id = data.user.id;

            console.log("User ID", user_id);

            const add_user_options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    Authorization: 'Bearer ' + process.env.REVENUECAT_API_KEY
                },
            };

            //TODO: Create a user in revenuecat
            let add_user_url = `https://api.revenuecat.com/v1/subscribers/${user_id.toUpperCase()}`
            console.log("add_user_url", add_user_url)
            let add_user_result = await fetch(add_user_url, add_user_options);
            let add_user_result_status = add_user_result.status;
            console.log("status of revcat call", add_user_result_status)
            console.log("result from revcat", add_user_result)

            if (add_user_result_status != 201) {
                // console.log()
                throw new Error("Error creating new user in revenue cat");
            }

            let add_user_json: Subscriber = await add_user_result.json()

            console.log("Subscriber", add_user_json)

            let duration = "monthly"

            const options = {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    Authorization: 'Bearer ' + process.env.REVENUECAT_API_KEY
                },
                body: JSON.stringify({ duration })
            };

            //Give that user a promo entitlement in revenue cat
            let entitlement_id = "Paid"
            //revenue cat auto capitalizes ids and is case sensative
            let url = `https://api.revenuecat.com/v1/subscribers/${user_id.toUpperCase()}/entitlements/${entitlement_id}/promotional`
            console.log("url", url)
            let result = await fetch(url, options);
            let status = result.status;
            if (status != 201) throw new Error("Error applying promo code");

            console.log("status of revcat call", status)
            console.log("result from revcat", result)
            let json: Subscriber = await result.json()

            console.log("Subscriber", json)

            // Update promo code to used
            const { data: promoCode, error: promoCodeError } = await supabase
                .from("promo_codes")
                .insert({
                    used: true,
                    promo_code: "sent_user_invite",
                    used_at: new Date().toISOString(),
                    invite_password: password,
                    invite_email,
                    used_by_user_id: user_id,
                    promo_ends_at: new Date(new Date().getTime() + 31 * 24 * 60 * 60 * 1000).toDateString()
                })

            if (promoCodeError) throw new Error(promoCodeError.message);

            res.status(200).send({
                message: "New user: " + user_id + " - " + invite_email + " - " + password + " -> invited and promo code applied!"
            });

        } catch (error) {
            console.log("Error:", error);
            res.status(500).send({ message: error.message });
        }
    });

function generateSimplePassword(): string {
    const words = ["read", "learn"];
    const specialCharacters = ["!", "@", "#", "$", "%"];
    const numbers = Math.floor(Math.random() * 899 + 100); // Generates a number between 100 and 999
    const word = words[Math.floor(Math.random() * words.length)];
    const specialCharacter = specialCharacters[Math.floor(Math.random() * specialCharacters.length)];

    const password = `${word.charAt(0).toUpperCase() + word.slice(1)}${specialCharacter}${numbers}`;
    return password;
}


export default routes;
