-- Temporarily disable problematic triggers to fix action logging
-- This script disables triggers that are causing the "user_id field not found" error

-- Drop the problematic triggers temporarily
DROP TRIGGER IF EXISTS on_user_action_approved ON public.user_actions;
DROP TRIGGER IF EXISTS on_user_action_team_stats ON public.user_actions;

-- Create a simpler trigger for CO2 savings update that doesn't conflict
CREATE OR REPLACE FUNCTION public.simple_update_user_co2_savings()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if the action is approved
  IF NEW.verification_status = 'approved' THEN
    UPDATE public.users 
    SET total_co2_saved = COALESCE(total_co2_saved, 0) + NEW.co2_saved
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the new simple trigger
CREATE TRIGGER simple_on_user_action_approved
  AFTER INSERT OR UPDATE ON public.user_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.simple_update_user_co2_savings();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.simple_update_user_co2_savings() TO authenticated;
