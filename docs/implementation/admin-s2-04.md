# S2-04 integrated audit verification and rollout

This development candidate is stacked on S2-03c in
[PR #244](https://github.com/tomer-mayara/Thermus/pull/244). It prepares the
[integrated verification and owner release work](../design/organization-admin-plan.md#s2-04--integrated-proof-owner-rollout-and-release).
Source implementation, controlled proof, owner setup, and release are separate
claims. This record does not mark S2-04 done or authorize deployment.

The public browser, MCP, and Collector journey characterizes existing behavior.
The missing export help was specified by failing acceptance and focused unit
tests before its implementation. The procedures below add no runtime behavior
or backup framework.

## Development proof

- The dedicated Collector gate passes all nine cases, including the integrated
  password-Admin browser journey: disabled Save, one saved Test, Enable, an
  activity-triggered snapshot load, subsequent MCP and invitation actions, and
  six expected Collector records. It checks full product results against bounded,
  redacted audit copies and content-free defined system records. WorkOS, storage,
  and tool operations are controlled; DNS, verified TLS, sender, and Collector
  receipt are real on an isolated Docker network. Inherited specifications cover
  default hosted composition and the separate failure matrices.
- The new visible help has acceptance and unit red/green evidence. Local Chromium
  checks cover protected Admin navigation, labels, keyboard and emulated touch,
  Save/Test, a blank saved-token field, safe errors, and widths 1200, 390, and
  320 pixels. The manager inspected desktop and mobile captures. This is not
  live-provider proof, a physical-device run, or a full accessibility audit.
- The precommit complete-candidate run passed 4,704 ordinary backend tests, 49
  portal tests, type checking, the portal build, 12 real PostgreSQL cases, and
  the nine Collector cases. The PR and `ast-report/s2-04-final/README.md` retain
  the final candidate SHA, selected container/build gates, quality results,
  architecture review, and remaining holds. Test execution used the working
  source that is committed in this candidate; the evidence retains that timing.

Development evidence is under `ast-report/s2-04-development/`; complete-candidate
results are under `ast-report/s2-04-final/`. These records do not mark the ticket
Done or supply owner, legal, human-review, or rollout approval.

## Evidence and release holds

| Obligation | Development evidence | Actual owner or release evidence still needed |
| --- | --- | --- |
| Settings, capture, Test, and delivery | S2-01a/b, S2-02a/b, and S2-03a/b/c have linked implementation records in the plan. Integrated controlled proof is recorded by the candidate review. | Deployed current-Admin browser/MCP journey and receipt at the intended actual Collector. A controlled receiver does not prove that destination. |
| SQL setup and verified TLS | Reviewed scoped migration and local PostgreSQL fixtures. Official-CA pooler TLS and hostname verification passed without SQL authentication. | Selected project's actual restricted-role login and grants, inherited/PUBLIC access, deployed CA path, persistence across restart, and isolation from unrelated application data. |
| Recovery | Disposable local procedure drill described below. | Named backup owner, selected existing outside-project storage, separate key recovery location, confirmed access, cadence/retention, and actual scoped backup/restore proof. |
| $0 capacity | Read-only inventory confirms the Free organization, current dashboard usage, and a point-in-time database/session sample. | Realistic load headroom for database size, connections, egress, Render network use, and existing backup storage capacity. No new cost is approved. |
| Notice and help | [Slice 2 notice review](admin-s2-04-notice-review.md) identifies current data flows and disclosure differences. | Owner approval of complete changed notice/help bytes, versions and hashes, publication scope, and actual presentation verification. Historical Slice 1 approval does not cover these differences. |
| Slice 1 release | Approved organization legal package and published public policies are recorded in [Staging release verification](admin-s1-staging-release-verification.md). A fresh Render readback identifies the deployed S1 candidate below. | Actual runtime release/cutover and disposition of native invitation limitations and deferred mailbox checks. Public policy publication is not runtime release. |
| Complete-candidate review | Manager owns final gates, architecture impact, metrics, tier, and candidate SHA. | All applicable checks and independent authorized human approval when the tier requires it; release decision. |

The manager's read-only inventory on 24 October 2026 records project
`rnqktgtgrvvqptbaosth` as `ACTIVE_HEALTHY`, `us-west-2`, PostgreSQL
`17.11.0.003`, in the Free organization. The database sample is 10,852,019 bytes
and seven sessions with `max_connections=60`. The private schema, dedicated
runtime role, and settings table are absent. Local runtime database/key/CA
variables are absent. These observations prove identity and current setup gaps;
they do not establish workload headroom. Retained evidence is
`ast-report/s2-04-development/owner-readback.json`. The authenticated Free
organization dashboard also showed egress `0.00 / 5 GB`, cached egress
`0.00 / 5 GB`, and project size `26 / 500 MB`. Dashboard usage can lag by one
hour; its project size has a different scope from the SQL database sample.
Free-plan overages cause restrictions rather than billed overages. These readings
are retained in `ast-report/s2-04-development/dashboard-usage.json`; they do not
forecast this workload or establish backup capacity.

The pooler TLS-only preflight at 10:06:13 UTC failed default trust with
`Supabase Root 2021 CA` in a self-signed certificate chain; see
`ast-report/s2-04-development/supabase-pooler-tls.json`. No SQL login occurred.
At 10:11:36 UTC, Node 24.20.0 verified TLS 1.3 and the exact hostname with the
official CA obtained from the project's Download certificate link. Default Node
trust refused the chain, and the same CA with a wrong hostname was refused.
See `ast-report/s2-04-development/supabase-node-tls.json`. This proves TLS to
the pooler only, not project association, SQL login, permissions, persistence,
or the deployed CA path. Use the official CA for this observed endpoint; never
disable verification. The manager's Render readback identifies deployed source
`bb19a9887f3e58776278e516cce9e7aa18efee5c`, deployment
`dep-dbdsf18ae00c73arqlog`, completed 23 October at 20:46:27 UTC. This supersedes
the older Staging record's point-in-time undeployed status. Deployment alone does
not close Slice 1 cutover, native-flow, or mailbox holds.

This ledger keeps unknown facts pending. Do not turn an absent secret, a read-only
provider inventory, a local drill, or a merged parent into evidence of rollout.

## Deployment and ordinary outage

Follow the [database setup runbook](admin-s2-01a-database-setup.md) in order. Use
only the selected existing Supabase project and Render service. Keep the runtime
role separate from the owner. Use verified TLS, the stable application key, and
the service-scoped variables named there. Confirm the required official CA file
before activation. Stage secrets without recording their values. Review any
secret-file action that also triggers deployment.

Before deployment, record the source and image, prior working image, service
identity, selected project, and nonsecret configuration presence. Keep signup
and Slice 2 rollout closed until their release holds clear. After an authorized
activation, verify health, MCP product access, Admin-only settings, disabled
Save, optional Test, Enable, eligible activity and Collector receipt. Verify
restart persistence and tenant isolation with owned fixtures. Record cleanup.
A rollback to a compatible prior image does not require a database rollback;
keep the private schema and key. Review compatibility before any rollback.

During a database pause, outage, reconnect, or quota failure, allow bounded
storage errors to refuse settings writes and export. MCP and admitted product
access retain current identity and membership checks. Do not pause or exhaust
the shared project as a drill, add a keepalive, restart healthy processes, or
log out every user. The owner checks project health and capacity, resolves the
cause within the existing $0 service, and verifies TLS plus scoped reads/writes
before dependent features resume. Activity refreshes settings; there is no idle
poller. Events dropped during outage or shutdown cannot be recovered from SQL.

For a planned restore or suspected key compromise, use the separate maintenance
steps below. These deliberately stop all old dispatch owners; ordinary outage
handling alone does not establish that a queue is empty.

## Choose the backup owner and storage

The following are proposed defaults, **pending owner selection**:

- Owner: the Thermus deployment operator, with one named recovery delegate.
- Cadence: one encrypted scoped logical backup each day while Slice 2 is active,
  and before a migration, restore, or key operation. A manual calendar task is
  sufficient; no scheduler or backup service is added here.
- Retention: seven daily copies and four weekly copies, with weekly copies
  removed after 28 days. The owner must approve this period with the notice and
  confirm that existing storage and bandwidth remain at $0 added cost.
- Destination: an existing operator-owned persistent folder outside Supabase and
  Render. Its exact location, access controls, free capacity, and recovery access
  remain unselected. A temporary folder on this development computer is not that
  destination.
- Key custody: retain the application key and its version in the existing
  password manager/recovery process, separate from the database archive. Keep
  the backup encryption passphrase or recipient recovery key separately too.
  Confirm the delegate can recover both without the failed service.

Record the selected people, locations, cadence, retention, capacity, and access
check in restricted owner evidence. Keep only nonsecret references in the PR.
Do not create a new account, storage service, plan, or paid dependency to fill
these fields. Until they are selected and proved, recovery remains a release
hold.

## Make an encrypted scoped logical backup

Use a trusted owner workstation and a PostgreSQL client compatible with the
server major version. The owner connects through a protected libpq service file
and password prompt or password-manager integration. In the examples,
`service=thermus-owner` is that local connection alias with `sslmode=verify-full`
and the correct official CA when needed. It is not the application's
`DATABASE_URL`, which rejects query options. Do not put passwords, tokens, the
application key, or passphrases in command arguments, shell history, Git, or
logs.

1. Reconfirm the project, database, exact private objects, and current migration
   revision. Stop on a name collision or unexplained schema change. Create a
   private working folder with `umask 077` on the owner's protected disk. Use a
   fresh empty folder for each backup. Ensure shell tracing is off.
2. Make one consistent archive of only `thermus_admin`. Review warnings and
   stop on failure. Do not use `pg_dumpall`, a whole-database dump, large-object
   inclusion, or an export of other schemas.

   ```sh
   pg_dump 'service=thermus-owner' --format=custom --schema=thermus_admin \
     --no-owner --file=settings.dump
   pg_restore --list settings.dump > archive-list.txt
   ```

3. Inspect the archive list against the reviewed migration. It must contain only
   the private schema, settings table and its data, primary key, checks, RLS
   policies, and scoped grants. Retain the applied migration and source SHA,
   server/client versions, UTC backup time, row count, archive SHA-256, and the
   role's nonsecret attributes and memberships. Do not export role password
   hashes or all global roles. `pg_dump` does not back up global roles: the
   reviewed migration recreates the dedicated role with `NOLOGIN` if it is
   absent. Reconcile current scoped grants against that migration; stop if they
   differ unexpectedly. Record the application-key version, never its value.
4. Put those files in `settings-backup.tar` using explicit filenames. Encrypt it
   with the owner's existing encryption tool. For example, GnuPG with its
   protected pinentry prompt can create an integrity-protected AES-256 file:

   ```sh
   gpg --symmetric --cipher-algo AES256 --output settings-backup.tar.gpg settings-backup.tar
   ```

   Keep the passphrase out of the archive and commands. Use the existing
   password manager/recovery process. If this tool is unavailable, the owner
   must select and validate an existing equivalent before rollout.
5. Decrypt to a second private folder, verify archive hash and list, and confirm
   the separate application-key recovery reference is accessible. Copy only the
   encrypted bundle to the selected persistent destination. Verify the copied
   ciphertext hash and read access. Record time, size, hash, destination
   reference, and result without endpoint, tenant, credential, or key contents.
6. Remove local plaintext and temporary recovery material. Removal is not a
   guarantee of secure erasure on snapshots or SSDs; use protected storage and
   avoid extra copies. Apply the selected retention process to old encrypted
   bundles. Record exceptions with a reason and review date.

The scoped archive carries tenant identifiers, Collector addresses, revisions,
enabled state, and encrypted optional credentials. It holds no event history,
WorkOS records, or fetched content. A database archive without its matching
application key cannot recover saved Bearer credentials.

## Restore only the private settings store

The operator first names the incident, backup time, affected rows, and permitted
replacement scope. Compare current and backed-up facts so newer settings are
not silently lost. A full private-table replacement is permitted only when the
owner chooses that exact scope; a single-organization recovery needs an explicit
tenant-filtered import and review. Never restore the project or drop a shared
schema/database to recover this table.

1. Stop export dispatch and all settings writers on every instance. One concrete
   option is an authorized maintenance deployment with the storage configuration
   absent, which uses the discard audit path and unavailable settings while MCP
   remains available. Confirm every prior instance exited; normal replacement
   overlap is insufficient. Close drains/cancels the collector and clears its
   memory queue, retry timers, and snapshot state. There is no durable replay.
   Do not restart storage-enabled instances yet.
2. In the owner session, set the dedicated `thermus_logging` role to `NOLOGIN`.
   Verify no sessions for that role remain in the selected database, including
   pooler sessions. If needed, terminate only sessions of that dedicated role in
   that database after checking their identity. Do not terminate unrelated
   sessions or change shared roles. This step does not itself close existing
   sessions. Keep the application unable to write during recovery.
3. Recover the encrypted bundle in a private local folder. Verify its copied hash,
   decrypt with the separate recovery secret, and verify the plaintext manifest
   and archive hash. Inspect dump SQL with `pg_restore --file` before execution.
   Restore first into a disposable isolated local database whose dedicated role
   already exists as `NOLOGIN`:

   ```sh
   pg_restore --dbname='service=thermus-local-recovery' --single-transaction \
     --exit-on-error --no-owner settings.dump
   ```

   Never aim this command at the live shared database. Require the reviewed
   schema, constraints, grants, and forced RLS to match. If live private objects
   are missing, apply only the reviewed migration with collision checks; if a
   role survives, do not replay its `CREATE ROLE` blindly. Do not change
   unrelated ownership, default privileges, or PUBLIC/database-wide grants.
4. In the isolated recovery database, disable every recovered row and assign a
   fresh UUID revision before generating the import. This invalidates old forms
   and revision-bound work. Run as the administrative owner, not the runtime role:

   ```sql
   BEGIN;
   UPDATE thermus_admin.logging_destination_settings
     SET enabled = false, revision = gen_random_uuid();
   COMMIT;
   ```

   Recover the matching application key separately. Check credential decryption
   using the application codec in a protected local process; do not print tokens.
   Require the original tenant binding. A wrong key or tenant must fail closed.
   If key recovery fails, follow the key-loss procedure and keep export disabled.
5. Export only the reviewed disabled rows from the isolated table to a private
   CSV with an explicit column list. For a full private-table replacement, run
   the following in one owner `psql -X -v ON_ERROR_STOP=1` session on the selected
   live database. Replace only the protected local CSV path. The temporary table
   must have exactly the live table's reviewed shape; validate column order before
   import. This example matches the migration's order. Review the staged tenant
   set and counts before approving the replacement transaction.

   ```sql
   BEGIN;
   SET LOCAL lock_timeout = '5s';
   SET LOCAL statement_timeout = '30s';
   CREATE TEMP TABLE recovered_settings
     (LIKE thermus_admin.logging_destination_settings INCLUDING ALL);
   \copy recovered_settings (tenant_id, revision, endpoint, auth, enabled, encrypted_credential) FROM '/private/owner/recovered-settings.csv' WITH (FORMAT csv)
   UPDATE recovered_settings SET enabled = false, revision = gen_random_uuid();
   TRUNCATE ONLY thermus_admin.logging_destination_settings;
   INSERT INTO thermus_admin.logging_destination_settings
     (tenant_id, revision, endpoint, auth, enabled, encrypted_credential)
     SELECT tenant_id, revision, endpoint, auth, enabled, encrypted_credential
       FROM recovered_settings;
   COMMIT;
   ```

   A failure must stop the session and roll back. Never use `CASCADE`,
   `pg_restore --clean`, a full-project restore, or a schema drop here. For
   tenant-scoped replacement, replace only that reviewed tenant set in a scoped
   transaction; do not apply this full-table example.
6. Before any storage-enabled restart, verify all restored rows are disabled,
   all restored revisions differ from the backup and pre-restore rows, ciphertext
   is unchanged where the key is retained, and row counts and intended tenant set
   match. Verify private schema grants, no unexpected runtime memberships or
   elevated attributes, forced RLS and policies, and unchanged unrelated object
   inventory. Confirm runtime SELECT/INSERT/UPDATE but no DELETE, ownership, or
   DDL. Keep safe evidence; do not log row contents.
7. Reprovision or recover only the dedicated runtime password through the secure
   owner process. Enable LOGIN only after the checks pass. Restore the verified
   server variables and matching key, then start a fresh storage-enabled process.
   Confirm fresh settings reads show disabled rows and no automatic export.
   Each current Admin must review their destination and credential, may Test it,
   and must explicitly Enable it with the fresh revision. Activity then refreshes
   the enabled snapshot. A successful Test is not Enable or proof of storage at
   the Collector.
8. Verify MCP, current access controls, restart persistence, a reviewed owned
   Collector canary, and no unrelated data change. Remove temporary plaintext
   and the isolated recovery database. Record backup time, scope, row counts,
   revision checks, key version, process shutdown, outcome, and recovery limits.
   Audit events lost before or during recovery are not reconstructed.

## Lost or compromised application key

For lost deployment configuration, recover the exact 32-byte application key
from its separate protected copy and verify canonical base64 and key version.
Do not replace it with a new random key and call the old credentials recovered.
A matching recovered key must decrypt only its original tenant's ciphertext.
Keep export disabled until recovery and Admin review complete.

If the key cannot be recovered, encrypted Bearer credentials are lost. Keep the
old encrypted backup under its retention rule and mark its key unavailable.
The owner and affected Admins select replacement credentials. Use the stopped
writer/dispatch maintenance process above. The service refuses both reads and
Saves of a row whose Bearer ciphertext cannot decrypt, so a replacement token
submitted directly in the UI cannot repair that row. After preserving the
scoped encrypted evidence, the owner resets only the reviewed affected rows to
`auth = 'none', encrypted_credential = NULL, enabled = false` with a fresh
`revision = gen_random_uuid()` in one bounded transaction. Use an explicit
approved tenant set and verify the affected row count; do not run an unscoped
reset on the shared project. This discards unusable credentials and leaves a
disabled destination that the existing service can read. Install the new
independent key, start fresh with those disabled rows, then require each current
Admin to choose Bearer again, supply its replacement token, Test if desired, and
explicitly Enable through the existing settings flow.
Do not claim automatic key rotation, bulk re-encryption, or recovery of old
credentials. Where no saved Bearer credential remains usable, the Admin must
provide one before enabling that destination.

For suspected compromise, revoke/rotate affected Collector credentials at their
owners and replace the application key through the same maintenance process.
Changing only the database password or wrapping backup passphrase does not
revoke an exposed Collector token. Record which archive needs which key and its
retention disposition; never store either key beside its ciphertext backup.

## Local procedure validation

A disposable PostgreSQL 17 drill uses synthetic tenants, endpoints, tokens, and
an unrelated sentinel table. It applies the existing reviewed migration, exports
only the private schema, encrypts and decrypts it, recovers the separately wrapped
application key, and restores in a second local database. It then replaces only
the private table in a transaction after disabling rows and changing revisions.
It verifies an injected import failure rolls back, recovered credentials remain
tenant-bound, wrong-key decryption fails, grants/RLS survive, and the unrelated
sentinel remains unchanged. It also checks that the scoped key-loss reset
keeps the row disabled, removes unusable ciphertext, changes revision, and
preserves the unrelated sentinel. No live service or production secret is used.

The corrected drill passed all checks on 24 October 2026 with PostgreSQL
17.10 (Homebrew). Its JSON result pins the source SHA, timestamps, and all 13 successful
check outcomes. This local server version is distinct from the live project.

Safe local evidence is retained under
`ast-report/s2-04-development/operations/`: the replay recipe, archive object
list, and timestamped result with source SHA and cleanup. Temporary databases,
keys, archives, and ciphertext are removed. The first attempt stopped before
encryption because the local GnuPG agent could not use its long temporary path;
the retained failure is followed by the corrected short-path attempt. This is a
manual procedure drill, not a test of document text. It proves neither actual
Supabase TLS/access nor owner storage, live process shutdown, $0 headroom,
production key recovery, or the release gates in the ledger.

PostgreSQL documents the archive, selection, global-role, inspection, and restore
behavior in [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) and
[pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html). The scoped
transfer uses [COPY](https://www.postgresql.org/docs/17/sql-copy.html) through the
client connection. These commands were reviewed with the Supabase PostgreSQL
best-practices skill; no Supabase SDK, new index, or pooling service is added.
