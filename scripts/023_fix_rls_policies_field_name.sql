-- Fix RLS policies to use correct field name is_admin instead of isadmin
-- This corrects the field name mismatch that was preventing admin operations

-- Drop existing policies with incorrect field name
DROP POLICY IF EXISTS "sustainability_actions_insert_admin" ON sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_update_admin" ON sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_delete_admin" ON sustainability_actions;
DROP POLICY IF EXISTS "action_categories_insert_admin" ON action_categories;
DROP POLICY IF EXISTS "action_categories_update_admin" ON action_categories;
DROP POLICY IF EXISTS "action_categories_delete_admin" ON action_categories;

-- Create new policies using correct field name is_admin
CREATE POLICY "sustainability_actions_insert_admin" ON sustainability_actions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "sustainability_actions_update_admin" ON sustainability_actions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "sustainability_actions_delete_admin" ON sustainability_actions
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Also fix action_categories policies
CREATE POLICY "action_categories_insert_admin" ON action_categories
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "action_categories_update_admin" ON action_categories
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "action_categories_delete_admin" ON action_categories
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );
