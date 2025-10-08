-- Fix admin_challenge_stats view to include category and description fields
-- This resolves the issue where category shows empty and description is not available in the admin panel

DROP VIEW IF EXISTS admin_challenge_stats;

CREATE OR REPLACE VIEW admin_challenge_stats AS
SELECT 
    c.id,
    c.title,
    c.description,  -- Added missing description field
    c.category,     -- Added missing category field
    c.challenge_type,
    c.target_metric,
    c.target_value,
    c.reward_points,
    c.start_date,
    c.end_date,
    c.is_active,
    c.created_at,   -- Added created_at for consistency
    COUNT(cp.id) AS total_participants,
    COUNT(CASE WHEN cp.completed = true THEN 1 ELSE NULL END) AS completed_count,
    AVG(cp.current_progress) AS avg_progress
FROM challenges c
LEFT JOIN challenge_participants cp ON c.id = cp.challenge_id
GROUP BY 
    c.id, 
    c.title, 
    c.description, 
    c.category, 
    c.challenge_type, 
    c.target_metric, 
    c.target_value, 
    c.reward_points, 
    c.start_date, 
    c.end_date, 
    c.is_active, 
    c.created_at
ORDER BY c.created_at DESC;
