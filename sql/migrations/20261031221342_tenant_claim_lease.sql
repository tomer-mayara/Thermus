-- Run once as the administrative owner, after 20261027175430_tenant_registry_and_billing.sql and before the deploy of
-- the control plane that claims with a lease.
-- The SO-12 release rehearsal of 31 October 2026 found two provisioner loops on one registry during each deploy of the
-- control plane: Render keeps the old instance for about 120 s after the new deploy is live. The claim of a row now
-- holds it for one loop until claimed_until, and the loop renews the time while it works on the row, so a second loop
-- never takes a row in work. Both columns are empty when no loop holds the row.
BEGIN;

ALTER TABLE thermus_admin.tenants
  ADD COLUMN claimed_by text,
  ADD COLUMN claimed_until timestamptz,
  ADD CONSTRAINT tenants_claim_pair CHECK ((claimed_by IS NULL) = (claimed_until IS NULL));

COMMIT;
