-- Add missing DELETE policy for challenge_participants table
-- This allows users to delete their own challenge participation records

CREATE POLICY "challenge_participants_delete_own" ON public.challenge_participants 
  FOR DELETE USING (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT user_id FROM public.team_members WHERE team_id = challenge_participants.team_id
    )
  );
