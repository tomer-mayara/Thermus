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
`src/logs/audit/`. At the rebased structure checkpoint, the manager reported 92 compiled tests
and 40 portal tests passing. Later UI wording and the complete candidate need
final checks. Complete-candidate gates, quality evidence,
and final SHA-bound review are pending. The runs below describe the earlier
candidate and do not establish a pass for this rebased candidate.

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

## Contract and policy review

Against PR239, SystemLog and the named AuditLog/AuditLogger event contracts stay
unchanged. The new destination settings service belongs to audit-logs. Web calls
that supplied service by its public read/Save contract. It imports no credential
codec and uses no System log as an Audit sink. App retains SQL cleanup ownership.
The final checker-listed public surfaces and evidence must be refreshed for the
rebased candidate; the earlier comparison below is historical.

- **Policy:** the rules add only the web-to-audit-logs type import, the new audit destination
  service public surface, and `node:net` for literal IP parsing. Explicit MI
  exceptions expire on 2026-12-22. Check selection and approval authority stay
  unchanged.
- **Security:** current trusted Admin permission gates both routes. Form values
  cannot select the tenant. Origin, CSRF and bounded exact fields precede Save.
  Credentials stay server-side; authentication failures and secret-bearing
  collaborator errors return fixed safe outcomes.
- **Client contract:** Admins gain Audit logs GET/HEAD and Save POST. Initial state
  is disabled; credentials are write-only. Saved revisions reject stale writes.
  Unconfirmed replies offer a saved-state read, not an automatic replay.

The earlier public-surface comparison checked the checker-listed modules at the parent
and candidate. `src/index.ts` and `src/app/fetch-tool.ts` keep their exported
contracts and MCP behavior; they import application composition, whose optional
hosted storage argument now supplies the settings operations. The web
`account-form.ts` adds the existing `formFields` export without changing its
behavior. The new audit settings service defines safe read/Save results; its codec and
endpoint dependencies are private to that owner. No provider SDK type crosses
these contracts. T2 is required for the new browser/server contract and sensitive
credential handling. An independent human architect must approve before merge.
