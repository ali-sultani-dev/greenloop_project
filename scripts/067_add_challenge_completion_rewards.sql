-- Add challenge completion reward system
-- This script creates a function to award points when challenges are completed

-- Function to award challenge completion rewards
CREATE OR REPLACE FUNCTION award_challenge_completion_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    challenge_record RECORD;
    team_member_record RECORD;
    reward_points INTEGER;
BEGIN
    -- Only process when a challenge is being marked as completed
    IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
        
        -- Get challenge details
        SELECT * INTO challenge_record
        FROM challenges 
        WHERE id = NEW.challenge_id;
        
        -- Only award points if challenge has reward points
        IF challenge_record.reward_points > 0 THEN
            
            CASE challenge_record.challenge_type
                WHEN 'individual' THEN
                    -- Individual challenges don't get reward points (already enforced in validation)
                    -- This case should never happen due to validation, but included for completeness
                    NULL;
                    
                WHEN 'team' THEN
                    -- Award points to all team members who participated in the challenge
                    FOR team_member_record IN
                        SELECT DISTINCT cp.user_id
                        FROM challenge_participants cp
                        WHERE cp.challenge_id = NEW.challenge_id
                        AND cp.user_id IS NOT NULL
                        AND cp.completed = true
                    LOOP
                        -- Create point transaction for each team member
                        INSERT INTO point_transactions (
                            user_id,
                            points,
                            transaction_type,
                            description,
                            reference_id,
                            reference_type
                        ) VALUES (
                            team_member_record.user_id,
                            challenge_record.reward_points,
                            'challenge_reward',
                            format('Completed team challenge: %s', challenge_record.title),
                            challenge_record.id,
                            'challenge'
                        );
                        
                        RAISE NOTICE 'Awarded % points to user % for completing team challenge %', 
                            challenge_record.reward_points, team_member_record.user_id, challenge_record.title;
                    END LOOP;
                    
                WHEN 'company' THEN
                    -- Award points to the individual user who completed the company challenge
                    INSERT INTO point_transactions (
                        user_id,
                        points,
                        transaction_type,
                        description,
                        reference_id,
                        reference_type
                    ) VALUES (
                        NEW.user_id,
                        challenge_record.reward_points,
                        'challenge_reward',
                        format('Completed company challenge: %s', challenge_record.title),
                        challenge_record.id,
                        'challenge'
                    );
                    
                    RAISE NOTICE 'Awarded % points to user % for completing company challenge %', 
                        challenge_record.reward_points, NEW.user_id, challenge_record.title;
                        
            END CASE;
            
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to award points when challenges are completed
DROP TRIGGER IF EXISTS award_challenge_rewards_trigger ON challenge_participants;
CREATE TRIGGER award_challenge_rewards_trigger
    AFTER UPDATE ON challenge_participants
    FOR EACH ROW
    EXECUTE FUNCTION award_challenge_completion_rewards();

-- Also create trigger for challenge_progress table (backup mechanism)
DROP TRIGGER IF EXISTS award_challenge_rewards_progress_trigger ON challenge_progress;
CREATE TRIGGER award_challenge_rewards_progress_trigger
    AFTER UPDATE ON challenge_progress
    FOR EACH ROW
    EXECUTE FUNCTION award_challenge_completion_rewards();

-- Update validation to allow team challenges to have reward points
CREATE OR REPLACE FUNCTION validate_personal_challenge() 
RETURNS TRIGGER
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    -- Set start_date to creation time if not provided
    IF NEW.start_date IS NULL THEN
        NEW.start_date = NOW();
    END IF;
    
    -- Validate personal challenge constraints
    IF NEW.challenge_type = 'individual' THEN
        -- Personal challenges must have exactly 1 max participant
        IF NEW.max_participants != 1 THEN
            RAISE EXCEPTION 'Personal challenges must have exactly 1 participant'
                USING ERRCODE = 'check_violation';
        END IF;
        
        -- Personal challenges cannot have reward points
        IF NEW.reward_points > 0 THEN
            RAISE EXCEPTION 'Personal challenges cannot have reward points'
                USING ERRCODE = 'check_violation';
        END IF;
        
        -- Personal challenges can only be created by the user for themselves
        IF NEW.created_by != auth.uid() THEN
            RAISE EXCEPTION 'Personal challenges can only be created by the user for themselves'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    
    -- Allow team challenges to have reward points (removed restriction)
    -- Team and company challenges can have reward points
    
    RETURN NEW;
END;
$$;
