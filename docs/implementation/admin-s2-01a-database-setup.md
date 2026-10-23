# S2-01a database owner setup

This runbook prepares the selected existing Supabase project for hosted logging
settings. It does not authorize a new project, plan upgrade, or unrelated data
change. The deployment operator performs setup. Customer Admins do not receive
database credentials. S2-04 must complete the live rollout and recovery proof.

## Review scope before applying SQL

1. Confirm project `rnqktgtgrvvqptbaosth` (Thermus AI), its current Free status,
   usage, and isolation feasibility. Keep added cost at $0. Recheck the current
   project connection details in its authenticated dashboard.
2. As the administrative owner, inspect existing schemas, tables, and roles.
   Names `thermus_admin` and `thermus_logging` must be unused. Stop on a
   collision; do not rename, overwrite, or adopt another application's objects.
3. Review [the migration](../../sql/migrations/20261023211956_logging_destination_settings.sql).
   Apply it once through the owner's secure SQL session with stop-on-error
   enabled. It creates only the private schema, settings table, runtime role,
   grants, and policies. The transaction rolls back on failure. It does not
   revoke database-wide privileges, change existing data, or alter default
   privileges for future objects.
4. Inspect the resulting ownership, grants, and RLS policies. The runtime role
   must have no ownership, DELETE, DDL, elevated role attributes, or unrelated
   object access. Check inherited or PUBLIC privileges in the actual project.
   Resolve unexpected access with a scoped reviewed change before rollout.

The role starts with NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE,
NOREPLICATION, and NOBYPASSRLS. The migration removes PUBLIC and any existing
`anon`, `authenticated`, or `service_role` grants from its new objects only.
Forced RLS permits SELECT, INSERT, and UPDATE for the trusted server role.
Tenant checks belong to the server store contract; this role is not a tenant
identity and must never be given to a browser or customer.

## Provision server secrets

Use a secure owner session to assign a new independent password to
`thermus_logging` and enable LOGIN. Use the database client's protected password
prompt or the existing secret-management process. Do not place the password in
SQL files, command arguments, shell history, chat, Git, or logs. Keep owner
credentials out of the application. Store the runtime password in the existing
password manager and recovery process.

In Connect → Session pooler, confirm the selected project's endpoint. The prior
owner inspection reported `aws-1-us-west-2.pooler.supabase.com`, port `5432`,
database `postgres`. Recheck these values before use. The pooler user for this
role is `thermus_logging.rnqktgtgrvvqptbaosth`. Set `DATABASE_URL` to a full
PostgreSQL URI with this user and its URL-encoded password, host, port, and
database. Do not use the HTTPS API URL. Do not add query parameters or a
fragment, including SSL options. The app sets verified TLS explicitly.

Generate an independent random 32-byte key locally, for example with
`openssl rand -base64 32`, and place it directly in protected secret storage.
Set `LOGGING_DESTINATION_ENCRYPTION_KEY` to its canonical base64 value. Keep the
same key across deployments and back it up separately from the database.
Do not reuse WorkOS or cookie secrets. S2-01a validates this key; S2-01b owns
credential encryption and recovery behavior.

If the endpoint needs a dedicated official CA, obtain the correct PEM bundle
and set `DATABASE_CA_CERT_PATH` to a readable server secret-file path. Otherwise
use the platform trust store. Never disable certificate or hostname verification.
Local fixture certificates and keys are test-only and must not be deployed.
No Supabase API key, `SUPABASE_URL`, Auth SDK, or CLI token is needed at runtime.

Stage these values only on the existing Render Thermus service. Coordinate its
deploy with code rollout; a secret-file change can trigger a deploy. Missing,
partial, or invalid storage configuration leaves storage unavailable, with MCP
and admitted product access usable. There is no automatic migration, startup
SQL probe, keepalive, or polling service.

## Verify and retain rollout evidence

Before enabling Slice 2, prove the actual pooler TLS connection and restricted
role, source-contract persistence across restart, concurrent revision conflict,
tenant isolation, bounded acquisition/query failure, and MCP availability during
outage. Confirm that database size, connections, egress, and Render network use
stay within existing $0 capacity. Record only nonsecret facts and variable names.

Assign an owner, cadence, and retention for encrypted logical backups of this
private schema and its required role/grants to existing operator-owned storage
outside the project. Preserve the encryption key separately. Drill a scoped
restore without exporting or replacing another application's data. Before
restore, stop export dispatch and clear pending in-memory work. Restored export
must stay disabled until an Admin reviews and explicitly enables the destination.

These are S2-04 rollout gates. Local PostgreSQL acceptance does not satisfy them.
A pause, outage, or quota failure must stop storage-dependent writes and export;
it must not restart healthy MCP or log out all users. Resume through the owner
process and verify storage before restoring dependent functions.
