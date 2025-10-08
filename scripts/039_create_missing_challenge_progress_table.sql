-- Create the missing challenge_progress table that's needed for progress tracking
-- This table should store progress for each user in each challenge

CREATE TABLE IF NOT EXISTS challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actions_completed INTEGER DEFAULT 0,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one progress record per user per challenge
    UNIQUE(challenge_id, user_id)
);

-- Add RLS policies for challenge_progress
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own progress and progress of challenges they participate in
CREATE POLICY "challenge_progress_select_policy" ON challenge_progress
FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM challenge_participants cp 
        WHERE cp.challenge_id = challenge_progress.challenge_id 
        AND cp.user_id = auth.uid()
    )
);

-- Only system can insert/update progress (via triggers and admin functions)
CREATE POLICY "challenge_progress_insert_system_only" ON challenge_progress
FOR INSERT WITH CHECK (
    is_admin() OR current_setting('role') = 'service_role'
);

CREATE POLICY "challenge_progress_update_system_only" ON challenge_progress
FOR UPDATE USING (
    is_admin() OR current_setting('role') = 'service_role'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_challenge_progress_challenge_id ON challenge_progress(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_id ON challenge_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_last_updated ON challenge_progress(last_updated);

-- Initialize progress records for existing challenge participants
INSERT INTO challenge_progress (challenge_id, user_id, actions_completed, progress_percentage)
SELECT 
    cp.challenge_id,
    cp.user_id,
    0,
    0.00
FROM challenge_participants cp
ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- Wrapped RAISE NOTICE in DO block to fix syntax error
DO $$
BEGIN
    RAISE NOTICE 'Challenge progress table created and initialized successfully';
END $$;
