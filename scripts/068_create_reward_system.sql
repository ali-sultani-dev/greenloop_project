-- Create Level Rewards System
-- This script creates tables for managing level completion rewards

-- Table to define available rewards for each level
CREATE TABLE IF NOT EXISTS level_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 10),
    reward_title VARCHAR(255) NOT NULL,
    reward_description TEXT NOT NULL,
    reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('physical', 'digital', 'experience', 'privilege')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to track user reward claims
CREATE TABLE IF NOT EXISTS user_level_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 10),
    level_reward_id UUID NOT NULL REFERENCES level_rewards(id) ON DELETE CASCADE,
    claim_status VARCHAR(20) DEFAULT 'pending' CHECK (claim_status IN ('pending', 'approved', 'rejected', 'delivered')),
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    admin_notes TEXT,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, level, level_reward_id)
);

-- Insert sample rewards for each level
INSERT INTO level_rewards (level, reward_title, reward_description, reward_type) VALUES
-- Level 1 (100 points)
(1, 'Welcome Eco-Starter Kit', 'Reusable water bottle and eco-friendly notebook to kickstart your sustainability journey', 'physical'),
(1, 'Digital Sustainability Certificate', 'Personalized certificate recognizing your commitment to environmental action', 'digital'),

-- Level 2 (250 points)
(2, 'Bamboo Desk Organizer', 'Sustainable bamboo desk organizer to keep your workspace eco-friendly', 'physical'),
(2, 'Green Champion Badge', 'Special profile badge showcasing your environmental leadership', 'digital'),

-- Level 3 (500 points)
(3, 'Organic Cotton Tote Bag', 'Premium organic cotton tote bag with GreenLoop branding', 'physical'),
(3, 'Sustainability Workshop Access', 'Exclusive access to monthly sustainability workshops', 'experience'),

-- Level 4 (1000 points)
(4, 'Solar Power Bank', 'Portable solar-powered charger for your devices', 'physical'),
(4, 'Team Challenge Creator', 'Ability to create and lead team sustainability challenges', 'privilege'),

-- Level 5 (2000 points)
(5, 'Eco-Friendly Tech Bundle', 'Wireless charging pad made from recycled materials + bamboo phone stand', 'physical'),
(5, 'Lunch with Leadership', 'One-on-one lunch meeting with company sustainability leadership', 'experience'),

-- Level 6 (5000 points)
(6, 'Smart Garden Kit', 'Complete indoor herb garden kit with smart monitoring system', 'physical'),
(6, 'Sustainability Mentor Role', 'Become an official sustainability mentor for new employees', 'privilege'),

-- Level 7 (10000 points)
(7, 'Electric Bike Voucher', '$200 voucher towards purchasing an electric bike or scooter', 'physical'),
(7, 'Conference Speaker Opportunity', 'Opportunity to speak at company sustainability events', 'experience'),

-- Level 8 (20000 points)
(8, 'Home Energy Audit', 'Professional home energy efficiency audit and consultation', 'experience'),
(8, 'Sustainability Advisory Board', 'Invitation to join the company sustainability advisory board', 'privilege'),

-- Level 9 (50000 points)
(9, 'Renewable Energy Credit', '$500 credit towards home solar panel installation or renewable energy subscription', 'physical'),
(9, 'Industry Conference Pass', 'All-expenses-paid pass to a major sustainability conference', 'experience'),

-- Level 10 (100000+ points)
(10, 'Sustainability Innovation Fund', '$1000 grant to support a personal or community sustainability project', 'physical'),
(10, 'Executive Sustainability Advisor', 'Official role as executive sustainability advisor with quarterly strategy sessions', 'privilege');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_level_rewards_level ON level_rewards(level);
CREATE INDEX IF NOT EXISTS idx_level_rewards_active ON level_rewards(is_active);
CREATE INDEX IF NOT EXISTS idx_user_level_rewards_user_id ON user_level_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_level_rewards_status ON user_level_rewards(claim_status);
CREATE INDEX IF NOT EXISTS idx_user_level_rewards_level ON user_level_rewards(level);

-- Enable RLS
ALTER TABLE level_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_level_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for level_rewards (read-only for authenticated users)
CREATE POLICY "Users can view active level rewards" ON level_rewards
    FOR SELECT TO authenticated
    USING (is_active = true);

CREATE POLICY "Admins can manage level rewards" ON level_rewards
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- RLS Policies for user_level_rewards
CREATE POLICY "Users can view their own reward claims" ON user_level_rewards
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own reward claims" ON user_level_rewards
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all reward claims" ON user_level_rewards
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can update reward claims" ON user_level_rewards
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Function to get user's current level based on points
CREATE OR REPLACE FUNCTION get_user_current_level(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_points INTEGER;
    user_level INTEGER;
BEGIN
    -- Get total points for user
    SELECT COALESCE(SUM(points), 0) INTO total_points
    FROM point_transactions
    WHERE user_id = user_uuid;
    
    -- Determine level based on points
    CASE 
        WHEN total_points >= 100000 THEN user_level := 10;
        WHEN total_points >= 50000 THEN user_level := 9;
        WHEN total_points >= 20000 THEN user_level := 8;
        WHEN total_points >= 10000 THEN user_level := 7;
        WHEN total_points >= 5000 THEN user_level := 6;
        WHEN total_points >= 2000 THEN user_level := 5;
        WHEN total_points >= 1000 THEN user_level := 4;
        WHEN total_points >= 500 THEN user_level := 3;
        WHEN total_points >= 250 THEN user_level := 2;
        WHEN total_points >= 100 THEN user_level := 1;
        ELSE user_level := 0;
    END CASE;
    
    RETURN user_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available rewards for user's completed levels
CREATE OR REPLACE FUNCTION get_user_available_rewards(user_uuid UUID)
RETURNS TABLE (
    level INTEGER,
    reward_id UUID,
    reward_title VARCHAR(255),
    reward_description TEXT,
    reward_type VARCHAR(50),
    already_claimed BOOLEAN
) AS $$
DECLARE
    current_level INTEGER;
BEGIN
    -- Get user's current level
    SELECT get_user_current_level(user_uuid) INTO current_level;
    
    -- Return rewards for all completed levels
    RETURN QUERY
    SELECT 
        lr.level,
        lr.id as reward_id,
        lr.reward_title,
        lr.reward_description,
        lr.reward_type,
        CASE 
            WHEN ulr.id IS NOT NULL THEN true 
            ELSE false 
        END as already_claimed
    FROM level_rewards lr
    LEFT JOIN user_level_rewards ulr ON (
        lr.id = ulr.level_reward_id 
        AND ulr.user_id = user_uuid
    )
    WHERE lr.level <= current_level 
    AND lr.is_active = true
    ORDER BY lr.level ASC, lr.reward_title ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON level_rewards TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_level_rewards TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_current_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_available_rewards(UUID) TO authenticated;
