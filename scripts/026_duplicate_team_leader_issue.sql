-- Fix duplicate team leader issue in team_performance_summary view
-- The current view shows team leaders twice due to JOIN condition

DROP VIEW IF EXISTS "public"."team_performance_summary";

CREATE OR REPLACE VIEW "public"."team_performance_summary" AS
WITH "team_user_stats" AS (
    -- Get all team members (including leaders who are also members)
    SELECT DISTINCT
        t.id AS team_id,
        t.name AS team_name,
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.points,
        u.total_co2_saved,
        u.level,
        u.department,
        u.job_title,
        CASE
            WHEN u.id = t.team_leader_id THEN true
            ELSE false
        END AS is_leader,
        COALESCE(tm.joined_at, t.created_at) AS joined_at,
        (
            SELECT count(*) 
            FROM public.user_actions ua 
            WHERE ua.user_id = u.id 
            AND ua.verification_status = 'approved'
        ) AS verified_actions
    FROM public.teams t
    LEFT JOIN public.team_members tm ON t.id = tm.team_id
    LEFT JOIN public.users u ON u.id = tm.user_id
    WHERE t.is_active = true 
    AND u.id IS NOT NULL
    
    UNION
    
    -- Get team leaders who are not in team_members table
    SELECT 
        t.id AS team_id,
        t.name AS team_name,
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.points,
        u.total_co2_saved,
        u.level,
        u.department,
        u.job_title,
        true AS is_leader,
        t.created_at AS joined_at,
        (
            SELECT count(*) 
            FROM public.user_actions ua 
            WHERE ua.user_id = u.id 
            AND ua.verification_status = 'approved'
        ) AS verified_actions
    FROM public.teams t
    JOIN public.users u ON u.id = t.team_leader_id
    WHERE t.is_active = true
    AND NOT EXISTS (
        SELECT 1 
        FROM public.team_members tm 
        WHERE tm.team_id = t.id 
        AND tm.user_id = t.team_leader_id
    )
)
SELECT 
    team_id,
    team_name,
    user_id,
    first_name,
    last_name,
    email,
    points,
    total_co2_saved,
    level,
    department,
    job_title,
    is_leader,
    joined_at,
    verified_actions,
    sum(points) OVER (PARTITION BY team_id) AS team_total_points,
    sum(total_co2_saved) OVER (PARTITION BY team_id) AS team_total_co2,
    count(*) OVER (PARTITION BY team_id) AS team_member_count,
    avg(points) OVER (PARTITION BY team_id) AS team_avg_points,
    avg(total_co2_saved) OVER (PARTITION BY team_id) AS team_avg_co2
FROM team_user_stats
ORDER BY team_id, is_leader DESC, points DESC;

-- Grant permissions
ALTER VIEW "public"."team_performance_summary" OWNER TO "postgres";

-- Add comment explaining the fix
COMMENT ON VIEW "public"."team_performance_summary" IS 'Team performance summary view - fixed to prevent duplicate team leader entries';
