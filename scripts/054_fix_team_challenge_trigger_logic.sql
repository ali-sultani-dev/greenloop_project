-- Fix team challenge trigger and participant logic
-- The API uses create_team_challenge_participants which should create individual user records
-- Remove the problematic trigger that references non-existent team_id field

-- Drop trigger first to avoid dependency error
DROP TRIGGER IF EXISTS auto_assign_team_challenge_trigger ON challenges;

-- Drop the problematic auto_assign function since challenges table has no team_id field
DROP FUNCTION IF EXISTS auto_assign_team_challenge();

-- Clean up existing data that violates constraints before adding new ones
-- Remove any duplicate participation records (keep the first one for each user-challenge pair)
DELETE FROM challenge_participants 
WHERE id NOT IN (
    SELECT DISTINCT ON (challenge_id, user_id) id 
    FROM challenge_participants 
    ORDER BY challenge_id, user_id, joined_at ASC
);

-- The create_team_challenge_participants function in the schema is correct and used by the API
-- It creates individual user records with both user_id and team_id set
-- But this violates the check constraint, so we need to update the constraint

-- Update the check constraint to allow both user_id and team_id to be set for team challenges
ALTER TABLE challenge_participants 
DROP CONSTRAINT IF EXISTS challenge_participants_check;

-- Add new constraint that allows:
-- 1. Individual challenges: user_id NOT NULL, team_id NULL
-- 2. Team challenges: user_id NOT NULL, team_id NOT NULL  
-- 3. Company challenges: user_id NOT NULL, team_id NULL
ALTER TABLE challenge_participants 
ADD CONSTRAINT challenge_participants_check 
CHECK (user_id IS NOT NULL);

-- Drop constraint instead of index to avoid dependency error
-- Drop existing unique constraint before creating new one
ALTER TABLE challenge_participants 
DROP CONSTRAINT IF EXISTS challenge_participants_unique_participation;

-- Update the unique constraint to prevent duplicate user participation in same challenge
ALTER TABLE challenge_participants 
ADD CONSTRAINT challenge_participants_unique_participation 
UNIQUE (challenge_id, user_id);
