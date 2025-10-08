-- Fix the update_challenge_progress function to use correct field names
-- This addresses the "record 'new' has no field 'user_id'" error

-- Drop the problematic trigger first
DROP TRIGGER IF EXISTS on_user_progress_updated ON public.users;

-- Create a corrected version of the update_challenge_progress function
CREATE OR REPLACE FUNCTION public.update_challenge_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  participant_record RECORD;
  progress_value INTEGER;
  target_user_id UUID;
BEGIN
  -- Use NEW.id instead of NEW.user_id when triggered from users table
  -- Determine the user_id based on which table triggered this function
  IF TG_TABLE_NAME = 'users' THEN
    target_user_id := NEW.id;  -- When triggered from users table, use NEW.id
  ELSIF TG_TABLE_NAME = 'user_actions' THEN
    target_user_id := NEW.user_id;  -- When triggered from user_actions table, use NEW.user_id
  ELSE
    -- Fallback: try to determine from context
    target_user_id := COALESCE(NEW.id, NEW.user_id);
  END IF;

  -- Only proceed if we have a valid user_id
  IF target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Update progress for individual challenges
  FOR participant_record IN 
    SELECT cp.* FROM public.challenge_participants cp
    INNER JOIN public.challenges c ON cp.challenge_id = c.id
    WHERE cp.user_id = target_user_id 
    AND c.challenge_type = 'individual'
    AND c.start_date <= NOW() 
    AND c.end_date >= NOW()
    AND cp.completed = false
  LOOP
    -- Calculate progress based on challenge metric
    SELECT 
      CASE 
        WHEN c.target_metric = 'points' THEN u.points
        WHEN c.target_metric = 'actions' THEN (
          SELECT COUNT(*) FROM public.user_actions ua 
          WHERE ua.user_id = target_user_id 
          AND ua.completed_at >= c.start_date
          AND ua.verification_status = 'approved'
        )
        WHEN c.target_metric = 'co2_saved' THEN FLOOR(u.total_co2_saved)
        ELSE 0
      END INTO progress_value
    FROM public.users u, public.challenges c
    WHERE u.id = target_user_id AND c.id = participant_record.challenge_id;

    -- Update participant progress
    UPDATE public.challenge_participants
    SET 
      current_progress = progress_value,
      completed = (progress_value >= (
        SELECT target_value FROM public.challenges WHERE id = participant_record.challenge_id
      )),
      completed_at = CASE 
        WHEN progress_value >= (
          SELECT target_value FROM public.challenges WHERE id = participant_record.challenge_id
        ) THEN NOW()
        ELSE NULL
      END
    WHERE id = participant_record.id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recreate the trigger for users table updates
CREATE TRIGGER on_user_progress_updated
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_challenge_progress();

-- Also create a trigger for user_actions table to update challenge progress immediately
DROP TRIGGER IF EXISTS on_user_action_challenge_progress ON public.user_actions;
CREATE TRIGGER on_user_action_challenge_progress
  AFTER INSERT OR UPDATE ON public.user_actions
  FOR EACH ROW
  WHEN (NEW.verification_status = 'approved')
  EXECUTE FUNCTION public.update_challenge_progress();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_challenge_progress() TO authenticated;
