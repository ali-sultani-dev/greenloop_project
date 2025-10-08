-- Completely redesigned to work with existing database schema
-- Complete GreenLoop Platform Schema Updates
-- This script adds missing indexes and optimizations to existing tables

-- Add performance indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_users_points ON users(points);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_teams_team_leader_id ON teams(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_total_points ON teams(total_points);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

CREATE INDEX IF NOT EXISTS idx_challenges_challenge_type ON challenges(challenge_type);
CREATE INDEX IF NOT EXISTS idx_challenges_start_date ON challenges(start_date);
CREATE INDEX IF NOT EXISTS idx_challenges_end_date ON challenges(end_date);
CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON challenges(created_by);

CREATE INDEX IF NOT EXISTS idx_user_actions_verification_status ON user_actions(verification_status);
CREATE INDEX IF NOT EXISTS idx_user_actions_completed_at ON user_actions(completed_at);

CREATE INDEX IF NOT EXISTS idx_sustainability_actions_category_id ON sustainability_actions(category_id);
CREATE INDEX IF NOT EXISTS idx_sustainability_actions_difficulty ON sustainability_actions(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_sustainability_actions_active ON sustainability_actions(is_active);

CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_news_articles_featured ON news_articles(is_featured);

CREATE INDEX IF NOT EXISTS idx_point_transactions_transaction_type ON point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_reference_type ON point_transactions(reference_type);

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_actions_user_status ON user_actions(user_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_completed ON challenge_participants(challenge_id, completed);
CREATE INDEX IF NOT EXISTS idx_team_members_team_role ON team_members(team_id, role);

-- Create views for common admin queries
CREATE OR REPLACE VIEW admin_user_stats AS
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.department,
  u.points,
  u.level,
  u.total_co2_saved,
  u.is_active,
  u.is_admin,
  COUNT(ua.id) as total_actions,
  COUNT(CASE WHEN ua.verification_status = 'verified' THEN 1 END) as verified_actions,
  tm.team_id,
  t.name as team_name
FROM users u
LEFT JOIN user_actions ua ON u.id = ua.user_id
LEFT JOIN team_members tm ON u.id = tm.user_id
LEFT JOIN teams t ON tm.team_id = t.id
GROUP BY u.id, tm.team_id, t.name;

CREATE OR REPLACE VIEW admin_challenge_stats AS
SELECT 
  c.id,
  c.title,
  c.challenge_type,
  c.target_metric,
  c.target_value,
  c.reward_points,
  c.start_date,
  c.end_date,
  c.is_active,
  COUNT(cp.id) as total_participants,
  COUNT(CASE WHEN cp.completed = true THEN 1 END) as completed_count,
  AVG(cp.current_progress) as avg_progress
FROM challenges c
LEFT JOIN challenge_participants cp ON c.id = cp.challenge_id
GROUP BY c.id;

CREATE OR REPLACE VIEW admin_team_stats AS
SELECT 
  t.id,
  t.name,
  t.description,
  t.team_leader_id,
  u.first_name || ' ' || u.last_name as leader_name,
  t.total_points,
  t.total_co2_saved,
  t.max_members,
  COUNT(tm.id) as current_members,
  t.is_active
FROM teams t
LEFT JOIN users u ON t.team_leader_id = u.id
LEFT JOIN team_members tm ON t.id = tm.team_id
GROUP BY t.id, u.first_name, u.last_name;

-- Create function to calculate user level based on points
CREATE OR REPLACE FUNCTION calculate_user_level(user_points INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE 
    WHEN user_points < 100 THEN 1
    WHEN user_points < 250 THEN 2
    WHEN user_points < 500 THEN 3
    WHEN user_points < 1000 THEN 4
    WHEN user_points < 2000 THEN 5
    WHEN user_points < 5000 THEN 6
    WHEN user_points < 10000 THEN 7
    WHEN user_points < 20000 THEN 8
    WHEN user_points < 50000 THEN 9
    ELSE 10
  END;
END;
$$ LANGUAGE plpgsql;

-- Create function to update user level when points change
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.level = calculate_user_level(NEW.points);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update user level
DROP TRIGGER IF EXISTS trigger_update_user_level ON users;
CREATE TRIGGER trigger_update_user_level
  BEFORE UPDATE OF points ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_level();

-- Add helpful functions for admin operations
CREATE OR REPLACE FUNCTION get_user_activity_summary(p_user_id UUID)
RETURNS TABLE(
  total_actions BIGINT,
  verified_actions BIGINT,
  pending_actions BIGINT,
  total_points INTEGER,
  total_co2_saved NUMERIC,
  current_level INTEGER,
  badges_earned BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(ua.id) as total_actions,
    COUNT(CASE WHEN ua.verification_status = 'verified' THEN 1 END) as verified_actions,
    COUNT(CASE WHEN ua.verification_status = 'pending' THEN 1 END) as pending_actions,
    u.points as total_points,
    u.total_co2_saved,
    u.level as current_level,
    COUNT(ub.id) as badges_earned
  FROM users u
  LEFT JOIN user_actions ua ON u.id = ua.user_id
  LEFT JOIN user_badges ub ON u.id = ub.user_id
  WHERE u.id = p_user_id
  GROUP BY u.id, u.points, u.total_co2_saved, u.level;
END;
$$ LANGUAGE plpgsql;
