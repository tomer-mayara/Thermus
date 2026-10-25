# Slice 2.5 web and audit review

Reviewed HEAD `806ccc573c6ae09c411a47a755d6dd9316343f8f` against
`origin/main` `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.
Read `AGENTS.md` and `docs/coding-principles.md` before the implementation.
No source files or live state changed. This report is local review evidence.

## Findings

No confirmed defect in the assigned web, current-access, self-removal, or audit
projection paths. I found no severity-tagged issue to send as a code finding.

## Checked behavior

- `src/interfaces/web/account/account-form.ts:81`: removal requires exactly one
  CSRF token, organization ID, membership ID, and revision. Extra and duplicate
  fields fail. IDs and revision have bounded visible ASCII values. The existing
  body reader limits form work to 16 KiB.
- `src/interfaces/web/account/administration-routes.ts:156`: method and origin
  checks precede form reading; CSRF and field checks precede the coordinator.
  The submitted organization must match the decided organization. Forged
  organization requests do not reach the coordinator.
- `src/interfaces/web/account/administration-pages.ts:23`: `removable` only
  selects whether to offer a form. The coordinator checks current actor,
  organization, target, revision, and remaining Admins again. The native
  `details` confirmation and Cancel GET add no alternate write path.
- `src/accounts/providers/workos/workos-auth-provider.ts:82`,
  `src/interfaces/web/account/account-routes.ts:95`, and
  `src/interfaces/mcp/mcp-server.ts:95`: each new browser or MCP request resolves
  current grants. Old session/token organization claims do not restore a deleted
  membership. A new accepted invitation restores only its current role. Tokens
  for other organizations still use those organizations' current memberships.
- `src/interfaces/web/account/administration-routes.ts:164` and
  `src/interfaces/web/account/account-pages.ts:85`: removal returns a distinct
  result without a later Members read. Applied is separate from unknown, busy,
  and a later read failure. Unknown/busy pages contain no form and do not assert
  that a provider operation has settled. Repeated POSTs are handled by the durable
  coordinator guard; a Members GET only reads current state.
- `src/interfaces/web/account/account-pages.ts:97`: result navigation uses
  current Members, identity-only organization selection, and sign-in with a
  selector return path. It does not require another protected removal read.
  Existing journeys cover other membership, no membership, retained creator,
  expired provider session, and unknown self-removal outcomes.
- `src/interfaces/web/account/administration-routes.ts:204`: audit tenant and
  actor come from the decided context. The untrusted form organization never
  chooses a Collector. Invalid origin/CSRF and denied current access produce no
  customer event. An otherwise checked cross-organization form records `stale`
  only in the actual request tenant.
- `src/logs/audit/audit-event-projection.ts:63` and
  `src/logs/audit/otlp-audit-encoding.ts:42`: removal projection exports the
  explicit membership ID, safe actor/tenant metadata, action, timestamp, and
  outcome. CSRF, session credentials, provider details, and revision do not enter
  the event. Capture/export failure cannot change removal or replay its write.

## Limits and plan simplification

1. Keep the current small web design: one native confirmation, one checked POST,
   one fixed result page, and existing read-only selector/sign-in navigation.
   There is no evidence here that flash storage, a status endpoint, client
   JavaScript, or another recovery UI would help.
2. Keep the removal route separate from the generic invitation change route.
   Removal has different completion and uncertainty rules. Sharing the few
   duplicated checks now would add branching to that generic route.
3. Describe customer audit as best effort. At
   `src/logs/audit/audit-snapshots.ts:29`, a missing or expired snapshot drops the
   triggering event and loads metadata for future capture. The integrated export
   test deliberately warms that snapshot before removal. This is the inherited
   contract, not a new Slice 2.5 defect. Do not treat an audit event's absence as
   removal evidence, or add audit durability to the removal release scope.
4. Keep the release proof focused on the remaining external facts. The existing
   controlled tests establish routing and scope; they do not prove live WorkOS
   session deletion semantics, production rollout, provider races with external
   writers, or operator reconciliation. The provider/store/release reviewers own
   those checks.

## Validation

77 focused existing tests passed on Node `v24.20.0` using `--import tsx`:

```text
node --import tsx --test test/integration/hosted-admin/account-routes-removal.test.ts test/integration/hosted-admin/account-routes-removal-audit.test.ts test/unit/logging/audit/audit-removal.test.ts test/acceptance/auth/hosted-member-self-removal.test.ts test/acceptance/auth/hosted-member-removal-scope.test.ts
62 passed; 0 failed

node --import tsx --test test/acceptance/auth/hosted-member-removal-browser.runtime.ts test/acceptance/auth/hosted-member-removal.test.ts
15 passed; 0 failed
```

The Chromium test used the existing portal build and a controlled WorkOS site. It
checked real keyboard open/cancel/confirm, names, a 390 by 844 viewport, loaded
logo/fonts, no horizontal overflow, exact membership deletion, and no result-page
form. It wrote no screenshot because no evidence directory was set.

The first command was attempted without `--import tsx`. The audit unit cases
passed, but four files could not load because Node strip-only mode does not
support the repository's existing TypeScript parameter properties. The corrected
tsx run above passed. This was an invocation limit, not a product test failure.
No full suite, SQL container gate, live provider gate, production check, or
release claim was made in this scoped review.
