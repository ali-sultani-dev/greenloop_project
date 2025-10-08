-- Fix admin_team_stats view to include created_at field
-- This addresses the issue where team creation dates show as "N/A"

CREATE OR REPLACE VIEW admin_team_stats AS
SELECT 
  t.id,
  t.name,
  t.description,
  t.team_leader_id,
  u.first_name || ' ' || u.last_name as leader_name,
  t.total_points,
  t.total_co2_saved,
  t.max_members,
  COUNT(tm.id) as current_members,
  t.is_active,
  t.created_at  -- Added missing created_at field from teams table
FROM teams t
LEFT JOIN users u ON t.team_leader_id = u.id
LEFT JOIN team_members tm ON t.id = tm.team_id
GROUP BY t.id, u.first_name, u.last_name, t.created_at;  -- Added created_at to GROUP BY clause
