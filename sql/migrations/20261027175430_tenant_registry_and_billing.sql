-- Run once as the administrative owner, after the existing thermus_admin migrations.
-- The control plane reuses the runtime role thermus_logging: one role and one connection (27 October 2026).
BEGIN;

CREATE TABLE thermus_admin.tenants (
  organization_id text PRIMARY KEY,
  render_service_id text UNIQUE CHECK (render_service_id ~ '^srv-[a-z0-9]+$'),
  service_name text UNIQUE,
  -- The gateway connects by the private service name, never by its 10. address, which can change.
  internal_url text CHECK (internal_url ~ '^http://[a-z0-9]([a-z0-9-]*[a-z0-9])?:[0-9]{1,5}$'),
  state text NOT NULL CHECK (state IN ('requested', 'creating', 'deploying', 'live', 'suspended', 'failed', 'deleted')),
  plan text,
  applied_plan text,
  image_digest text,
  last_active_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_live_route CHECK (state <> 'live' OR (render_service_id IS NOT NULL AND internal_url IS NOT NULL))
);

CREATE TABLE thermus_admin.subscriptions (
  organization_id text PRIMARY KEY,
  stripe_customer_id text NOT NULL UNIQUE,
  stripe_subscription_id text UNIQUE,
  status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE thermus_admin.billing_events (
  stripe_event_id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);

REVOKE ALL ON TABLE thermus_admin.tenants, thermus_admin.subscriptions, thermus_admin.billing_events
  FROM PUBLIC, thermus_logging;

-- Remove Supabase API access that owner default privileges can grant.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE thermus_admin.tenants, thermus_admin.subscriptions, thermus_admin.billing_events FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END
$$;

-- UPDATE also permits the table lock that serializes tenant requests at the free-tenant cap.
GRANT SELECT, INSERT, UPDATE ON TABLE thermus_admin.tenants, thermus_admin.subscriptions, thermus_admin.billing_events
  TO thermus_logging;
ALTER TABLE thermus_admin.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermus_admin.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE thermus_admin.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermus_admin.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE thermus_admin.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermus_admin.billing_events FORCE ROW LEVEL SECURITY;

-- The trusted server role scopes each statement by organization or event in its stores.
CREATE POLICY tenants_read ON thermus_admin.tenants FOR SELECT TO thermus_logging USING (true);
CREATE POLICY tenants_insert ON thermus_admin.tenants FOR INSERT TO thermus_logging WITH CHECK (true);
CREATE POLICY tenants_update ON thermus_admin.tenants FOR UPDATE TO thermus_logging USING (true) WITH CHECK (true);
CREATE POLICY subscriptions_read ON thermus_admin.subscriptions FOR SELECT TO thermus_logging USING (true);
CREATE POLICY subscriptions_insert ON thermus_admin.subscriptions FOR INSERT TO thermus_logging WITH CHECK (true);
CREATE POLICY subscriptions_update ON thermus_admin.subscriptions FOR UPDATE TO thermus_logging
  USING (true) WITH CHECK (true);
CREATE POLICY billing_events_read ON thermus_admin.billing_events FOR SELECT TO thermus_logging USING (true);
CREATE POLICY billing_events_insert ON thermus_admin.billing_events FOR INSERT TO thermus_logging WITH CHECK (true);
CREATE POLICY billing_events_update ON thermus_admin.billing_events FOR UPDATE TO thermus_logging
  USING (true) WITH CHECK (true);

COMMIT;
