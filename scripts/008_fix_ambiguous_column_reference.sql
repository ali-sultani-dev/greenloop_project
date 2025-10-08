-- Fix ambiguous column reference in update_team_stats function

-- Function to update team statistics (fixed version)
CREATE OR REPLACE FUNCTION public.update_team_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  team_id_to_update UUID;
  calculated_total_points INTEGER;
  calculated_total_co2 DECIMAL(10,2);
BEGIN
  -- Get team ID from team_members table
  IF TG_TABLE_NAME = 'user_actions' THEN
    SELECT tm.team_id INTO team_id_to_update
    FROM public.team_members tm
    WHERE tm.user_id = NEW.user_id;
  ELSIF TG_TABLE_NAME = 'team_members' THEN
    team_id_to_update := NEW.team_id;
  END IF;

  -- Only proceed if user is in a team
  IF team_id_to_update IS NOT NULL THEN
    -- Calculate team totals
    SELECT 
      COALESCE(SUM(u.points), 0),
      COALESCE(SUM(u.total_co2_saved), 0)
    INTO calculated_total_points, calculated_total_co2
    FROM public.users u
    INNER JOIN public.team_members tm ON u.id = tm.user_id
    WHERE tm.team_id = team_id_to_update;

    -- Update team record with explicit column references
    UPDATE public.teams
    SET 
      total_points = calculated_total_points,
      total_co2_saved = calculated_total_co2,
      updated_at = NOW()
    WHERE id = team_id_to_update;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
