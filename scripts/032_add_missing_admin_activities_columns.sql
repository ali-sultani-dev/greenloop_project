-- 1. Create the table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS admin_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    action_type VARCHAR NOT NULL,
    target_type VARCHAR NOT NULL,
    target_id UUID,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add missing columns (only if they don’t already exist)
ALTER TABLE admin_activities 
    ADD COLUMN IF NOT EXISTS details JSONB,
    ADD COLUMN IF NOT EXISTS ip_address INET,
    ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 3. Add/Update comments
COMMENT ON TABLE admin_activities IS 'Tracks all administrative activities for audit purposes';
COMMENT ON COLUMN admin_activities.details IS 'Additional structured data about the activity';
COMMENT ON COLUMN admin_activities.ip_address IS 'IP address of the admin performing the action';
COMMENT ON COLUMN admin_activities.user_agent IS 'User agent string of the admin browser';