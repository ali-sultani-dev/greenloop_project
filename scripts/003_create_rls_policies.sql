-- GreenLoop Database Schema - Row Level Security Policies
-- This script creates comprehensive RLS policies for data protection

-- =============================================
-- USER MANAGEMENT POLICIES
-- =============================================

-- Users table policies
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to view other users' basic info (for teams, leaderboards)
CREATE POLICY "users_select_public_info" ON public.users
  FOR SELECT USING (TRUE);

-- User sessions - users can only see their own sessions
CREATE POLICY "user_sessions_select_own" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_sessions_insert_own" ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_sessions_delete_own" ON public.user_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Password resets - users can only access their own
CREATE POLICY "password_resets_select_own" ON public.password_resets
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- ACTION SYSTEM POLICIES
-- =============================================

-- Action categories - readable by all authenticated users
CREATE POLICY "action_categories_select_all" ON public.action_categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- Sustainability actions - readable by all authenticated users
CREATE POLICY "sustainability_actions_select_all" ON public.sustainability_actions
  FOR SELECT USING (auth.role() = 'authenticated');

-- User actions - users can manage their own actions
CREATE POLICY "user_actions_select_own" ON public.user_actions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_actions_insert_own" ON public.user_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_actions_update_own" ON public.user_actions
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow viewing other users' actions for leaderboards and team stats
CREATE POLICY "user_actions_select_public" ON public.user_actions
  FOR SELECT USING (verification_status = 'approved');

-- Action attachments - users can manage their own attachments
CREATE POLICY "action_attachments_select_own" ON public.action_attachments
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_actions WHERE id = user_action_id
    )
  );

CREATE POLICY "action_attachments_insert_own" ON public.action_attachments
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.user_actions WHERE id = user_action_id
    )
  );

-- =============================================
-- GAMIFICATION POLICIES
-- =============================================

-- Badges - readable by all authenticated users
CREATE POLICY "badges_select_all" ON public.badges
  FOR SELECT USING (auth.role() = 'authenticated');

-- User badges - users can view their own and others' badges
CREATE POLICY "user_badges_select_all" ON public.user_badges
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "user_badges_insert_own" ON public.user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Point transactions - users can view their own transactions
CREATE POLICY "point_transactions_select_own" ON public.point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "point_transactions_insert_own" ON public.point_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- TEAM SYSTEM POLICIES
-- =============================================

-- Teams - readable by all authenticated users
CREATE POLICY "teams_select_all" ON public.teams
  FOR SELECT USING (auth.role() = 'authenticated');

-- Team creation - any authenticated user can create teams
CREATE POLICY "teams_insert_authenticated" ON public.teams
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = team_leader_id);

-- Team updates - only team leaders can update their teams
CREATE POLICY "teams_update_leader" ON public.teams
  FOR UPDATE USING (auth.uid() = team_leader_id);

-- Team members - readable by all, manageable by team leaders and members themselves
CREATE POLICY "team_members_select_all" ON public.team_members
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "team_members_insert_own_or_leader" ON public.team_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT team_leader_id FROM public.teams WHERE id = team_id)
  );

CREATE POLICY "team_members_delete_own_or_leader" ON public.team_members
  FOR DELETE USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT team_leader_id FROM public.teams WHERE id = team_id)
  );

-- =============================================
-- CHALLENGE SYSTEM POLICIES
-- =============================================

-- Challenges - readable by all authenticated users
CREATE POLICY "challenges_select_all" ON public.challenges
  FOR SELECT USING (auth.role() = 'authenticated');

-- Challenge creation - any authenticated user can create challenges
CREATE POLICY "challenges_insert_authenticated" ON public.challenges
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);

-- Challenge updates - only creators can update their challenges
CREATE POLICY "challenges_update_creator" ON public.challenges
  FOR UPDATE USING (auth.uid() = created_by);

-- Challenge participants - users can manage their own participation
CREATE POLICY "challenge_participants_select_all" ON public.challenge_participants
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "challenge_participants_insert_own" ON public.challenge_participants
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT user_id FROM public.team_members WHERE team_id = challenge_participants.team_id
    )
  );

CREATE POLICY "challenge_participants_update_own" ON public.challenge_participants
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT user_id FROM public.team_members WHERE team_id = challenge_participants.team_id
    )
  );

-- =============================================
-- CONTENT POLICIES
-- =============================================

-- News articles - published articles readable by all, all articles readable by admins
CREATE POLICY "news_articles_select_published" ON public.news_articles
  FOR SELECT USING (is_published = true);

-- User analytics - users can only see their own analytics
CREATE POLICY "user_analytics_select_own" ON public.user_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_analytics_insert_own" ON public.user_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- System settings - public settings readable by all
CREATE POLICY "system_settings_select_public" ON public.system_settings
  FOR SELECT USING (is_public = true);

-- =============================================
-- ADMIN POLICIES
-- =============================================

-- Admin permissions - users can view their own permissions
CREATE POLICY "admin_permissions_select_own" ON public.admin_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin audit log - only viewable by super admins (handled in application logic)
CREATE POLICY "admin_audit_log_select_admin" ON public.admin_audit_log
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_permissions 
      WHERE permission_type = 'super_admin' AND is_active = true
    )
  );
