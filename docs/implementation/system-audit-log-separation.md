# System and audit log separation review

Review scope: the log-separation candidate against parent S2-01a commit
`82f3d6049a23fe10fa9827379fd48863b584dbe3` (PR #237). The manager must refresh
the final candidate SHA, check results, and review tier before Ready.

## Implemented scope and limits

`src/logs/system/` owns internal engineering diagnostics. SystemLogger,
ConsoleSystemLogger, and OtelSystemLogger preserve levels, stderr output,
failure formatting, and automatic caller file/line enrichment. Existing account
and MCP completion records remain internal. No system output forwards to audit.

`src/logs/audit/` owns the moved destination settings store and bounded SQL
runtime, plus the new AuditLog/AuditLogger foundation. The two audit methods
project named fields, including fresh nested actor and target records. They add
no source location or stack. A synchronous sink failure cannot change the
completed action. The caller must supply trusted organization and actor context;
this API does not authenticate a caller or infer tenant authority.

The audit API carries metadata only and has no production capture caller or
exporter. S2-03a must add redacted, bounded tool input and final public result
before production capture or enabled export. Queueing, OTLP delivery, destination
Save/Test UI, and an in-app log viewer do not ship in this change. See the
[Slice 2 plan](../design/organization-admin-plan.md).

## Public contracts and architecture

The preliminary checker identifies `src/index.ts` and its imported application
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

Independent review reran the six audit tests with
`node --import tsx --test test/unit/logging/audit-logger.test.ts test/acceptance/logging/audit-log.test.ts`.
They passed, including separate system/customer outputs, caller enrichment only
on system output, nested field projection, and sink failure isolation.

The full ordinary suite passed: 4,239 backend tests and 49 portal tests, with
zero failures, cancellations, skips, or todo cases. `npm run typecheck` and
`npm run build:user-portal` also passed. `npm run build:hosted` passed, including
its 13 renderer checks. Container gates, the final metrics process, and CRAP
assessment are pending.

## Quality review

The available head snapshot gives AuditLogger MI **88.19**, above the 85 goal.
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
bounds and expiry dates. The final process must determine applicable findings
against its pinned base. No final CRAP score or coverage claim is made here.

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

The snooze file remains empty. The manager owns the final complete-candidate
habit-hooks disposition and all mandatory metric evidence.

## Review status and local evidence

Independent code/docs review found no concrete blocker in the reviewed scope.
This agent review is not the independent human approval required for T2.
Final classification, eligibility, current-head approval, and pending checks
remain manager gates. The preliminary checker reports T2 Need architect and
blocks eligibility until required metric evidence exists; it is not a final
merge decision.

The following are **local workspace artifacts**, not GitHub download links:

- [Base snapshot](../../ast-report/snapshot-base.json) and
  [head snapshot](../../ast-report/snapshot.json).
- [Habit-hooks findings](../../ast-report/log-separation/habit-hooks.log).
- [PostgreSQL gate log](../../ast-report/log-separation/postgres-focused.log).
- [Preliminary review result](../../ast-report/log-separation/preliminary-review.json).
- [Architecture review artifacts](../../ast-report/log-separation/architecture/).

The manager must retain final process/CRAP reports and check logs, update this
record with their results, and bind review evidence to the committed candidate.
