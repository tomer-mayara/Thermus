BEGIN;

CREATE TABLE thermus_admin.membership_removal_operations (
  organization_id text PRIMARY KEY,
  operation_id uuid NOT NULL,
  membership_id text NOT NULL,
  revision text NOT NULL,
  actor_authority text NOT NULL,
  actor_subject text NOT NULL,
  started_at timestamptz NOT NULL,
  outcome text CHECK (outcome IN ('applied', 'no-effect'))
);
REVOKE ALL ON TABLE thermus_admin.membership_removal_operations FROM PUBLIC, thermus_logging;

-- Remove Supabase API access that owner default privileges can grant.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE thermus_admin.membership_removal_operations FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE ON TABLE thermus_admin.membership_removal_operations
  TO thermus_logging;
ALTER TABLE thermus_admin.membership_removal_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermus_admin.membership_removal_operations FORCE ROW LEVEL SECURITY;

-- The trusted server role scopes each statement by organization and operation.
CREATE POLICY membership_removal_read
  ON thermus_admin.membership_removal_operations FOR SELECT TO thermus_logging
  USING (true);
CREATE POLICY membership_removal_insert
  ON thermus_admin.membership_removal_operations FOR INSERT TO thermus_logging
  WITH CHECK (true);
CREATE POLICY membership_removal_update
  ON thermus_admin.membership_removal_operations FOR UPDATE TO thermus_logging
  USING (true) WITH CHECK (true);

COMMIT;
