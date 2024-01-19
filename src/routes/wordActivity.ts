import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import * as middleware from "../utils/middleware";

const routes = Router();


routes.get("/", middleware.authenticateToken, //JWT management
    async (req: middleware.RequestWithUserId, res) => {
        try {

            console.log(req.body);

            // Create a single supabase client
            const supabase = createClient(
                process.env.SUPABASE_URL || "",
                process.env.SUPABASE_SERVICE_ROLE_KEY || ""
            );

            let user_id = req.user_id
            console.log("user_id", user_id);

            let { data, error } = await supabase
                .rpc('get_word_activity', {
                    user_id_input: user_id,
                })

            if (error) {
                console.log("error getting word activity", error);
                throw new Error("Error getting word activity" + error.message);
            }

            console.log("data", data);

            res.status(200).send({ data });

        } catch (error) {
            console.log("Error:", error);
            res.status(500).send({ message: error.message });
        }
    });

export default routes;
