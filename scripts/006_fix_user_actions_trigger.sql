-- Fix for user_actions trigger issue
-- This addresses the "record 'new' has no field 'user_id'" error

-- First, let's create a safer version of the update_team_stats function
CREATE OR REPLACE FUNCTION public.update_team_stats()
RETURNS TRIGGER AS $$
DECLARE
  team_id_to_update UUID;
  total_points INTEGER;
  total_co2 DECIMAL(10,2);
  member_count INTEGER;
BEGIN
  -- Handle different trigger sources safely
  IF TG_TABLE_NAME = 'user_actions' THEN
    -- For user_actions table changes
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      -- Get team ID from team_members table using the user_id from user_actions
      SELECT tm.team_id INTO team_id_to_update
      FROM public.team_members tm
      WHERE tm.user_id = NEW.user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'team_members' THEN
    -- For team_members table changes
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      team_id_to_update := NEW.team_id;
    ELSIF TG_OP = 'DELETE' THEN
      team_id_to_update := OLD.team_id;
    END IF;
  END IF;

  -- Only proceed if we have a valid team_id
  IF team_id_to_update IS NOT NULL THEN
    -- Calculate total points for the team
    SELECT COALESCE(SUM(ua.points_earned), 0) INTO total_points
    FROM public.user_actions ua
    JOIN public.team_members tm ON ua.user_id = tm.user_id
    WHERE tm.team_id = team_id_to_update;

    -- Calculate total CO2 saved for the team
    SELECT COALESCE(SUM(ua.co2_saved), 0) INTO total_co2
    FROM public.user_actions ua
    JOIN public.team_members tm ON ua.user_id = tm.user_id
    WHERE tm.team_id = team_id_to_update;

    -- Get member count
    SELECT COUNT(*) INTO member_count
    FROM public.team_members
    WHERE team_id = team_id_to_update;

    -- Update team statistics
    UPDATE public.teams
    SET 
      total_points = total_points,
      total_co2_saved = total_co2,
      member_count = member_count,
      updated_at = NOW()
    WHERE id = team_id_to_update;
  END IF;

  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS on_user_action_team_stats ON public.user_actions;
DROP TRIGGER IF EXISTS on_team_member_change ON public.team_members;

-- Create the trigger for user_actions (this was missing)
CREATE TRIGGER on_user_action_team_stats
  AFTER INSERT OR UPDATE ON public.user_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_stats();

-- Recreate the trigger for team_members
CREATE TRIGGER on_team_member_change
  AFTER INSERT OR UPDATE OR DELETE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_stats();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_team_stats() TO authenticated;
