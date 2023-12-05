import { Router } from "express";
import jwt from "jsonwebtoken";

import { createClient } from "@supabase/supabase-js";

const routes = Router();

type SupabaseTimeLog = {
  created_at?: string;
  user_id: string;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number | null;
  activity: string | null;
  initiate_action: string | null;
  end_action: string | null;
  user_session_time_log_id?: string;
  user_session_id: string | null;
};

type SupabaseUserSession = {
  user_session_id?: string;
  user_id?: string;
  created_at?: string;
  duration_seconds: number | null;
  activity?: string | null;
  updated_at: string | null;
  current_user_timezone?: string;
  current_seconds_from_gmt?: number;
};

enum LogAction {
  start = "start",
  pause = "pause",
  resume = "resume",
  cancel = "cancel",
}

type UserSessionLog = {
  user_session_id: string;
  initiate_action: LogAction;
  end_time: string;
  duration_seconds: number;
  activity: string;
  end_action: LogAction;
  start_time: string;
  current_user_timezone: string;
  current_seconds_from_gmt: number;
};

routes.post("/", async (req, res) => {
  try {
    //check if we have an authorization header
    if (!req.headers.authorization) {
      console.log("No authorization header");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }

    const token = req.headers.authorization.split(" ")[1]; // Get the token from the header

    if (!token) {
      console.log("No token");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }

    const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "no-secret";

    let payload = jwt.verify(token, SUPABASE_JWT_SECRET);

    if (payload) {
      console.log("payload:", payload);
    }

    if (!payload) {
      console.log("Invalid token");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }

    let supabase_user_id: string =
      typeof payload.sub === "function" ? payload.sub() : payload.sub;

    console.log("supabase_user_id:", supabase_user_id);

    console.log("req.body timeLogger:", req.body, null, 3);

    if (!supabase_user_id) {
      console.log("No supabase_user_id");
      return res.status(401).send("Unauthorized"); // Or any appropriate message
    }

    // Create a single supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_ANON_KEY || ""
    );

    let args: UserSessionLog = req.body;
    //If initiation_action is "start" create a new user_session
    if (args.initiate_action === LogAction.start) {
      console.log("create new user_session");
      //create new user_session
      let insertSession: SupabaseUserSession = {
        user_session_id: args.user_session_id,
        user_id: supabase_user_id,
        duration_seconds: args.duration_seconds,
        activity: args.activity,
        updated_at: new Date().toISOString(),
        current_user_timezone: args.current_user_timezone,
        current_seconds_from_gmt: args.current_seconds_from_gmt,
      };

      console.log("insertSession:", insertSession);

      const { data: session_data, error: session_error } = await supabase
        .from("user_sessions")
        .insert(insertSession)
        .select();

      if (session_error) {
        console.log("create session error:", session_error);
        throw session_error;
      }
      console.log("update_duration_data:", session_data);
    } else {
      console.log("no new user session");
    }

    //create time log
    let insertTimeLog: SupabaseTimeLog = {
      user_id: supabase_user_id,
      start_time: args.start_time,
      end_time: args.end_time,
      duration_seconds: args.duration_seconds,
      activity: args.activity,
      initiate_action: args.initiate_action,
      end_action: args.end_action,
      user_session_id: args.user_session_id,
    };

    const { data: timeLogData, error: timeLogError } = await supabase
      .from("user_session_time_logs")
      .insert(insertTimeLog)
      .select();

    if (timeLogError) {
      console.log("create time log error:", timeLogError);
      throw timeLogError;
    }

    console.log("create time log data:", timeLogData);

    //create user_time_log && update duration on user_session
    if (args.initiate_action !== LogAction.start) {
      //get user_session
      let { data: userSessionData, error: userSessionError } = await supabase
        .from("user_sessions")
        .select()
        .eq("user_session_id", args.user_session_id);

      if (userSessionError) {
        console.log("get user session error:", userSessionError);
        throw userSessionError;
      }
      console.log("get user session data:", userSessionData);

      //Update user_session duration and updated_at
      let updateDuration: SupabaseUserSession = {
        duration_seconds:
          args.duration_seconds + userSessionData[0].duration_seconds,
        updated_at: new Date().toISOString(),
      };

      console.log("update_duration:", updateDuration);

      let { data, error } = await supabase
        .from("user_sessions")
        .update(updateDuration)
        .eq("user_session_id", args.user_session_id)
        .select();

      if (error) {
        console.log("update_duration_error:", error);
        throw error;
      }
      console.log("update_duration_data:", data);
    }

    //TODO: figure out how to calculate streaks and store them based on this data

    res.status(200).send({ message: "Time Logged!" });
  } catch (error) {
    console.log("route error:", error);
    res.status(500).send({ error });
  }
});

export default routes;
