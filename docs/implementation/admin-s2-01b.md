# S2-01b implementation record

This ticket adds the current Admin's Audit logs settings page and atomic Save
to the S2-01a store. The candidate is stacked on PR #239, which follows #237
and separates internal System logs from customer Audit logs.

## Scope

- Read and save one destination for the current organization.
- Encrypt the optional Bearer token with the server key and tenant binding.
- Preserve the revision and ciphertext when settings do not change.
- Reject stale forms and show uncertain writes without an automatic retry.
- Keep current password, Admin, origin, CSRF, and tenant checks.

This ticket sends no Collector request and adds no MFA requirement. Live
Supabase setup and rollout checks remain in S2-04.

## Behavior and ownership

The Audit logs owner (`src/logs/audit/`) owns validation, tenant-bound encryption,
the public read projection, and semantic no-op decisions. The PostgreSQL store remains the revision authority.
Web obtains the tenant and current Admin permission from trusted browser context,
then checks origin and CSRF for Save. The page never receives the saved token.

A blank Bearer token retains the saved token only for unchanged endpoint/auth.
None clears it. Re-entering the same token preserves its ciphertext. A stale
revision returns conflict. The native unconfirmed response offers only a GET
saved-state link, with no Save form or automatic retry. It adds no server-wide
or session write hold. Every later Save, including a manual old-form submission,
and every late commit still faces the store's atomic expected-revision check.

The app supplies the optional service and server key and owns SQL runtime cleanup.
The key and SQL connection settings remain server configuration. Endpoint checks
here cover syntax and literal addresses; actual-connection egress checks belong
to the sender ticket. No Collector request or WorkOS catalog change is added.

System logs (`src/logs/system/`) remain internal engineering diagnostics. Existing
SystemLog wiring retains file and line information. Customers cannot access that
stream. AuditLog has the named `toolCompleted` and `administrationChanged`
methods; AuditLogger projects only explicit metadata fields to AuditEventSink,
without source file, line, generic messages, or exception stacks. This event API
has no production capture or exporter. The settings service is wired to the
browser; it does not send events or call a System log sink. No event viewer is
implemented. The existing `/logging` and `/logging/save` URLs are retained.

## Architecture impact

The existing hosted Node server and PostgreSQL containers remain. Web gains a
runtime read/Save collaboration with audit-logs through the supplied service. The
Audit logs browser/server contract and tenant-bound credential handling require
T2 Need architect. The registry updates its hosted settings component view,
System/Audit view, collaboration overview, and source-owner description. An agent review does not
supply the required independent human architect approval.

## Current verification status

The PR239 rebase moves the destination service, codec, and endpoint checks into
`src/logs/audit/`. At the rebased structure checkpoint, the manager reported
92 compiled tests and 40 portal tests passing. The Audit logs UI wording followed
BDD red-to-green steps: the changed label specifications failed first, then the
focused selection passed 45 compiled tests and 40 portal tests. Source candidate:
`b91e26b26e82274efc13d9363b49fcd18fb1742a`.

The manager inspected desktop (1,200 px) and mobile (390 px) renders. Both passed
the visual review. These renders use generated HTML only; they do not establish
HTTP, browser navigation, storage, or Collector behavior.

The complete candidate passed `npm test` (4,301 backend and 49 portal tests),
typecheck, portal build, 11 local PostgreSQL tests, and 11 self-hosted image tests.
Hosted offline build groups passed 2,695, 29, 20, 1,051, 119, and 13 tests. The
Linux AMD64 hosted image passed seven tests. One live System log Axiom interface
test also passed; it does not prove customer Audit delivery. Coverage collection
passed 2,695 unit, 29 portal, and 1,051 integration tests. Its provenance verifies
661 processes and 152 files, not complete coverage of all production behavior.

The first refreshed quality reports were measured at `89abd40e89d08ec83af64501fc83d2bf75a322ee`
against main `bb19a9887f3e58776278e516cce9e7aa18efee5c`. The PR review artifacts
bind the same tested source and metric inputs to the final prose-only commit. Full reports are retained
under `ast-report/s2-01b-239-final/`. The runs below the current quality section
describe the earlier candidate; they are not reused as current pass evidence.

## Current maintainability and coverage review

The process completed all four stages without a tool failure. Delta reports a
goal miss: 27 of 28 measured changed production files are below MI 85. Review
reports a goal miss with eight high, eight medium, and one low finding. CRAP's
raw command exits 1 for unmeasured functions; it reports a goal miss rather than
a tool failure. Architecture passed. The local checker accepts the proved bounds
below. No new exception or threshold change is required by these results.

Each retained low file and its reason follows. Paths are relative to `src/`.

| Changed source | MI | Reason to retain |
| --- | ---: | --- |
| `logs/audit/bounded-sql-runtime.ts` | 41.9 | Keep bounded admission, leases, deadlines, and late-settlement cleanup in one runtime owner. |
| `logs/audit/destination-settings-service.ts` | 43.0 | Keep retention, encryption choice, projection, no-op, and revision rules together. |
| `interfaces/mcp/fetch-tool-server.ts` | 45.9 | Retain the existing request lifecycle and outcomes; this candidate changes its SystemLog contract. |
| `interfaces/user-portal/portal.ts` | 47.0 | Only Admin navigation changes; existing access and journey responsibilities stay together. |
| `interfaces/cli/local-auth-command.ts` | 50.0 | Retain existing command and error handling with the narrow SystemLog role. |
| `logs/audit/pg-destination-settings-store.ts` | 54.2 | Keep parameterized tenant CAS, row mapping, and bounded SQL composition together. |
| `logs/system/system-logger.ts` | 54.5 | Retain existing severity, safe failure formatting, and internal caller-location rules. |
| `app/application.ts` | 54.6 | Keep supplied collaborators and shared cleanup lifetime in one composition boundary. |
| `logs/audit/destination-credential-codec.ts` | 57.2 | Keep key, nonce, tag, and tenant authenticated data in one compact cryptographic owner. |
| `interfaces/web/account/logging-routes.ts` | 58.5 | Keep current Admin checks, read/Save dispatch, and safe recovery at one boundary. |
| `interfaces/web/account/administration-routes.ts` | 59.1 | Add Audit logs navigation without a second member-operation owner. |
| `runtime/http/fetch-exchange.ts` | 59.5 | Retain existing HTTP exchange and failure behavior with the SystemLog role. |
| `runtime/config/logging-storage-config.ts` | 60.0 | Keep URI, TLS, and key validation at the startup boundary. |
| `interfaces/web/account/account-routes.ts` | 60.2 | Add protected dispatch after current access resolution without another authority layer. |
| `index.ts` | 60.3 | Retain process startup, shutdown deadline, and required disposal under the existing owner. |
| `app/hosted-workos-application.ts` | 60.3 | Keep provider selection and optional storage composition with its hosted lifetime. |
| `interfaces/web/account/account-form.ts` | 61.6 | Export the existing exact-field parser; accepted fields and refusals stay unchanged. |
| `interfaces/web/account/administration-pages.ts` | 64.9 | Extend shared navigation while preserving existing page operations. |
| `app/fetch-tool.ts` | 67.9 | Retain existing tool composition and SystemLog adaptation. |
| `runtime/http/server.ts` | 68.5 | Retain listener, cancellation, and drain behavior with the SystemLog contract. |
| `logs/audit/destination-endpoint.ts` | 69.9 | Use a range table for literal checks; actual-connection egress remains deferred. |
| `interfaces/web/account/logging-page.ts` | 73.1 | Keep one native form, escaping, and secret absence visible. |
| `interfaces/web/account/logging-form.ts` | 73.9 | Keep exact fields and distinct refusals together; reuse shared CSRF parsing. |
| `app/logging-storage.ts` | 75.2 | Keep key, service, and runtime construction at one optional hosted startup boundary. |
| `logs/system/otel-system-logger.ts` | 76.8 | Retain existing internal OTel mapping; moving the adapter adds no customer path. |
| `logs/system/console-system-logger.ts` | 79.6 | Retain existing internal console formatting and safe error output. |
| `interfaces/web/account/members-page-layout.ts` | 83.0 | Share one header and CSP owner across Members and Audit logs. |

AuditLogger scores MI 88.2 and meets the file goal. Four files have no measured
file MI: `interfaces/web/account/members-style.ts` is CSS text;
`logs/audit/audit-log.ts`, `logs/audit/destination-settings-store.ts`, and
`logs/system/system-log.ts` define contracts. MI is N/A for those files.

The eight high native findings belong to the Audit routes, bounded SQL runtime,
credential codec, settings service, PostgreSQL store, SystemLogger, console
adapter, and OTel adapter. Retain each for the corresponding ownership and
invariant reason in the table. Existing time-limited MI exceptions and inherited
review reasons remain recorded; this review does not lower a goal. Medium and
low findings retain the same focused guard, parser, composition, and unchanged
SystemLog behavior reasons. Full findings stay in the reports.

CRAP identifies 83 new and 27 changed functions: 109 of these 110 have measured
scores. The measured maximum is 14.001143072; each measured added or changed
function meets its goal. The one new unmeasured callback is
`openDestinationSettingsRuntime`'s `close` callback in
`logs/audit/pg-destination-settings-store.ts`. Its one decision path proves a
CRAP bound of 1 to 2, which meets both goals without an exception. This is a
bound, not measured coverage. Three unchanged `index.ts` deadline callbacks
also lack measured coverage: `arm` has two paths and bound 2 to 6; two other
callbacks have one path and bound 1 to 2. Retain the reason `unchanged by this PR`.
No full-coverage claim is made.

## Verification history before the PR239 rebase

The first browser acceptance failed because an authenticated Admin received 404
for Logging. Destination and web unit tests then failed on the missing source
modules. Small red/green steps added validation, tenant-bound credentials, safe
read/Save outcomes, and the native form. Regression tests caught malformed IPv6
literals, empty URL userinfo, private exception text, and late commit races.

The compiled focused selection passed 86 tests. The changed portal unit and
acceptance files passed 40 tests. Typecheck passed. The first ordinary suite found
one obsolete assertion that Logging navigation must be absent. That assertion
and its portal counterpart now require Admin Logging navigation while retaining
checks that deferred controls stay absent. The earlier final ordinary suite passed all
4,295 backend tests and all 49 portal tests, with no failed, cancelled, skipped,
or todo tests. The portal build, 11 local PostgreSQL tests, 11 self-hosted image
tests, and hosted offline build passed. The hosted build reported groups of 2,691,
29, 20, 1,051, 119, and 13 passing tests. Desktop (1,200 px) and mobile (390 px)
visual checks show readable controls, loaded fonts and branding, and no horizontal
overflow. Visual checks use generated HTML; HTTP acceptance proves the route
and Save behavior separately.

The earlier runs are recorded in [PR #238](https://github.com/tomer-mayara/Thermus/pull/238)
with that candidate's Linux AMD64 image result, SHA-bound quality reports,
architecture comparison, and review eligibility. They must be refreshed after
the rebase. Full local reports are retained under
`ast-report/s2-01b-final/`; architecture drafts and renders are under
`ast-report/s2-01b-architecture/`. The PR239 comparison is retained separately
under `ast-report/s2-01b-239-architecture/`. These are local artifacts, not uploaded CI reports.

Source changes select `npm test`, typecheck, portal build, self-hosted container,
hosted offline build, Linux AMD64 hosted image, and local PostgreSQL gates.
Hosted-live is not selected: no hosted authentication or WorkOS organization
read/change implementation changes. The existing current-access resolver is
reused and exercised by the new offline HTTP acceptance. No live Supabase
rollout or actual Collector egress is claimed.

## Maintainability review before the PR239 rebase

The first source snapshot and focused file inspections show six new files below
MI 85. Their guards and cryptographic operations remain in cohesive owners.
The IPv4 checks use a range table, and the form reuses the existing CSRF and
exact-field parser. Further splits would spread these small invariants.
Time-limited exceptions record each new file's measured floor and reason; the
small hosted composition exception also covers service/key wiring. Verified
coverage from the complete unit and integration suites measures all 44 added
or changed functions. Their maximum CRAP score is 14.002 (rounded up); all meet
their goals. No CRAP exception is needed.

| Changed source | MI | Reason to retain |
| --- | ---: | --- |
| `app/application.ts` | 54.5 | Existing application composition gains one supplied service; lifetime rules stay together. |
| `app/logging-storage.ts` | 60.5 | Key, service, and runtime construction share one startup boundary. |
| `interfaces/user-portal/portal.ts` | 47.0 | Only the existing Admin navigation gains a link; score is unchanged. |
| `interfaces/web/account/account-form.ts` | 61.6 | Exports the existing exact-field parser for reuse; behavior and score are unchanged. |
| `interfaces/web/account/account-routes.ts` | 60.2 | Current-access routing adds one protected dispatch without another authority layer. |
| `interfaces/web/account/administration-pages.ts` | 64.9 | Navigation type gains Logging; page operations and score stay unchanged. |
| `interfaces/web/account/administration-routes.ts` | 59.1 | Supplies the Logging link without changing member operations. |
| `interfaces/web/account/members-page-layout.ts` | 83.0 | Shares one header and CSP owner across Members and Logging. |
| `interfaces/web/account/logging-form.ts` | 73.9 | Small parser keeps distinct field refusals and reuses shared CSRF checks. |
| `interfaces/web/account/logging-page.ts` | 73.1 | One native form keeps escaping and secret absence visible. |
| `interfaces/web/account/logging-routes.ts` | 58.5 | Admin checks, read/Save dispatch and safe recovery remain one boundary. |
| `logs/audit/destination-credential-codec.ts` | 57.2 | Key, nonce, tag, and tenant binding remain one compact cryptographic owner. |
| `logs/audit/destination-endpoint.ts` | 69.9 | A range table keeps literal checks simple; actual egress is deferred. |
| `logs/audit/destination-settings-service.ts` | 43.0 | Retention, no-op, public projection and revision rules stay in one service. |

Paths in this table are relative to `src/`. The three destination paths now
name their audit owner; these scores were measured before that move and the
PR239 rebase. They need final-candidate remeasurement. `members-style.ts` is a CSS string
with no measured function or file MI; that measure is N/A. Exception floors
and expiry dates are in `.code-quality-exceptions.yaml`. Three high native
review findings concern the new routes, codec and service maintainability;
the reasons above also apply to those findings. No metric threshold is changed.

The earlier complete-candidate habit-hooks run reports 106 retained smells and exits 1.
The snooze file stays empty. These are reviewed findings, not a tool failure:

- Eight complexity findings retain distinct input refusals, credential and CAS
  rules, the atomic store double, and existing portal access/journey branches.
  The production guards have direct refusal and race tests; a shared parser and
  an IP range table already remove duplication.
- Eighteen non-null assertions are confined to tests. They refer to registered
  handlers, fixture rows or headers established by the test, and a known
  nonempty encrypted buffer. A missing value fails the test at its next use.
  New production code has no non-null assertion.
- Two parameter findings retain the existing application composition boundary
  and a four-scalar notice renderer. A new parameter object would not add a
  useful domain owner.
- Seventy-six comment findings retain existing boundary and fixture explanations
  plus the new notes on trusted tenant binding, deferred egress, unknown commit
  recovery, and the atomic store double. These state constraints that names
  alone do not explain.
- Two size findings concern existing application composition and portal journey
  tests. This ticket adds only the supplied service and Logging navigation to
  those cohesive files.

## Current habit-hooks review

The fresh complete-candidate run against `origin/main` reports 247 findings:
8 complexity, 18 test non-null assertions, 1 oversized function, 2 parameter,
1 unused-variable, 211 comment, and 6 oversized-file findings. The snooze file
is empty. These findings have the following scoped dispositions; their presence
does not establish that the other gates or final metrics pass.

- The eight complexity findings retain distinct input refusals, token and CAS
  rules, the atomic store double, and existing portal access/journey branches.
  Direct guard and race tests cover the production rules. The shared parser
  and IP range table already remove duplicated work.
- The eighteen non-null assertions remain in tests. Test setup establishes each
  handler, row, header, or nonempty buffer; missing data fails at its next use.
- The oversized MCP server factory retains its request lifecycle and outcome
  handling. Its SystemLog contract does not create a separate lifecycle owner.
- The two parameter findings retain explicit application collaborators and the
  four-scalar notice renderer. A parameter bag adds no useful domain owner.
- The `using deadline` binding registers required disposal. Removing the binding
  changes resource lifetime, so the unused-variable finding is retained.
- The 211 comments explain existing boundary, fixture, lifetime, security, sink,
  or test constraints, plus tenant binding, deferred capture/egress, unknown
  commit recovery, and the atomic store double. Retain these reasons by file
  group; they do not exempt future comments from review.
- The six oversized files retain existing responsibilities: application
  composition, habit-hooks configuration, the auth work-slice acceptance
  harness, MCP integration cases, server-signal integration cases, and portal
  journey tests. Changes add types/imports, a guard, the supplied settings
  service, or Audit logs navigation within those owners.

These dispositions combine the S2-01b reasons above with the inherited
[System/Audit separation review](system-audit-log-separation.md), especially its
habit-hooks dispositions. They do not waive a required check or authorize merge.

## Contract and policy review

The complete-candidate check compares with `origin/main` at
`bb19a9887f3e58776278e516cce9e7aa18efee5c`. It includes the inherited S2-01a
storage and PR239 System/Audit separation. The focused S2-01b architecture
comparison uses its actual PR239 parent, `f2adef8f24804bfcef45600328dd5575477240e9`.
These bases answer different questions; the focused comparison does not remove
inherited container, external dependency, deployment, or component facts.

The manager compared every checker-listed public surface before and after:

- `src/index.ts` and `src/app/fetch-tool.ts` retain entry-point and MCP behavior.
  Their logger parameters now use SystemLog as described below. Their changed
  application import reaches the composition boundary. Relative to main, inherited composition adds optional hosted storage
  and cleanup, then S2-01b supplies its settings service. Existing callers remain
  valid. App retains SQL cleanup ownership and the inherited combined cleanup
  failure behavior.
- `account-form.ts` exports the existing `formFields` parser for reuse. The
  parser's accepted inputs, refusals, and field behavior stay unchanged.
- `src/logs/system/system-log.ts` replaces earlier structural declarations.
  Its `error(unknown)` broadens the former string input; the concrete logger
  already handled unknown failures. Internal diagnostic behavior, including
  caller file/line, stays unchanged. This contract is unchanged against PR239.
- `src/logs/audit/audit-log.ts` adds the inherited named `toolCompleted` and
  `administrationChanged` event methods relative to main. Their fixed metadata
  and synchronous sink contract are unchanged against PR239. AuditLogger adds
  no source file, line, generic message, or stack fields. Production capture
  and export remain unwired.
- `src/logs/audit/destination-settings-service.ts` adds the public tenant-scoped
  read/Save contract. It exposes token presence only, safe unavailable/invalid/
  conflict/unconfirmed outcomes, and settings revisions. Its codec and endpoint
  imports remain private to audit-logs; the inherited store contract retains
  atomic tenant/revision authority. No provider SDK type crosses this surface.

Policy questions and guarantees:

- **Policy:** S2-01b declares the web-to-audit-logs type import, settings service
  public surface, and `node:net` for literal address parsing. Inherited rules
  separate System and Audit owners and prohibit dependencies between them.
  Check thresholds and review authority stay unchanged. Explicit MI exceptions
  require review; current measured results and bounds are recorded above.
- **Contracts:** Admins gain Audit logs GET/HEAD and Save POST at the existing
  `/logging` URLs. Initial settings are disabled and credentials are write-only.
  A semantic no-op preserves ciphertext/revision. Stale writes conflict;
  unconfirmed native replies offer only a saved-state GET link, with no Save
  form, automatic retry, or server/session write hold. Manual and late writes
  still face CAS. Internal System logs remain separate from customer settings.
- **Dependencies/build:** the complete main-based candidate inherits pinned
  `pg` 8.23.1, maintained by node-postgres, its development types, and lockfile
  changes. The audit owner uses the driver directly for verified TLS and atomic
  SQL. No ORM or provider SDK is added. S2-01b adds no dependency relative to
  PR239. Parent storage and System/Audit review records give the full detail.
- **Deployment/data:** the main-based candidate inherits optional hosted TLS,
  connection/key configuration, a private settings schema, and bounded storage.
  These are unchanged against PR239. The restricted server role and tenant CAS
  protect the settings row. No live schema mutation is performed. Roll back the
  image while retaining the database/table and encryption key; do not drop
  shared objects or lose the only key. No event history or viewer is added.
- **Security:** current trusted Admin permission gates both routes. Form values
  cannot choose a tenant; origin, CSRF, and bounded exact fields precede Save.
  AES-256-GCM binds tokens to the tenant. Safe errors expose no credential or
  collaborator exception text. System logs stay internal; Audit projection
  admits named fields only, with no forwarding to a System sink. Authentication,
  WorkOS authority, and password access remain unchanged.

See the inherited [storage contract and recovery review](admin-s2-01a.md) and
[System/Audit contract review](system-audit-log-separation.md) for the main-based
parent guarantees. The checker at `89abd40e89d08ec83af64501fc83d2bf75a322ee` reports
T2 Need architect, local eligibility `eligible`, `blockers: []`, and
`factsToDeclare: []`. This local result does not establish independent human
approval or GitHub CI status. CI read access was denied, and no merge is made.
The final PR review artifacts pin the prose commit and architecture comparison. T2 Need
architect applies to the browser/server contract and credential handling; an
independent authorized human architect must approve before merge.
