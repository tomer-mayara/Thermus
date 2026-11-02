-- Run once as the administrative owner, after 20261102161257_tenant_organization_name.sql and before the deploy of the
-- control plane that keeps the record of each removed member. Free access refuses an account whose only membership an
-- Admin removed (rule of 2 November 2026): WorkOS keeps no record of a deleted membership, so the removal writes the
-- row of the removed member before the deletion, and signup reads it. One row for each removed membership; the row has
-- no expiry. Without the table, member removal and the signup of a new account answer unavailable.
BEGIN;

CREATE TABLE thermus_admin.removed_members (
  membership_id text PRIMARY KEY,
  organization_id text NOT NULL,
  authority text NOT NULL,
  subject text NOT NULL,
  operation_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL
);
-- Signup reads by the identity of the signed-in user.
CREATE INDEX removed_members_identity ON thermus_admin.removed_members (authority, subject);

REVOKE ALL ON TABLE thermus_admin.removed_members FROM PUBLIC, thermus_logging;

-- Remove Supabase API access that owner default privileges can grant.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE thermus_admin.removed_members FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;

-- The removal inserts the row and signup reads it; no statement of the control plane changes or deletes a row.
GRANT SELECT, INSERT ON TABLE thermus_admin.removed_members TO thermus_logging;
ALTER TABLE thermus_admin.removed_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermus_admin.removed_members FORCE ROW LEVEL SECURITY;

-- The trusted server role names the membership in each insert and the identity in each read.
CREATE POLICY removed_members_read ON thermus_admin.removed_members FOR SELECT TO thermus_logging USING (true);
CREATE POLICY removed_members_insert ON thermus_admin.removed_members FOR INSERT TO thermus_logging WITH CHECK (true);

COMMIT;
