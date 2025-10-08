-- Completely rewritten to handle dual key/setting_key column situation
-- Admin Panel Schema Updates - Handling dual column situation
-- This script consolidates key/setting_key columns and ensures data integrity

DO $$
BEGIN
    --------------------------------------------------------------------
    -- 1️⃣  Create the table if it does not exist
    --------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'system_settings'
    ) THEN
        CREATE TABLE system_settings (
            id         UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
            key        VARCHAR(100) UNIQUE,   -- add without NOT NULL for now
            setting_value      TEXT,
            description TEXT,
            category   VARCHAR(50) DEFAULT 'general',
            data_type  VARCHAR(20) DEFAULT 'string',
            is_public  BOOLEAN    DEFAULT false,
            updated_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;

    --------------------------------------------------------------------
    -- 2️⃣  Add missing columns (all added as nullable first)
    --------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='system_settings' AND column_name='key')
    THEN
        ALTER TABLE system_settings ADD COLUMN key VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='system_settings' AND column_name='setting_value')
    THEN
        ALTER TABLE system_settings ADD COLUMN setting_value TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='system_settings' AND column_name='description')
    THEN
        ALTER TABLE system_settings ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='system_settings' AND column_name='category')
    THEN
        ALTER TABLE system_settings ADD COLUMN category VARCHAR(50) DEFAULT 'general';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='system_settings' AND column_name='data_type')
    THEN
        ALTER TABLE system_settings ADD COLUMN data_type VARCHAR(20) DEFAULT 'string';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='system_settings' AND column_name='is_public')
    THEN
        ALTER TABLE system_settings ADD COLUMN is_public BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='system_settings' AND column_name='updated_by')
    THEN
        ALTER TABLE system_settings ADD COLUMN updated_by UUID REFERENCES users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='system_settings' AND column_name='created_at')
    THEN
        ALTER TABLE system_settings ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='system_settings' AND column_name='updated_at')
    THEN
        ALTER TABLE system_settings ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    --------------------------------------------------------------------
    -- 3️⃣  Consolidate setting_key into key column if both exist
    --------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='system_settings' AND column_name='setting_key')
    THEN
        -- Copy data from setting_key to key where key is null
        UPDATE system_settings
        SET key = setting_key
        WHERE key IS NULL AND setting_key IS NOT NULL;
        
        -- Drop the redundant setting_key column
        ALTER TABLE system_settings DROP COLUMN IF EXISTS setting_key;
    END IF;

    --------------------------------------------------------------------
    -- 4️⃣  Clean up any rows that have a NULL key
    --------------------------------------------------------------------
    UPDATE system_settings
    SET key = 'auto_' || id
    WHERE key IS NULL;

    --------------------------------------------------------------------
    -- 5️⃣  Enforce constraints after the data is safe
    --------------------------------------------------------------------
    -- Add NOT NULL constraint (if not already present)
    BEGIN
        ALTER TABLE system_settings ALTER COLUMN key SET NOT NULL;
    EXCEPTION
        WHEN others THEN NULL; -- Ignore if already set
    END;

    -- Ensure the column is unique (skip if already a unique index)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'system_settings'::regclass
          AND contype = 'u'
          AND conname = 'system_settings_key_key'
    ) THEN
        ALTER TABLE system_settings ADD CONSTRAINT system_settings_key_key UNIQUE (key);
    END IF;
END $$;

-- Updated INSERT to use proper column names and handle conflicts
-- Insert default system settings only if they don't exist
INSERT INTO system_settings (key, setting_value, description, is_public, category, data_type) VALUES
  ('platform_name', 'GreenLoop', 'Name of the platform', true, 'general', 'string'),
  ('max_file_upload_size', '10485760', 'Maximum file upload size in bytes (10MB)', false, 'general', 'number'),
  ('maintenance_mode', 'false', 'Enable maintenance mode', true, 'general', 'boolean'),
  ('user_registration_enabled', 'true', 'Allow new user registrations', true, 'users', 'boolean'),
  ('default_points_per_action', '10', 'Default points awarded per sustainability action', false, 'gamification', 'number'),
  ('email_notifications_enabled', 'true', 'Enable email notifications', false, 'notifications', 'boolean'),
  ('challenge_auto_approval', 'false', 'Automatically approve new challenges', false, 'challenges', 'boolean'),
  ('team_creation_enabled', 'true', 'Allow users to create teams', true, 'teams', 'boolean')
ON CONFLICT (key) DO NOTHING;

-- Added performance indexes
-- Add performance indexes that might be missing
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_data_type ON system_settings(data_type);

-- Conditionally create indexes only if tables exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_permissions') THEN
        CREATE INDEX IF NOT EXISTS idx_admin_permissions_active ON admin_permissions(is_active) WHERE is_active = true;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_audit_log') THEN
        CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action_type);
        CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_table, target_id);
    END IF;
END $$;

-- Updated function to work with existing schema
-- Create function to log admin activities using existing admin_audit_log table
CREATE OR REPLACE FUNCTION log_admin_activity(
  p_admin_id UUID,
  p_action VARCHAR(100),
  p_target_type VARCHAR(50) DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_audit_log') THEN
    INSERT INTO admin_audit_log (admin_user_id, action_type, target_table, target_id, new_values)
    VALUES (p_admin_id, p_action, p_target_type, p_target_id, p_details)
    RETURNING id INTO log_id;
    
    RETURN log_id;
  ELSE
    RETURN NULL; -- Table doesn't exist, skip logging
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
