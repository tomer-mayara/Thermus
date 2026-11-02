-- Run once as the administrative owner, after 20261101023017_tenant_sweep_ticks.sql and before the deploy of the
-- control plane that stores the organization name.
-- The owner wants the organization name in the name of the Render service of a tenant from hosted signup (2 November
-- 2026). The tenant request of hosted signup stores the name of the new organization in its row, and at the claim the
-- provisioner puts the slug of that name before the organization ID in the service name. A row without a name keeps
-- the service name of the ID alone. The check refuses an empty name: a row has a name with text, or no name.
-- An older control plane works with this column, but a control plane that stores the name fails each tenant request
-- and each claim until the column exists.
BEGIN;

ALTER TABLE thermus_admin.tenants ADD COLUMN organization_name text CHECK (organization_name <> '');

COMMIT;
