CREATE OR REPLACE FUNCTION get_user_daily_word_activity(
    user_id_input UUID,
    start_date DATE,
    num_days INT
)
RETURNS TABLE (
    user_id UUID,
    activity_date DATE,
    unique_words_today INTEGER,
    total_words_today INTEGER,
    first_time_words_today INTEGER
) AS $$
BEGIN
    RETURN QUERY

    WITH date_series AS (
        SELECT generate_series(start_date - num_days + 1, start_date, '1 day'::interval)::DATE AS series_date
    ),
    words_with_timezones AS (
        -- Use the function parameter user_id_input to avoid ambiguity with the user_id column
        SELECT
            uw.user_id AS user_word_user_id, -- Rename to avoid ambiguity
            (m.created_at AT TIME ZONE m.current_user_timezone)::DATE AS word_activity_date,
            uw.word_id,
            ROW_NUMBER() OVER (PARTITION BY uw.user_id, uw.word_id ORDER BY m.created_at) AS rn
        FROM
            public.user_words uw
            JOIN public.messages m ON uw.message_id = m.id
        WHERE
            uw.user_id = user_id_input
    ),
    word_activity AS (
        SELECT
            wwtz.user_word_user_id AS user_id, -- Use renamed column to avoid ambiguity
            wwtz.word_activity_date AS activity_date,
            COUNT(*)::INTEGER AS total_words_today,
            COUNT(DISTINCT wwtz.word_id)::INTEGER AS unique_words_today,
            COUNT(CASE WHEN wwtz.rn = 1 THEN 1 ELSE NULL END)::INTEGER AS first_time_words_today
        FROM
            words_with_timezones wwtz
        GROUP BY
            wwtz.user_word_user_id, wwtz.word_activity_date
    )
    SELECT
        user_id_input AS user_id, -- Directly use user_id_input to specify the returned user_id
        ds.series_date AS activity_date, -- Use series_date to specify activity date clearly
        COALESCE(SUM(wa.unique_words_today), 0)::INTEGER AS unique_words_today,
        COALESCE(SUM(wa.total_words_today), 0)::INTEGER AS total_words_today,
        COALESCE(SUM(wa.first_time_words_today), 0)::INTEGER AS first_time_words_today
    FROM
        date_series ds
        LEFT JOIN word_activity wa ON ds.series_date = wa.activity_date AND user_id_input = wa.user_id -- Use explicit condition to match user_id
    GROUP BY
        user_id_input, ds.series_date
    ORDER BY
        ds.series_date;

END;
$$ LANGUAGE plpgsql;
