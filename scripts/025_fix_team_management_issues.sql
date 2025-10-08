-- Fix Team Management Issues
-- 1. Fix ambiguous column reference in update_team_stats function
-- 2. Allow users to join multiple teams
-- 3. Ensure action logging works for multiple team memberships

-- =============================================
-- FIX AMBIGUOUS COLUMN REFERENCE
-- =============================================

-- Drop and recreate the update_team_stats function with proper column qualification
DROP FUNCTION IF EXISTS public.update_team_stats() CASCADE;

CREATE OR REPLACE FUNCTION public.update_team_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  team_id_to_update UUID;
  new_total_points INTEGER;
  new_total_co2 DECIMAL(10,2);
  current_team_leader_id UUID;
BEGIN
  -- Get team ID from different trigger sources
  IF TG_TABLE_NAME = 'user_actions' THEN
    -- Get all teams this user belongs to (since users can be in multiple teams)
    FOR team_id_to_update IN 
      SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = NEW.user_id
      UNION
      SELECT t.id FROM public.teams t WHERE t.team_leader_id = NEW.user_id
    LOOP
      -- Update each team this user belongs to
      PERFORM public.recalculate_single_team_stats(team_id_to_update);
    END LOOP;
    
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'team_members' THEN
    team_id_to_update := COALESCE(NEW.team_id, OLD.team_id);
  ELSIF TG_TABLE_NAME = 'users' THEN
    -- Get all teams this user is associated with
    FOR team_id_to_update IN 
      SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = NEW.id
      UNION
      SELECT t.id FROM public.teams t WHERE t.team_leader_id = NEW.id
    LOOP
      -- Update each team this user belongs to
      PERFORM public.recalculate_single_team_stats(team_id_to_update);
    END LOOP;
    
    RETURN NEW;
  END IF;

  -- For team_members table changes, update the specific team
  IF team_id_to_update IS NOT NULL THEN
    PERFORM public.recalculate_single_team_stats(team_id_to_update);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================
-- CREATE HELPER FUNCTION FOR SINGLE TEAM STATS
-- =============================================

CREATE OR REPLACE FUNCTION public.recalculate_single_team_stats(target_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  new_total_points INTEGER;
  new_total_co2 DECIMAL(10,2);
  current_team_leader_id UUID;
BEGIN
  -- Get team leader ID with proper table qualification
  SELECT t.team_leader_id INTO current_team_leader_id
  FROM public.teams t
  WHERE t.id = target_team_id;

  -- Calculate team totals including both team members AND team leader
  WITH team_users AS (
    -- Get all team members
    SELECT u.id, u.points, u.total_co2_saved
    FROM public.users u
    INNER JOIN public.team_members tm ON u.id = tm.user_id
    WHERE tm.team_id = target_team_id
    
    UNION
    
    -- Add team leader (if not already included as member)
    SELECT u.id, u.points, u.total_co2_saved
    FROM public.users u
    WHERE u.id = current_team_leader_id
    AND NOT EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = target_team_id AND tm.user_id = current_team_leader_id
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
  WHERE id = target_team_id;
END;
$$;

-- =============================================
-- RECREATE TRIGGERS
-- =============================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS on_team_member_change ON public.team_members;
DROP TRIGGER IF EXISTS on_user_action_for_team_stats ON public.user_actions;
DROP TRIGGER IF EXISTS on_user_stats_for_team_update ON public.users;

-- Recreate triggers for the updated function
CREATE TRIGGER on_team_member_change
  AFTER INSERT OR DELETE OR UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_stats();

CREATE TRIGGER on_user_action_for_team_stats
  AFTER INSERT OR UPDATE ON public.user_actions
  FOR EACH ROW
  WHEN (NEW.verification_status = 'approved')
  EXECUTE FUNCTION public.update_team_stats();

CREATE TRIGGER on_user_stats_for_team_update
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.points != NEW.points OR OLD.total_co2_saved != NEW.total_co2_saved)
  EXECUTE FUNCTION public.update_team_stats();

-- =============================================
-- REMOVE UNIQUE CONSTRAINT ON TEAM MEMBERSHIP
-- =============================================

-- Check if there's a unique constraint preventing multiple team memberships
-- and remove it if it exists
DO $$
BEGIN
  -- Drop unique constraint on user_id if it exists (allowing multiple team memberships)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'team_members_user_id_key' 
    AND table_name = 'team_members'
  ) THEN
    ALTER TABLE public.team_members DROP CONSTRAINT team_members_user_id_key;
  END IF;
  
  -- Drop unique constraint on team_id, user_id combination if we want to allow duplicate memberships
  -- (This is commented out as we probably want to prevent duplicate memberships in the same team)
  /*
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'team_members_team_id_user_id_key' 
    AND table_name = 'team_members'
  ) THEN
    ALTER TABLE public.team_members DROP CONSTRAINT team_members_team_id_user_id_key;
  END IF;
  */
END $$;

-- =============================================
-- ADD UNIQUE CONSTRAINT TO PREVENT DUPLICATE TEAM MEMBERSHIPS
-- =============================================

-- Ensure users can't join the same team twice, but can join multiple different teams
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'team_members_team_user_unique' 
    AND table_name = 'team_members'
  ) THEN
    ALTER TABLE public.team_members 
    ADD CONSTRAINT team_members_team_user_unique 
    UNIQUE (team_id, user_id);
  END IF;
END $$;

-- =============================================
-- UPDATE TEAM PERFORMANCE SUMMARY VIEW
-- =============================================

-- Drop and recreate view to handle multiple team memberships properly
DROP VIEW IF EXISTS public.team_performance_summary;

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

-- =============================================
-- CREATE VIEW FOR USER'S MULTIPLE TEAM MEMBERSHIPS
-- =============================================

CREATE OR REPLACE VIEW public.user_team_memberships AS
SELECT 
  u.id as user_id,
  u.first_name,
  u.last_name,
  u.email,
  t.id as team_id,
  t.name as team_name,
  t.description as team_description,
  CASE WHEN u.id = t.team_leader_id THEN 'leader' ELSE 'member' END as role,
  COALESCE(tm.joined_at, t.created_at) as joined_at,
  t.total_points as team_total_points,
  t.total_co2_saved as team_total_co2
FROM public.users u
LEFT JOIN public.team_members tm ON u.id = tm.user_id
LEFT JOIN public.teams t ON (t.id = tm.team_id OR t.team_leader_id = u.id)
WHERE t.is_active = true
ORDER BY u.id, t.name;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT SELECT ON public.team_performance_summary TO authenticated;
GRANT SELECT ON public.user_team_memberships TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_single_team_stats(UUID) TO authenticated;

-- =============================================
-- RECALCULATE ALL TEAM STATS
-- =============================================

-- Trigger recalculation for all teams
SELECT public.recalculate_single_team_stats(id) FROM public.teams WHERE is_active = true;

-- =============================================
-- ADD HELPFUL INDEXES
-- =============================================

-- Index for faster team membership lookups
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);

-- Composite index for unique constraint and faster lookups
CREATE INDEX IF NOT EXISTS idx_team_members_team_user ON public.team_members(team_id, user_id);
