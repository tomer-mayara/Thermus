# Slice 4 recovery work

Status: future work. On 24 October 2026, the owner chose to run Slice 2 without
backup. Backup storage, cadence, retention, separate key recovery, and scoped
restore proof are not Slice 2 release prerequisites. This document retains the
proposed procedures and historical local drill evidence for later Slice 4 work.
It does not claim that production backup or recovery is configured or proved.

The current rollout ledger is [S2-04](admin-s2-04.md). Slice 2 keeps the same
application key across deployments, but no recoverable external copy or database
archive is established by this record. Loss of settings or the key can require
Admin setup again; an archive cannot recover Bearer credentials without its
matching key. The owner must select and validate the recovery scope before
activating this future work. Do not apply restore or key-reset commands merely
to complete a Slice 2 release.

## Removal holds are outside a settings restore

The private schema now also contains membership-removal operation records.
This settings procedure must not restore or erase those records. Select only
`thermus_admin.logging_destination_settings` for new scoped settings archives.
An older whole-schema archive can contain removal records or ACLs. Before any
recovery that can replace, omit, or roll them back, follow the [S2.5 removal
restore hold](admin-s2-5-02-removal-runbook.md#hold-reductions-outside-restored-rows):
stop every old sender, revoke effective runtime INSERT/UPDATE on the removal
table outside restored rows, restore only reviewed data without ACL replay,
and reconcile the snapshot window with independent evidence. Keep that hold
through restart checks. An empty restored table or a current membership read
cannot establish that a possible provider deletion is safe to repeat.

This rule adds no production backup prerequisite to Slice 2 or Slice 2.5 and
changes no owner decision about future Slice 4 activation.

## Choose the backup owner and storage

The following are proposed defaults, **pending owner selection**:

- Owner: the Thermus deployment operator, with one named recovery delegate.
- Cadence: one encrypted scoped logical backup each day after this recovery
  process is active, and before a migration, restore, or key operation. A manual calendar task is
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
these fields. Select and prove these facts before activating this future recovery
process; they do not block Slice 2.

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
2. Make one consistent archive of only
   `thermus_admin.logging_destination_settings`. Review warnings and stop on failure. Do not use `pg_dumpall`, a whole-database dump, large-object
   inclusion, or an export of other schemas.

   ```sh
   pg_dump 'service=thermus-owner' --format=custom \
     --table=thermus_admin.logging_destination_settings \
     --no-owner --file=settings.dump
   pg_restore --list settings.dump > archive-list.txt
   ```

3. Inspect the archive list against the reviewed migration. It must contain only
   the settings table and its data, primary key, checks, RLS policies, and scoped
   table grants. Table selection does not include the schema or dedicated role;
   keep the reviewed migrations separately. Exclude membership-removal records
   and unrelated objects. Retain the applied migration and source SHA,
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
   must select and validate an existing equivalent before using this backup
   process.
5. Decrypt to a second private folder, verify archive hash and list, and confirm
   the separate application-key recovery reference is accessible. Copy only the
   encrypted bundle to the selected persistent destination. Verify the copied
   ciphertext hash and read access. Record time, size, hash, destination
   reference, and result without endpoint, tenant, credential, or key contents.
6. Remove local plaintext and temporary recovery material. Removal is not a
   guarantee of secure erasure on snapshots or SSDs; use protected storage and
   avoid extra copies. Apply the selected retention process to old encrypted
   bundles. Record exceptions with a reason and review date.

The scoped archive carries tenant identifiers, Collector addresses, optional
Axiom dataset names, revisions, enabled state, and encrypted optional credentials.
It holds no event history, WorkOS records, or fetched content. A database archive without its matching
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
   Restore first into a disposable isolated local database whose private schema
   and dedicated `NOLOGIN` role are prepared from reviewed definitions, without
   an existing settings table. A table-only archive does not create its schema:

   ```sh
   pg_restore --dbname='service=thermus-local-recovery' --single-transaction \
     --exit-on-error --no-owner settings.dump
   ```

   Never aim this command at the live shared database. This example is for the
   new table-only archive; inspect an older archive and exclude all other
   objects, especially removal records and ACLs. Require the reviewed
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

   Select the deployment key before import. One key serves every organization;
   rows do not store a key version. For a tenant-scoped restore, retain the current
   deployment key. Never replace it to match a partial backup: that can make
   other organizations' credentials unreadable. A full-table replacement may use
   the separately recovered backup key only after review confirms that every
   remaining Bearer row is compatible with it.

   Check each restored credential with the selected key and original tenant in a
   protected process using the application codec; do not print tokens. A wrong
   key or tenant must fail closed. If restored ciphertext cannot use the selected
   key, obtain approval to reset only those restored rows to disabled
   `auth = 'none', encrypted_credential = NULL` with fresh revisions. The Admin
   must re-enter those credentials after recovery. Keep maintenance active if
   key compatibility or reset scope is unresolved. This procedure adds no bulk
   re-encryption. If the current key is lost, use the key-loss procedure below.
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
   \copy recovered_settings (tenant_id, revision, endpoint, auth, enabled, encrypted_credential, axiom_dataset) FROM '/private/owner/recovered-settings.csv' WITH (FORMAT csv)
   UPDATE recovered_settings SET enabled = false, revision = gen_random_uuid();
   TRUNCATE ONLY thermus_admin.logging_destination_settings;
   INSERT INTO thermus_admin.logging_destination_settings
     (tenant_id, revision, endpoint, auth, enabled, encrypted_credential, axiom_dataset)
     SELECT tenant_id, revision, endpoint, auth, enabled, encrypted_credential, axiom_dataset
       FROM recovered_settings;
   COMMIT;
   ```

   A failure must stop the session and roll back. Never use `CASCADE`,
   `pg_restore --clean`, a full-project restore, or a schema drop here. For
   tenant-scoped replacement, replace only that reviewed tenant set in a scoped
   transaction; do not apply this full-table example.
6. Before any storage-enabled restart, verify all restored rows are disabled,
   all restored revisions differ from the backup and pre-restore rows, ciphertext
   is unchanged for compatible credentials, approved incompatible credentials
   are cleared, and row counts and intended tenant set match. Recheck that every
   remaining Bearer row can use the selected deployment key, including rows
   outside a scoped restore. Verify private schema grants, no unexpected runtime memberships or
   elevated attributes, forced RLS and policies, and unchanged unrelated object
   inventory. Confirm runtime SELECT/INSERT/UPDATE but no DELETE, ownership, or
   DDL. Keep safe evidence; do not log row contents.
7. Reprovision or recover only the dedicated runtime password through the secure
   owner process. Enable LOGIN only after the checks pass. Restore the verified
   server variables and the selected key, retaining the current deployment key
   for a scoped restore. Then start a fresh storage-enabled process.
   Confirm fresh settings reads show disabled rows and no automatic export.
   Each current Admin must review their destination and credential, may Test it,
   and must explicitly Enable it with the fresh revision. Activity then refreshes
   the enabled snapshot. Test saves the submitted export enabled state before sending its synthetic
   event; leave the switch off during recovery until the Admin intends to
   enable export. A successful Test is no proof of storage at the Collector.
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
writer/dispatch maintenance process above. Before replacing the global key,
inventory **all** current Bearer rows. The approved tenant set and count must
cover every row whose ciphertext will become unusable. If approval covers only
a subset, or any mixed-key state is unresolved, keep maintenance active and do
not replace the key. There is no per-row key version or alternate-key fallback.
The service refuses both reads and
Saves of a row whose Bearer ciphertext cannot decrypt, so a replacement token
submitted directly in the UI cannot repair that row. After preserving the
scoped encrypted evidence, the owner resets only the reviewed affected rows to
`auth = 'none', encrypted_credential = NULL, enabled = false` with a fresh
`revision = gen_random_uuid()` in one bounded transaction. Use an explicit
approved tenant set and verify the affected row count; do not run an unscoped
reset on the shared project. This discards unusable credentials and leaves a
disabled destination that the existing service can read. Install the new
independent key only after all affected rows are reconciled and every remaining
Bearer row can use it. Start fresh with the reset rows disabled, then require each current
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

## Historical local procedure validation

The evidence below predates the table-only archive selection, optional
`axiom_dataset` transfer column, and removal-hold cross-reference added on
25 October 2026. It does not validate those revised future procedure steps.
The S2.5-02 record must retain its separate controlled removal-restore drill.

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

The corrected first drill passed 13 checks on 24 October 2026 with PostgreSQL
17.10 (Homebrew). A second version passed all 20 checks, including seven checks
for global-key compatibility. It proves that an old-key partial restore cannot
replace the current deployment key without breaking other rows. Clearing only
the incompatible restored credential leaves the current-key rows unchanged and
decryptable. Replacing the global key before reconciling those remaining rows
makes them unreadable, which confirms the maintenance hold. Its JSON pins the
source SHA, timestamps and outcomes. This local server version is distinct from
the live project.

Safe local evidence is retained under
`ast-report/s2-04-development/operations/`: the replay recipe, archive object
list, versioned drill results with source SHA and cleanup, and the global-key
review. Both the original 13-check record and the 20-check record are retained.
Temporary databases, keys, archives, and ciphertext are removed. The first attempt stopped before
encryption because the local GnuPG agent could not use its long temporary path;
the retained failure is followed by the corrected short-path attempt. This is a
historical manual procedure drill, not a test of document text. It proves neither
actual Supabase TLS/access nor owner storage, live process shutdown, $0 headroom,
or production key recovery. These future recovery checks do not block Slice 2.

PostgreSQL documents the archive, selection, global-role, inspection, and restore
behavior in [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) and
[pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html). The scoped
transfer uses [COPY](https://www.postgresql.org/docs/17/sql-copy.html) through the
client connection. The historical commands were reviewed with the Supabase PostgreSQL
best-practices skill; no Supabase SDK, new index, or pooling service is added.
