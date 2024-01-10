import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import * as middleware from "../utils/middleware";

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


routes.post("/", middleware.authenticateToken, //JWT management
    async (req: middleware.RequestWithUserId, res) => {
        try {

            console.log(req.body);

            let promoCode = req.body.promo_code;

            console.log("promoCode", promoCode)

            if (!promoCode) throw new Error("No promo code provided");

            // Create a single supabase client
            const supabase = createClient(
                process.env.SUPABASE_URL || "",
                process.env.SUPABASE_SERVICE_ROLE_KEY || ""
            );

            const { data, error } = await supabase
                .from("promo_codes")
                .select("*")
                .eq("promo_code", promoCode)
                .eq("used", false)
                .single();

            if (error) {
                console.log("supa_promo_error", error);
                throw new Error("Invalid Promo Code");
            }

            if (!data) throw new Error("No unused promo code found");


            let supabase_user_id = req.user_id

            console.log("supabase_user_id", supabase_user_id)
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

            let entitlement_id = "Paid"
            //revenue cat auto capitalizes ids and is case sensative
            let url = `https://api.revenuecat.com/v1/subscribers/${supabase_user_id.toUpperCase()}/entitlements/${entitlement_id}/promotional`
            console.log("url", url)
            let result = await fetch(url, options);
            let status = result.status;
            if (status != 201) throw new Error("Error applying promo code");

            console.log("status of revcat call", status)
            console.log("result from revcat", result)
            let json: Subscriber = await result.json()

            console.log("Subscriber", json)

            // Update promo code to used
            const { data: updatedData, error: updateError } = await supabase
                .from("promo_codes")
                .update({
                    used: true, used_at: new Date().toISOString(),
                    used_by_user_id: supabase_user_id,
                    promo_ends_at: new Date(new Date().getTime() + 31 * 24 * 60 * 60 * 1000).toDateString()
                })
                .eq("promo_code_id", data.promo_code_id)
                .single();

            if (updateError) throw new Error(updateError.message);

            res.status(200).send({ message: "Promo code applied!" });

        } catch (error) {
            console.log("Error:", error);
            res.status(500).send({ message: error.message });
        }
    });

export default routes;
