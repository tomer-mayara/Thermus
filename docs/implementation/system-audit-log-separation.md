# System and audit log separation review

Review scope: the log-separation candidate against parent S2-01a commit
`82f3d6049a23fe10fa9827379fd48863b584dbe3` (PR #237). The PR description and
local review artifacts bind these results to the final committed candidate.
The complete-candidate policy and metrics comparison uses main at
`bb19a9887f3e58776278e516cce9e7aa18efee5c`, so it also includes parent S2-01a.

## Implemented scope and limits

`src/logs/system/` owns internal engineering diagnostics. SystemLogger,
ConsoleSystemLogger, and OtelSystemLogger preserve levels, stderr output,
failure formatting, and automatic caller file/line enrichment. Existing account
and MCP completion records remain internal. No system output forwards to audit.

`src/logs/audit/` owns the moved destination settings store and bounded SQL
runtime, plus the concrete AuditLog class. The two audit methods
project named fields, including fresh nested actor and target records. They add
no source location or stack. A synchronous sink failure cannot change the
completed action. The caller must supply trusted organization and actor context;
this API does not authenticate a caller or infer tenant authority.

AuditLog has one implementation and no duplicate role interface.
AuditEventSink is the provider-neutral event output boundary; it is the
meaningful seam for destinations that have different delivery rules. The first
production sink will send OpenTelemetry logs through OTLP/HTTP JSON to the
organization's configured Collector. S2-03c will supply its bounded in-memory
admission and dispatch through the S2-02a sender. Event callers keep the same
AuditLog methods if another sink is added later.

DestinationSettingsStore has a separate purpose: it saves Collector endpoint,
authentication, enable state, and revision. Its PostgreSQL table holds only
settings and an opaque credential. It contains no audit events or event buffer.
A future SQL event sink would implement AuditEventSink; it would not use this
settings table as an event store. No SQL event sink or sink-selection framework
is added here.

The downstream [S2-01b candidate, PR #238](https://github.com/tomer-mayara/Thermus/pull/238),
was reviewed at `e64a49c6cdbc6f5d7a47d2bfc0fd61907e3dca81`. Its production
composition supplies DestinationSettingsService to the Admin Audit logs routes.
Those routes read and save the selected organization's endpoint, auth, Enable,
and token through DestinationSettingsStore. Current access, origin/CSRF, tenant
binding, token encryption/no echo, and atomic revisions protect the operation.
This is implemented in that open PR, not in this foundation branch or a confirmed
deployment.

Retain DestinationSettingsStore, PgDestinationSettingsStore, and
BoundedSqlRuntime. Their concrete consumer in S2-01b needs durable settings,
atomic revision checks, bounded SQL admission/deadlines, and cleanup. The current
foundation owns startup and disposal before that ticket adds browser reads and
writes. No SQL event writer or table exists to remove. Browser acceptance uses
the real settings service with a store double; separate real PostgreSQL tests
cover persistence and isolation. These checks do not prove deployed
browser-to-Supabase access or OTLP delivery.

The audit API carries metadata only and has no production capture caller or
exporter. S2-03a must add redacted, bounded tool input and final public result
before production capture or enabled export. Queueing, OTLP delivery, destination
Save/Test UI, and an in-app log viewer do not ship in this change. See the
[Slice 2 plan](../design/organization-admin-plan.md).

## Public contracts and architecture

The complete-candidate checker identifies `src/index.ts` and its imported application
boundary, `src/app/fetch-tool.ts`, and the new SystemLog/AuditLog contracts.
SystemLog replaces local structural logger declarations. Its `error(unknown)`
widens the old application, MCP, and HTTP declaration from `string`; the concrete
system logger already accepted unknown failures. Existing callers and runtime
outcomes stay the same. HTTP and CLI use only its error member.

AuditLog adds `toolCompleted` and `administrationChanged`. Tool metadata includes
timestamp, organization, actor, operation, known tool, status, and duration.
Administration metadata includes timestamp, organization, actor, shipped
invitation action, email or invitation target, optional role, and ChangeOutcome.
The event names are fixed as `mcp.tool.completed` and `organization.changed`.
ChangeOutcome retains failed and unknown outcomes. Tool status excludes invalid
arguments and unknown tools, which the capture plan excludes. AuditEventSink
completes synchronously; future bounded enqueue must honor this contract. The
logger catches synchronous sink failure and forwards no extra caller metadata.

The [component registry](../../architecture/components.md) now separates the
former logging owner into system-logs and audit-logs. It shows the live hosted
settings runtime separately from unwired audit event projection. Rules declare
the new type dependencies and prohibit dependencies between the two log owners.
The audit-to-organizations dependency is type-only, for ChangeOutcome.

Policy questions and guarantees:

- Policy: the new owner boundaries and import enforcement preserve review and
  approval thresholds. The change does not lower an approval requirement.
- Contracts: internal output, errors, defaults, and caller enrichment are
  preserved. The new customer event contract is unwired and explicit.
- Dependencies/build: no dependency is added relative to the parent. PostgreSQL
  and pg are parent S2-01a work already present in a comparison with main.
- Deployment/data: image topology, settings storage, SQL behavior, and schema are
  unchanged relative to the parent. Roll back to the previous image; this PR
  requires no schema rollback.
- Security: admission, authentication, authorization, and tenant checks are
  unchanged. Audit projection accepts only named fields. No system-to-customer
  forwarding path is introduced.

Test files now mirror these owners under `test/<type>/logging/system/` and
`test/<type>/logging/audit/`. Destination settings and storage tests belong to
audit. This layout change preserves test behavior and gate selection. The
results below describe the earlier source and class changes; they do not claim
a verification run of the later test-file move.

## Behavior and test evidence

The work used passing characterization before system/storage moves and focused
BDD/TDD cases for new audit behavior. The manager reports these focused results:

| Selection | Result |
| --- | --- |
| New audit acceptance and unit specifications | 6 passed |
| Console characterization before and after the move | 25 passed in each run |
| Focused system log tests | 39 passed |
| Affected boundary tests | 104 passed |
| Storage characterization before and after the move | 14 passed in each run |
| Real PostgreSQL gate | 11 passed |

The class consolidation used those six passing cases as characterization before
the refactor, then passed them again through the renamed source and compiled
modules. Constructor and method bodies, event payloads, and the sink contract
are byte-identical to the prior implementation. No missing behavior was invented
to force a red test. Independent source and document review found no regression.
The type assertions compare public members, so private state cannot by itself
prove separation from system logging. No production caller uses the removed
role interface or implementation module.

The full ordinary suite passed: 4,239 backend tests and 49 portal tests, with
zero failures, cancellations, skips, or todo cases. `npm run typecheck` and
`npm run build:user-portal` also passed. The real PostgreSQL gate passed 11 tests,
and the self-hosted image gate passed 11 tests. The Linux AMD64 hosted image
gate passed all seven tests. Its image build passed `npm run build:hosted`,
including all 13 renderer checks. No separate duplicate hosted aggregate ran.

Before this consolidation, the first hosted-image build timed out during startup of the existing
`/session` shutdown case, before
its SIGTERM assertion. The full host suite and host build passed that case. The
failed build log is retained. The complete image retry passed all seven checks,
including all 119 build-time acceptance tests and the same startup case. The
source, timeout, and assertions were unchanged. No other suite ran in this
worktree during the retry; another workspace shared the local Docker builder.
The cause of the first startup timeout is not proved.

Hosted-live is not selected: identity, membership, invitation, and authentication
behavior stay the same. This change replaces their diagnostic type/import only.
The earlier internal OTel/Axiom interface check passed; its system exporter,
callers, and test inputs are unchanged by this consolidation, so that external
proof is retained without another test export. Local PostgreSQL results do
not prove a deployed Supabase migration, grants, or backup/restore. Those remain
the owner rollout gates in the plan. The local input-match record binds the
final candidate to the tested source, tests, and build inputs. Later evidence
updates change prose only.

## Quality review

The consolidated AuditLog file has MI **89.56**, above the 85 goal. Fresh complete
unit coverage passed 2,645 backend and 29 portal tests. The audit constructor and
both event methods have 100% coverage.
Contract-only files have no executable MI. Changed or moved files below 85 are:

| Files | Head MI | Retained reason |
| --- | --- | --- |
| app/application.ts; app/hosted-workos-application.ts; index.ts | 54.68; 60.28; 60.27 | Existing composition and resource lifetime; this slice changes logger names/types, not their control flow. |
| app/fetch-tool.ts; interfaces/mcp/fetch-tool-server.ts | 67.90; 45.88 | Existing tool composition and request handling; type-only boundary replacement does not justify an unrelated split. |
| interfaces/cli/local-auth-command.ts; runtime/http/fetch-exchange.ts; runtime/http/server.ts | 49.99; 59.47; 68.52 | Existing CLI/HTTP behavior; only the narrow logger type/import changes. |
| logs/system/system-logger.ts; console-system-logger.ts; otel-system-logger.ts | 54.51; 79.56; 76.84 | Preserved parent formatter and adapters, moved and renamed. No new runtime paths. |
| app/logging-storage.ts | 79.03 | Parent S2-01a optional storage composition; this slice changes imports/types. |
| logs/audit/bounded-sql-runtime.ts; pg-destination-settings-store.ts | 41.89; 54.21 | Parent SQL admission/deadline/lifetime and atomic revision rules stay with their cohesive owners. |
| runtime/config/logging-storage-config.ts | 59.99 | Parent validation of URI, key, and CA remains at one configuration boundary. |

These are reasons to retain reviewed code, not claims that the numeric goal
passes. The parent MI exceptions move with their source paths and keep their
bounds and expiry dates. All four metrics process sections completed against
main base `bb19a988`.
Delta and Review report goal misses, CRAP reports unchanged-function misses,
and Architecture passed. These are completed assessments, not tool failures.

The five high MI findings are the two parent SQL classes and three moved system
logger classes listed above. Retain them for those stated ownership reasons.
The three medium aggregate complexity/length findings concern application
composition and the bounded SQL runtime; those responsibilities and control flow
are preserved from the parent. A low coupling finding in HTTP server rises to 11
because it now imports the SystemLog type. Keep that explicit boundary instead of
an anonymous duplicate. No baseline is refreshed.

Every new or changed function meets its numeric CRAP goal. AuditLog methods
have 100% unit coverage and scores at most 4. The largest changed score is 20
(`src/index.ts#run`, four paths, zero unit coverage), below its 30 goal. The full
ordinary and container gates exercise this process boundary; a unit-only report
does not measure those runs. The largest new score is 12.

Four unchanged functions retain known misses: MCP `callTool` and
`safeSearchFailure` score 110, `safeFailure` scores 72, and CLI `perform` scores
42, each with zero unit coverage. Their reason is unchanged by this PR; their
integration/acceptance tests pass but are not part of this coverage report.
Thirteen rows have unknown coverage. Three new callbacks have one path each,
which proves a CRAP bound of 1 to 2; the other ten are unchanged, including the
two-path `arm` callback with a bound of 2 to 6. No new CRAP exception is required.
The report keeps these limits and the unchanged unresolved CSS import in its
global dependency view. The exact owner/import checker reports no undeclared
facts, forbidden edges, or new owner cycles.

Habit-hooks reports are retained for review, with these scoped dispositions:

- One oversized function: the existing MCP server factory retains its request
  lifecycle and outcome handling; this slice changes its logger contract.
- One parameter finding: existing parent application composition passes distinct
  collaborators. A new parameter bag would hide those roles.
- One unused-variable finding: the `using deadline` binding in the entry point
  registers required disposal behavior. Removing it changes resource lifetime.
- 148 comment findings: new comments state boundary, sink, and deferred-capture
  invariants; retained source and characterization comments explain lifetime,
  security, or test constraints. Review these by file group; this is no global
  exemption for future comments.
- Five oversized files: existing application composition, habit-hooks config,
  auth work-slice acceptance harness, MCP integration cases, and server signal
  integration cases retain their existing responsibilities. The slice changes
  types/imports or one guard, without adding a new responsibility to these files.

The snooze file remains empty. The manager reviewed and retained these scoped
dispositions and the complete-candidate metrics evidence.

## Review status and local evidence

Independent code/docs review found no concrete blocker in the reviewed scope.
This agent review is not the independent human approval required for T2.
The complete-candidate local checker reports T2 Need architect, eligible with
no evidence blockers or undeclared facts. T2 reasons include the component/event
contract change, the retained parent datastore boundary, protected policy and
public surfaces, candidate size, existing exceptions, and retained high findings.
The full reasons are retained in the machine-readable report. All selected local
functional, type, and build gates passed. Merge remains blocked pending independent
authorized human architect approval of the current candidate and retained
quality findings. An agent review or label does not supply that approval. This
task does not request merge.

The following are **local workspace artifacts**, not GitHub download links:

- [Base snapshot](../../ast-report/snapshot-base.json) and
  [head snapshot](../../ast-report/snapshot.json).
- [Habit-hooks findings](../../ast-report/log-separation/habit-hooks-final.log).
- [PostgreSQL gate log](../../ast-report/log-separation/postgres-focused.log).
- [Review tier result](../../ast-report/log-separation/review-tier.json).
- [Complete metrics process](../../ast-report/process.md), [process outcomes](../../ast-report/process.json),
  [CRAP rows](../../ast-report/crap.json), and [review findings](../../ast-report/review.json).
- [First hosted-image failure](../../ast-report/log-separation/hosted-container-first.log).
- [Passing hosted-image retry](../../ast-report/log-separation/hosted-container.log).
- [Complete check results](../../ast-report/log-separation/checks.json) and
  [tested input match](../../ast-report/log-separation/input-match.json).
- [Class refactor checks](../../ast-report/audit-class-refactor/) and
  [preserved behavior review](../../ast-report/audit-class-refactor/refactor-review.json).
- [Architecture review artifacts](../../ast-report/log-separation/architecture/).

The PR description gives the final candidate SHA and the pinned architecture
comparison. The complete reports and first failed image run remain available
with their evidence limits; a passing retry does not erase the earlier failure.
