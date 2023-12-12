//Update User Streaks
import { createClient } from "@supabase/supabase-js";

type SupabaseUserStreak = {
  user_streak_id?: string;
  streak_start_date?: string;
  streak_length?: number;
  streak_end_date?: string;
  user_id?: string;
  current_streak?: boolean;
  updated_at: string;
};

const updateStreak = async (userId: string) => {
  try {
    // Create a single supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_ANON_KEY || ""
    );

    //get user time logs
    let current_streak = 0;

    let thirty_hours_ago = new Date(
      new Date().getTime() - 30 * 60 * 60 * 1000
    ).toISOString();

    console.log("thirty_hours_ago:", thirty_hours_ago);

    const [streaksResponse, settingsResponse, timeLogResponse] =
      await Promise.all([
        supabase //get current streak
          .from("user_streaks")
          .select()
          .eq("user_id", userId)
          .eq("current_streak", true),
        supabase //get newest settings
          .from("user_settings")
          .select()
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .single(),
        supabase //get recent time logs from last 30 hrs
          .from("user_session_time_logs")
          .select()
          .eq("user_id", userId)
          .gte("start_time", thirty_hours_ago)
          .order("start_time", { ascending: false }),
      ]);

    let { data, error } = streaksResponse;
    let { data: settingsData, error: settingsError } = settingsResponse;
    let { data: timeLogData, error: timeLogError } = timeLogResponse;

    if (error) {
      console.log("get streak error:", error);
      throw error;
    }
    if (settingsError) {
      console.log("get settings error:", settingsError);
      throw settingsError;
    }
    if (timeLogError) {
      console.log("get time log error:", timeLogError);
      throw timeLogError;
    }

    //if no activity in last 30 hrs kill current streak
    if (timeLogData.length === 0) {
      //update current streak to false
      let updateStreak: SupabaseUserStreak = {
        current_streak: false,
        updated_at: new Date().toISOString(),
      };

      const { data: streak_data, error: streak_error } = await supabase
        .from("user_streaks")
        .update(updateStreak)
        .eq("user_id", userId)
        .eq("current_streak", true)
        .select();

      if (streak_error) {
        console.log("update streak error:", streak_error);
        throw streak_error;
      }
     
    } else {
        // if we have activity in last 30 hrs see if its greater than goal
        // if its greater than goal, update streak
    }

    //if there is no current streak, create one
    if (data.length === 0) {
      //create new streak
      //TODO: only do this if we have got enough work done today
      let insertStreak: SupabaseUserStreak = {
        user_id: userId,
        current_streak: true,
        streak_start_date: new Date().toISOString(),
        streak_length: 1,
        updated_at: new Date().toISOString(),
      };

      const { data: streak_data, error: streak_error } = await supabase
        .from("user_streaks")
        .insert(insertStreak)
        .select();

      if (streak_error) {
        console.log("create streak error:", streak_error);
        throw streak_error;
      }
      // console.log("update_duration_data:", session_data);
    } else {
      //get the current streak
      //update the current streak
      //if the current streak is over, create a new streak
    }

    //get user "current streak"
    //get user settings ( they set their own goal time )
  } catch {
    // Handle error
  }
};

// async function calculateUserStreaks(userId: string) {
//     // Fetch user activity from user_session_time_logs ordered by date
//     const userActivities = await getUserActivities(userId);

//     let currentStreak = 0;
//     let lastActivityDate = null;

//     userActivities.forEach(activity => {
//         const activityDate = new Date(activity.start_time).toDateString();
//         if (lastActivityDate) {
//             if (isConsecutiveDay(lastActivityDate, activityDate)) {
//                 currentStreak++;
//             } else {
//                 // Save the streak to the database if it's more than one day
//                 if (currentStreak > 1) {
//                     saveStreakToDatabase(userId, /* other streak details */);
//                 }
//                 currentStreak = 1; // Reset streak
//             }
//         } else {
//             currentStreak = 1; // Start a new streak
//         }
//         lastActivityDate = activityDate;
//     });

//     // Check and save the last streak if applicable
//     if (currentStreak > 1) {
//         saveStreakToDatabase(userId, /* other streak details */);
//     }
// }

// // Utility functions like 'getUserActivities', 'isConsecutiveDay', and 'saveStreakToDatabase' need to be implemented
// //
