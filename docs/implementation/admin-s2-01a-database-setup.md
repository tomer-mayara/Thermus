# S2-01a database owner setup

This runbook prepares the selected existing Supabase project for hosted Audit logs
destination settings. It does not authorize a new project, plan upgrade, or unrelated data
change. The deployment operator performs setup. Customer Admins do not receive
database credentials. System logs remain internal engineering output. Slice 2
customers receive audit events through their configured organization Collector
or supported OTLP service;
this setup alone adds no delivery or in-app viewer. The existing SQL role/table and
environment names stay compatible. S2-04 must complete live rollout proof. The
owner moved settings backup, restore and key-recovery proof to future Slice 4 on
24 October 2026; Slice 2 runs without settings backups or a restore service.

## Current setup observation — 24 October 2026

The original migration and
[additive Axiom dataset migration](../../sql/migrations/20261024231921_add_logging_axiom_dataset.sql)
are applied to the selected project. `thermus_logging` now has LOGIN with the
restricted reviewed scope and no runtime DELETE or DDL. The local production
store connected through the actual pooler with verified client-to-pooler TLS and
proved reconnect persistence, tenant predicates, credential encryption/decryption,
revision conflict and bounded failure. The two exact owned fixture rows were
removed; settings rows are zero.

The official local CA is `ast-report/s2-04-rollout/supabase-ca.crt`, SHA-256
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
The missing Render CA secret file observed at about 23:37 UTC was repaired by
saving the official file and deploying approved main again. Deployment
`dep-dbek395g1s2s73frt4i0` became live at 23:39:48 UTC; startup no longer reports
storage unavailable and health was 200/ok at 23:40:10 UTC. This clears the CA
file-setup failure, but does not itself prove an actual deployed SQL operation
or the full browser/MCP journey. The [S2-04 ledger](admin-s2-04.md#evidence-and-release-holds)
records exact evidence and limits. The steps below describe initial setup. Do not reapply
the original migration or reset current credentials merely to repeat them.

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

### Add membership-removal storage before Slice 2.5 activation

S2.5-01b adds a separate private table on the same runtime and pool. Its
[migration](../../sql/migrations/20261025082850_membership_removal_operations.sql)
has not been applied by that implementation ticket. The owner must check that
the table name is unused, then apply this additive migration once after the
existing settings migrations. Do not repeat initial setup or change working
credentials. Inspect the new table's effective grants and forced RLS: the server
role may SELECT, INSERT, and UPDATE; PUBLIC and Supabase API roles must have no
access; the server must have no DELETE or DDL.

No new secret, API key, paid resource, or pool is required. Existing storage
configuration remains required even when customer export is off. A missing
table or storage outage stops removal while current product/MCP access remains
usable. Preserve pending operations and receipts during rollback. S2.5-02 must
verify actual deployment, capacity, safe recovery and restore controls before
removal activation. The [implementation record](admin-s2-5-01b.md) describes the
row contract and local proof; it does not establish live migration status.

### Add the tenant registry tables before Slice 2 self on-boarding

SO-04 of the [self on-boarding plan](self-onboarding-plan.md#43-data-model) adds
three private tables on the same runtime role and pool:
[the migration](../../sql/migrations/20261027175430_tenant_registry_and_billing.sql)
creates `tenants`, `subscriptions`, and `billing_events` in `thermus_admin`.
SO-04 has not applied it to the Supabase project; SO-12 applies it in the
production order. The owner checks that the three table names are unused, then
applies this additive migration once after the earlier migrations, with
stop-on-error enabled. Do not repeat initial setup or change working credentials.

The control plane reuses `thermus_logging` (answer of 27 October 2026): one role
and one connection. The migration creates no role and no schema. It removes
PUBLIC and any `anon`, `authenticated`, or `service_role` grants from its new
tables, grants the server role SELECT, INSERT, and UPDATE, and forces RLS with
the same open policies for that role. UPDATE also permits the
`SHARE ROW EXCLUSIVE` table lock that serializes tenant requests at the
`FREE_TENANT_LIMIT` cap. Inspect the effective grants: the server role must
have no DELETE, TRUNCATE, DDL, or ownership; tenant containers get no database
access at all.

The table checks hold the registry rules: `tenants.state` is one of the seven
states of the plan; a `live` row has its Render service ID and internal address;
the address is plain HTTP to a private service name and a port, never a numeric
address; a Render service ID starts with `srv-`. No new secret, API key, paid
resource, or pool is required. Until the gateway (SO-05) and signup (SO-07) call
the registry, the tables stay empty; a rollback of the code leaves them unused.
Local proof uses disposable PostgreSQL 17 only (`npm run test:logging:postgres`).

### Initial credentials and configuration

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
same key across deployments in protected service secret storage. This is not a
separate key backup or a settings recovery guarantee. Do not reuse WorkOS or
cookie secrets. S2-01a validates this key; S2-01b owns credential encryption and
unavailable-key handling. If settings or the key are lost, an Admin may need to
re-enter the destination and credential. Do not replace a working key during
ordinary setup; incompatible stored credentials require reviewed handling.

If the endpoint needs a dedicated official CA, obtain the correct PEM bundle
and set `DATABASE_CA_CERT_PATH` to a readable server secret-file path. Otherwise
use the platform trust store. Never disable certificate or hostname verification.
The [24 October S2-04 preflight](admin-s2-04.md#evidence-and-release-holds)
confirmed that the observed pooler needs the official Supabase CA with Node
24.20.0: default trust refused it, the official CA verified it, and a wrong
hostname was refused. Download the current certificate through the selected
project's database settings and stage its server path before activation.
Local fixture certificates and keys are test-only and must not be deployed.
No Supabase API key, `SUPABASE_URL`, Auth SDK, or CLI token is needed at runtime.

Save these values only on the existing Render Thermus service. Coordinate its
deploy with code rollout; environment updates and secret-file changes can trigger
a deploy. The 24 October environment update did so even with auto-deploy off. Missing,
partial, or invalid storage configuration leaves storage unavailable, with MCP
and admitted product access usable. There is no automatic migration, startup
SQL probe, keepalive, or polling service.

## Verify and retain rollout evidence

Before enabling Slice 2, prove the actual pooler TLS connection and restricted
role, source-contract persistence across restart, concurrent revision conflict,
tenant isolation, bounded acquisition/query failure, and MCP availability during
outage. Confirm that database size, connections, egress, and Render network use
stay within existing $0 capacity. Record only nonsecret facts and variable names.

Settings backup, storage/custody/retention, separate key recovery, and restore are
future [Slice 4 work](admin-s4-recovery.md). They are not Slice 2 prerequisites.
The retained procedure and local drill do not establish current backup or restore
capability. Slice 2 keeps no durable audit queue, archive, history, or replay;
provider residual copies are not a promised source of settings recovery.

The actual TLS/role/isolation/persistence, bounded failure, MCP-availability and
$0-capacity proofs above remain S2-04 rollout gates. Local PostgreSQL acceptance
does not satisfy them.
A pause, outage, or quota failure must stop storage-dependent writes and export;
it must not restart healthy MCP or log out all users. Resume through the owner
process and verify storage before restoring dependent functions.
