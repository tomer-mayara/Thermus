-- Run once as the administrative owner, after checking for name collisions.
-- Provision the runtime password separately; never put it in this file.
BEGIN;

CREATE ROLE thermus_logging NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS NOINHERIT;
CREATE SCHEMA thermus_admin;
REVOKE ALL ON SCHEMA thermus_admin FROM PUBLIC;

CREATE TABLE thermus_admin.logging_destination_settings (
  tenant_id text PRIMARY KEY,
  revision uuid NOT NULL,
  endpoint text NOT NULL,
  auth text NOT NULL CHECK (auth IN ('none', 'bearer')),
  enabled boolean NOT NULL,
  encrypted_credential text,
  CONSTRAINT logging_destination_credential_shape CHECK (
    (auth = 'none' AND encrypted_credential IS NULL)
    OR (auth = 'bearer' AND encrypted_credential IS NOT NULL)
  )
);
REVOKE ALL ON TABLE thermus_admin.logging_destination_settings FROM PUBLIC;

-- Supabase can give these roles access through owner default privileges.
-- Remove access only from the objects that this transaction creates.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA thermus_admin FROM %I', api_role);
      EXECUTE format(
        'REVOKE ALL ON TABLE thermus_admin.logging_destination_settings FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END
$$;

GRANT USAGE ON SCHEMA thermus_admin TO thermus_logging;
GRANT SELECT, INSERT, UPDATE ON TABLE thermus_admin.logging_destination_settings
  TO thermus_logging;
ALTER TABLE thermus_admin.logging_destination_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermus_admin.logging_destination_settings FORCE ROW LEVEL SECURITY;

-- This is a trusted server role. The store contract scopes each query by tenant.
CREATE POLICY logging_destination_read
  ON thermus_admin.logging_destination_settings FOR SELECT TO thermus_logging
  USING (true);
CREATE POLICY logging_destination_insert
  ON thermus_admin.logging_destination_settings FOR INSERT TO thermus_logging
  WITH CHECK (true);
CREATE POLICY logging_destination_update
  ON thermus_admin.logging_destination_settings FOR UPDATE TO thermus_logging
  USING (true) WITH CHECK (true);

COMMIT;
