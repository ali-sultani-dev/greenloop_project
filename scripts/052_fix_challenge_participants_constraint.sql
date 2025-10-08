-- Fix the missing unique constraint for challenge participants
-- This resolves the "42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification" error

-- Add unique constraint to prevent duplicate participants
ALTER TABLE public.challenge_participants 
ADD CONSTRAINT challenge_participants_unique_participation 
UNIQUE (challenge_id, user_id, team_id);

-- Drop existing function first to avoid parameter name conflicts
DROP FUNCTION IF EXISTS public.assign_team_to_challenge(uuid, uuid);

-- Update the assign_team_to_challenge function to use the correct constraint
CREATE FUNCTION public.assign_team_to_challenge(
    challenge_uuid uuid,
    team_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert team members as participants for team challenges
    INSERT INTO public.challenge_participants (challenge_id, team_id, user_id)
    SELECT 
        challenge_uuid,
        team_uuid,
        tm.user_id
    FROM public.team_members tm
    JOIN public.users u ON tm.user_id = u.id
    WHERE tm.team_id = team_uuid 
    AND u.is_active = true
    ON CONFLICT (challenge_id, user_id, team_id) DO NOTHING;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.assign_team_to_challenge(uuid, uuid) TO authenticated;
