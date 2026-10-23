# S2-01a private logging settings storage

S2-01a adds a private PostgreSQL settings store and a bounded SQL runtime to the
hosted application. It does not add the Logging UI, credential encryption,
Collector requests, or export dispatch. Those remain later Slice 2 work.
WorkOS remains the source of user and organization access.

## Store contract

`src/logging/destination-settings-store.ts` defines the public server contract.
The caller supplies a tenant ID from current trusted organization access.
`read` returns found settings, absence, or unavailable storage. `save` compares
an expected revision atomically; null expects an absent row. Competing first
saves and stale revisions return conflict. A successful change gets a UUID
revision. An exact no-op keeps its revision. The destination owner in S2-01b
must preserve ciphertext for a semantically unchanged credential.

The store persists only endpoint, auth mode, enabled state, revision, and an
opaque encrypted credential. It never encrypts a plaintext token. A failed or
timed-out write that might have reached PostgreSQL returns `unconfirmed`.
Callers must reconcile that result with a new read, rather than assume rollback.

`sql/migrations/20261023211956_logging_destination_settings.sql` creates the
private schema, table, and runtime role in one transaction. It fails on name
collisions. The administrative creator owns the objects. The runtime role has
schema USAGE and table SELECT, INSERT, and UPDATE only. Row-level security is
enabled and forced, with explicit policies for that trusted server role. These
policies permit server operations; they do not identify an end user. Tenant
isolation comes from the store's tenant-scoped public operations and SQL.

## Runtime and configuration

The hosted application reads `DATABASE_URL`,
`LOGGING_DESTINATION_ENCRYPTION_KEY`, and optional `DATABASE_CA_CERT_PATH`.
Missing or invalid values produce unavailable storage and safe diagnostics that
name variables without their values. The database URL requires an explicit host,
user, password, and database. All query parameters and fragments are rejected.
The independent key must be canonical base64 for exactly 32 bytes. The optional
CA file must contain a valid PEM certificate bundle. TLS verifies certificates
and hostnames. See the [owner runbook](admin-s2-01a-database-setup.md).

The pool is lazy. Startup does not run migrations or a database health query.
The SQL owner admits at most two active operations and four pending operations.
The default acquisition deadline is 1,000 ms; the operation deadline is 2,000 ms;
the PostgreSQL statement limit is 1,500 ms. Idle connections expire after
10,000 ms. Runtime close has a 1,500 ms bound within the application's shared
10-second shutdown deadline. Work that outlives its caller remains accounted
until disposal; late clients are released or destroyed and late results are
ignored. Local shutdown destroys its sockets promptly. PostgreSQL can finish an
already-submitted query after socket closure; its 1,500 ms statement timeout
bounds that remote work. Idle pool errors do not crash MCP.

Hosted shutdown starts storage and MCP cleanup together. Self-hosted composition
does not load the hosted SQL adapter. Storage failure does not become a health
probe dependency or a reason to restart healthy MCP.

## Verification scope

Run `npm run test:logging:postgres` for the real SQL acceptance and integration
cases. It needs Docker Engine, OpenSSL, and the `postgres:17-alpine` image
(a cached image or network access to pull it). It creates and removes its own
local fixture containers. It needs no live service credentials. The ordinary
suite covers configuration, the runtime owner, its safe contract, and hosted
startup and cleanup; it does not start PostgreSQL containers.

Acceptance specifies reopen persistence, tenant isolation, competing saves, and
bounded stalled SQL through the source contract. Focused configuration and
lifecycle checks cover invalid values, safe diagnostics, storage-independent
startup, and cleanup. The PostgreSQL fixture is disposable and local, with its
own runtime password, test key, and trusted test CA. It is not a deployed
Supabase connection or a recovery backup.

The complete candidate's test, type, build, quality, architecture, and review
results belong in its review evidence. Local SQL results do not prove actual
Supabase TLS, role grants, pooler behavior, backups, restore, capacity, or $0
operation. S2-04 retains those owner rollout gates.

## BDD and TDD evidence

The persistence and storage-failure acceptance specifications were written
before the source modules and failed because those modules did not exist.
Focused tests then drove admission, acquisition deadlines, pending-call cleanup,
safe result mapping, explicit connection credentials, URI validation, and CA
validation. Each observed failure was fixed before the next step.

Hosted startup acceptance first failed on the missing unavailable-storage
diagnostic. Lifetime tests then exposed cleanup that skipped storage and a
synchronous MCP cleanup error that prevented its peer cleanup. Both now pass.
Existing lifecycle and admitted MCP behavior stayed as characterization.
The composed real-SQL/MCP case passed when added; it is not claimed as a red
test. PostgreSQL outcome-mapping unit cases are characterization too.

Complete-suite review found six exact startup-log expectations that omitted
the new diagnostic. The affected integration tests now expect that safe line
and keep every original access, ordering, error, and cleanup assertion. They do
not filter unexpected logs. The shared expected line is fixture data.

The first final-image gate exposed the same new diagnostic in the image's
strict startup probe. That probe now supplies valid synthetic database settings
and a test-only key, while keeping its error logger and assertions strict.
Docker runs the probe with network access disabled. This checks that the
production image can load the SQL adapter and close its lazy pool without a
provider or database request. These values are not image environment defaults
or real credentials. The image gate is rerun after this probe change.

## Quality review

The new store contract contains types only and has no executable MI value.
The measured production files below miss the MI goal of 85. Review kept the
small composition and SQL boundaries together and the runtime's admission and
disposal state in one owner. Splitting constants or callbacks to change the
score would make these guarantees harder to trace.

| File | Base MI | Candidate MI | Retained reason |
| --- | --- | --- | --- |
| `src/app/logging-storage.ts` | New | 63.5 | One optional startup boundary owns validation, safe failure and lazy loading. |
| `src/logging/bounded-sql-runtime.ts` | New | 41.9 | One owner keeps admission, deadlines, late-work accounting and disposal together. |
| `src/logging/pg-destination-settings-store.ts` | New | 54.2 | Atomic SQL, revision outcomes and row mapping implement one storage invariant. |
| `src/runtime/config/logging-storage-config.ts` | New | 60.0 | Required URI, key and CA rules stay with safe diagnostics. |
| `src/app/application.ts` | 56.2 | 54.5 | Concurrent MCP/SQL cleanup keeps both failures visible. |
| `src/app/hosted-workos-application.ts` | 62.2 | 60.3 | Resource acquisition, startup failure disposal and lifetime transfer stay visible. |

The four new files have bounded, dated exceptions in
[the exception file](../../.code-quality-exceptions.yaml). These are reviewed
goal misses, not passing MI scores. They require human review under the
repository policy. Review also retains two high maintainability findings on the
new runtime and adapter, and three medium findings for aggregate complexity and
runtime length, for the same ownership reasons. No function has more than eight
decision paths. No baseline or threshold is changed.

Verified unit coverage gives zero numeric CRAP goal misses for added or changed
functions; the largest measured value is 12. Three callbacks classified as new
have no measured share, but each has one path, which bounds CRAP to [1, 2].
These are the existing local runtime close callback in `application.ts`, the
hosted startup guard's close callback, and the SQL factory's returned close
callback. The local callback's source is unchanged; the comparison still marks
it new. The process reports unknown coverage honestly; the review checker can
prove the numeric goals from the bounds. No CRAP exception is needed.

The architecture report retains an existing unresolved CSS import on both
revisions. Its dependency-delta view is therefore incomplete. Manual comparison
and the separate declared-owner checker cover the changed imports. The existing
coarse community cycle is unchanged; no owner edge or owner cycle is added.

The habit-hooks findings are retained with these reasons: the fourth hosted
composition parameter is a separate lifetime resource, not an account input;
the application and signal-integration file keep their existing cohesive
responsibilities; contract comments explain trusted tenant authority, opaque
credentials, SQL outcome uncertainty, and work that outlives its caller.
Existing comments retain their prior reasons. No snooze or lint threshold is
changed. Manager review accepts the implementation and these reasons subject
to complete-candidate checks and independent architect approval.

## Contract, policy, and recovery review

The public-surface check identifies `src/index.ts` and `src/app/fetch-tool.ts`
because they import `application.ts`. Both files and their exported declarations
are unchanged. `Application`, `ApplicationLogger`, routing, and tool contracts
remain unchanged. `composeHostedApplication` gains an optional fourth resource
for cleanup; `WorkOSApplicationParts` gains optional storage. Production hosted
composition now owns this resource. Existing callers remain valid. Hosted close
now preserves all cleanup failures in an `AggregateError`; the unchanged process
owner still reports failure and enforces its shared shutdown deadline.

The policy changes declare four exact import facts: `pg` for logging,
`node:crypto` for logging and config, and `node:fs/promises` for config. The test
policy adds the real PostgreSQL gate for affected storage source. These changes
do not lower check thresholds or change review authority. The four dated MI
exceptions require review; the candidate cannot approve its own exceptions.

The new production dependency is pinned `pg` 8.23.1, maintained by the
node-postgres project. Its matching types are a development dependency. The
logging owner uses the driver directly for verified TLS and atomic SQL; no ORM
or provider SDK is introduced. The lockfile also resolves the existing optional
Better Auth PostgreSQL peer against this version.

Admission, current WorkOS membership checks, and browser/MCP organization binding
stay unchanged. Only trusted server code can call the settings store. Its SQL
binds tenant and expected revision, while the restricted database role and
private schema prevent browser API access. Configuration errors expose no
credential values. Missing configuration leaves hosted storage unavailable and
adds one safe startup diagnostic. Self-hosted startup does not load the adapter.

The new deployment inputs and data are optional hosted configuration and one
private settings table. No live migration is applied by this PR. An application
rollback can stop use of the store while preserving its table and key for later
recovery; do not drop shared-project objects or rotate away the only key. If
owner setup fails, the migration transaction rolls back. Any later rollback of
an applied schema requires the owner to stop dependent work and preserve its
data first. The [owner runbook](admin-s2-01a-database-setup.md) keeps actual
Supabase grants, TLS, capacity, backup/restore, and $0 rollout as S2-04 gates.
