-- Fix remaining database trigger issues
-- This script fixes the check_and_award_badges function and simple_update_user_co2_savings function
-- that are trying to access NEW.user_id when triggered from the users table

-- =============================================
-- FIX BADGE AWARDING FUNCTION
-- =============================================

-- Drop and recreate the check_and_award_badges function with correct field reference
DROP FUNCTION IF EXISTS public.check_and_award_badges() CASCADE;

CREATE OR REPLACE FUNCTION public.check_and_award_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  badge_record RECORD;
  user_value INTEGER;
  target_user_id UUID;
BEGIN
  -- Determine the correct user_id based on trigger context
  -- When triggered from users table, use NEW.id
  -- When triggered from user_actions table, use NEW.user_id
  IF TG_TABLE_NAME = 'users' THEN
    target_user_id := NEW.id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  -- Loop through all active badges
  FOR badge_record IN 
    SELECT * FROM public.badges WHERE is_active = true
  LOOP
    -- Check if user already has this badge
    IF NOT EXISTS (
      SELECT 1 FROM public.user_badges 
      WHERE user_id = target_user_id AND badge_id = badge_record.id
    ) THEN
      -- Get user's current value for the badge criteria
      CASE badge_record.criteria_type
        WHEN 'points' THEN
          SELECT points INTO user_value FROM public.users WHERE id = target_user_id;
        WHEN 'actions' THEN
          SELECT COUNT(*) INTO user_value 
          FROM public.user_actions 
          WHERE user_id = target_user_id AND verification_status = 'approved';
        WHEN 'co2_saved' THEN
          SELECT FLOOR(total_co2_saved) INTO user_value 
          FROM public.users WHERE id = target_user_id;
        ELSE
          user_value := 0;
      END CASE;

      -- Award badge if criteria met
      IF user_value >= badge_record.criteria_value THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (target_user_id, badge_record.id)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recreate the trigger for badge checking
DROP TRIGGER IF EXISTS on_user_stats_updated ON public.users;
CREATE TRIGGER on_user_stats_updated
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.points != NEW.points OR OLD.total_co2_saved != NEW.total_co2_saved)
  EXECUTE FUNCTION public.check_and_award_badges();

-- =============================================
-- ENSURE SIMPLE CO2 SAVINGS FUNCTION IS CORRECT
-- =============================================

-- The simple_update_user_co2_savings function should work correctly since it's triggered
-- from user_actions table where NEW.user_id exists, but let's make sure it's robust
DROP FUNCTION IF EXISTS public.simple_update_user_co2_savings() CASCADE;

CREATE OR REPLACE FUNCTION public.simple_update_user_co2_savings()
RETURNS TRIGGER AS $$
BEGIN
  -- Added validation to ensure user_id exists and action is approved
  IF NEW.user_id IS NOT NULL AND NEW.verification_status = 'approved' THEN
    UPDATE public.users 
    SET total_co2_saved = COALESCE(total_co2_saved, 0) + NEW.co2_saved,
        updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS simple_on_user_action_approved ON public.user_actions;
CREATE TRIGGER simple_on_user_action_approved
  AFTER INSERT OR UPDATE ON public.user_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.simple_update_user_co2_savings();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.check_and_award_badges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.simple_update_user_co2_savings() TO authenticated;
