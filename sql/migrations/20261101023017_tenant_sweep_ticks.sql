-- Run once as the administrative owner, after 20261031221342_tenant_claim_lease.sql and before the deploy of the
-- control plane that claims the ticks of the tenant sweeps.
-- Render keeps the old instance of the control plane for about 120 s after a new deploy is live (SO-12 release
-- rehearsal of 31 October 2026), so the daily tick of the tenant sweeps can come in two instances. Each instance
-- inserts the row of the tick before its steps, and only the instance whose insert adds the row runs them. One row a
-- day stays as the record of the instance that ran the tick.
BEGIN;

CREATE TABLE thermus_admin.tenant_sweep_ticks (
  tick_at timestamptz PRIMARY KEY,
  claimed_by text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE thermus_admin.tenant_sweep_ticks FROM PUBLIC, thermus_logging;

-- Remove Supabase API access that owner default privileges can grant.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE thermus_admin.tenant_sweep_ticks FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;

-- The claim inserts the row and reads back its key; no statement of the control plane changes or deletes a claim.
GRANT SELECT, INSERT ON TABLE thermus_admin.tenant_sweep_ticks TO thermus_logging;
ALTER TABLE thermus_admin.tenant_sweep_ticks ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermus_admin.tenant_sweep_ticks FORCE ROW LEVEL SECURITY;

-- The trusted server role names the tick in each claim.
CREATE POLICY tenant_sweep_ticks_read ON thermus_admin.tenant_sweep_ticks FOR SELECT TO thermus_logging USING (true);
CREATE POLICY tenant_sweep_ticks_insert ON thermus_admin.tenant_sweep_ticks FOR INSERT TO thermus_logging WITH CHECK (true);

COMMIT;
