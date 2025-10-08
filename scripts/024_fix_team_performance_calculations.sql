-- Fix Team Performance Data Issues
-- This script addresses missing team leader contributions and improves team statistics

-- =============================================
-- IMPROVED TEAM STATISTICS FUNCTION
-- =============================================

-- Drop existing function and recreate with proper team leader inclusion
DROP FUNCTION IF EXISTS public.update_team_stats() CASCADE;

CREATE OR REPLACE FUNCTION public.update_team_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  team_id_to_update UUID;
  new_total_points INTEGER;
  new_total_co2 DECIMAL(10,2);
  team_leader_id UUID;
BEGIN
  -- Get team ID from different trigger sources
  IF TG_TABLE_NAME = 'user_actions' THEN
    SELECT tm.team_id INTO team_id_to_update
    FROM public.team_members tm
    WHERE tm.user_id = NEW.user_id;
    
    -- Also check if user is a team leader
    IF team_id_to_update IS NULL THEN
      SELECT t.id INTO team_id_to_update
      FROM public.teams t
      WHERE t.team_leader_id = NEW.user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'team_members' THEN
    team_id_to_update := COALESCE(NEW.team_id, OLD.team_id);
  ELSIF TG_TABLE_NAME = 'users' THEN
    -- Check if updated user is a team leader
    SELECT t.id INTO team_id_to_update
    FROM public.teams t
    WHERE t.team_leader_id = NEW.id;
    
    -- Also check if user is a team member
    IF team_id_to_update IS NULL THEN
      SELECT tm.team_id INTO team_id_to_update
      FROM public.team_members tm
      WHERE tm.user_id = NEW.id;
    END IF;
  END IF;

  -- Only proceed if user is associated with a team
  IF team_id_to_update IS NOT NULL THEN
    -- Get team leader ID
    SELECT team_leader_id INTO team_leader_id
    FROM public.teams
    WHERE id = team_id_to_update;

    -- Calculate team totals including both team members AND team leader
    WITH team_users AS (
      -- Get all team members
      SELECT u.id, u.points, u.total_co2_saved
      FROM public.users u
      INNER JOIN public.team_members tm ON u.id = tm.user_id
      WHERE tm.team_id = team_id_to_update
      
      UNION
      
      -- Add team leader (if not already included as member)
      SELECT u.id, u.points, u.total_co2_saved
      FROM public.users u
      WHERE u.id = team_leader_id
      AND NOT EXISTS (
        SELECT 1 FROM public.team_members tm 
        WHERE tm.team_id = team_id_to_update AND tm.user_id = team_leader_id
      )
    )
    SELECT 
      COALESCE(SUM(points), 0),
      COALESCE(SUM(total_co2_saved), 0)
    INTO new_total_points, new_total_co2
    FROM team_users;

    -- Update team record
    UPDATE public.teams
    SET 
      total_points = new_total_points,
      total_co2_saved = new_total_co2,
      updated_at = NOW()
    WHERE id = team_id_to_update;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate triggers for the updated function
DROP TRIGGER IF EXISTS on_team_member_change ON public.team_members;
CREATE TRIGGER on_team_member_change
  AFTER INSERT OR DELETE OR UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_stats();

DROP TRIGGER IF EXISTS on_user_action_for_team_stats ON public.user_actions;
CREATE TRIGGER on_user_action_for_team_stats
  AFTER INSERT OR UPDATE ON public.user_actions
  FOR EACH ROW
  WHEN (NEW.verification_status = 'approved')
  EXECUTE FUNCTION public.update_team_stats();

-- Add trigger for when user stats are updated (points/CO2 changes)
DROP TRIGGER IF EXISTS on_user_stats_for_team_update ON public.users;
CREATE TRIGGER on_user_stats_for_team_update
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.points != NEW.points OR OLD.total_co2_saved != NEW.total_co2_saved)
  EXECUTE FUNCTION public.update_team_stats();

-- =============================================
-- IMPROVED ADMIN TEAM STATS VIEW
-- =============================================

-- Drop and recreate the admin_team_stats view with proper member counting
DROP VIEW IF EXISTS public.admin_team_stats;

CREATE OR REPLACE VIEW public.admin_team_stats AS
WITH team_member_counts AS (
  SELECT 
    t.id as team_id,
    COUNT(tm.id) as member_count,
    -- Count team leader separately if not in team_members
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.team_members tm2 
        WHERE tm2.team_id = t.id AND tm2.user_id = t.team_leader_id
      ) THEN 0
      ELSE 1
    END as leader_not_member
  FROM public.teams t
  LEFT JOIN public.team_members tm ON t.id = tm.team_id
  GROUP BY t.id, t.team_leader_id
)
SELECT 
  t.id,
  t.name,
  t.description,
  t.team_leader_id,
  COALESCE(
    CONCAT(u.first_name, ' ', u.last_name),
    u.email,
    'Unknown Leader'
  ) AS leader_name,
  t.total_points,
  t.total_co2_saved,
  t.max_members,
  (tmc.member_count + tmc.leader_not_member) AS current_members,
  t.is_active,
  t.created_at
FROM public.teams t
LEFT JOIN public.users u ON t.team_leader_id = u.id
LEFT JOIN team_member_counts tmc ON t.id = tmc.team_id;

-- =============================================
-- RECALCULATE ALL TEAM STATS
-- =============================================

-- Trigger recalculation for all teams by updating their updated_at timestamp
UPDATE public.teams 
SET updated_at = NOW()
WHERE is_active = true;

-- =============================================
-- CREATE TEAM PERFORMANCE SUMMARY VIEW
-- =============================================

CREATE OR REPLACE VIEW public.team_performance_summary AS
WITH team_user_stats AS (
  SELECT 
    t.id as team_id,
    t.name as team_name,
    -- All team users (members + leader if not member)
    u.id as user_id,
    u.first_name,
    u.last_name,
    u.email,
    u.points,
    u.total_co2_saved,
    u.level,
    u.department,
    u.job_title,
    CASE WHEN u.id = t.team_leader_id THEN true ELSE false END as is_leader,
    COALESCE(tm.joined_at, t.created_at) as joined_at,
    -- Count of verified actions
    (SELECT COUNT(*) FROM public.user_actions ua 
     WHERE ua.user_id = u.id AND ua.verification_status = 'approved') as verified_actions
  FROM public.teams t
  LEFT JOIN public.team_members tm ON t.id = tm.team_id
  LEFT JOIN public.users u ON (u.id = tm.user_id OR u.id = t.team_leader_id)
  WHERE t.is_active = true AND u.id IS NOT NULL
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
  -- Team-level aggregations
  SUM(points) OVER (PARTITION BY team_id) as team_total_points,
  SUM(total_co2_saved) OVER (PARTITION BY team_id) as team_total_co2,
  COUNT(*) OVER (PARTITION BY team_id) as team_member_count,
  AVG(points) OVER (PARTITION BY team_id) as team_avg_points,
  AVG(total_co2_saved) OVER (PARTITION BY team_id) as team_avg_co2
FROM team_user_stats
ORDER BY team_id, is_leader DESC, points DESC;

-- Grant permissions
GRANT SELECT ON public.team_performance_summary TO authenticated;
GRANT SELECT ON public.admin_team_stats TO authenticated;
