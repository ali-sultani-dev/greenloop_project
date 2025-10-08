-- Comprehensive Admin Activities Restoration Script
-- This script restores all removed admin_activities functionality

-- 1. Update column types (remove length constraints)
ALTER TABLE "public"."admin_activities" 
ALTER COLUMN "action_type" TYPE character varying,
ALTER COLUMN "target_type" TYPE character varying;

-- 2. Add foreign key constraint
ALTER TABLE ONLY "public"."admin_activities"
ADD CONSTRAINT "admin_activities_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

-- 3. Create all indexes for admin_activities
CREATE INDEX IF NOT EXISTS "idx_admin_activities_action_type" ON "public"."admin_activities" USING "btree" ("action_type");
CREATE INDEX IF NOT EXISTS "idx_admin_activities_admin_id" ON "public"."admin_activities" USING "btree" ("admin_id");
CREATE INDEX IF NOT EXISTS "idx_admin_activities_created_at" ON "public"."admin_activities" USING "btree" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_admin_activities_target" ON "public"."admin_activities" USING "btree" ("target_type", "target_id");

-- 4. Enable RLS on admin_activities
ALTER TABLE "public"."admin_activities" ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for admin_activities
CREATE POLICY "Admins can insert admin activities" ON "public"."admin_activities" FOR INSERT WITH CHECK (
  (EXISTS ( SELECT 1
    FROM "public"."users"
    WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))) AND ("admin_id" = "auth"."uid"())
);

CREATE POLICY "Admins can view all admin activities" ON "public"."admin_activities" FOR SELECT USING (
  (EXISTS ( SELECT 1
    FROM "public"."users"
    WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true))))
);

-- 6. Add tables to supabase_realtime publication
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."admin_activities";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."admin_permissions";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."badges";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."content_items";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."point_transactions";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."security_audit_log";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_analytics";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."users";

-- 7. Recreate user action triggers
CREATE OR REPLACE TRIGGER "on_user_action_badge_check" AFTER INSERT OR UPDATE ON "public"."user_actions" FOR EACH ROW WHEN (("new"."verification_status" = 'approved'::text)) EXECUTE FUNCTION "public"."check_and_award_badges"();

CREATE OR REPLACE TRIGGER "on_user_action_for_team_stats" AFTER INSERT OR UPDATE ON "public"."user_actions" FOR EACH ROW WHEN (("new"."verification_status" = 'approved'::text)) EXECUTE FUNCTION "public"."update_team_stats"();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Admin activities restoration completed successfully!';
    RAISE NOTICE 'Restored: column types, foreign keys, indexes, RLS policies, realtime publications, and triggers';
END $$;
