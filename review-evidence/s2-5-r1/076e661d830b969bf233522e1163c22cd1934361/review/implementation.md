# S2.5-R1 implementation handoff

Base stack parent: `0530dd634fe8302b55d4a0669463ef733199cc40`.
Branch: `codex/s2-5-r1-removal-facts`. Work started with HEAD
`1a192d743a4c71ae6faebfd00f7ae6fd4c72ea0e` and no tracked edits.
The worker made no commit, push, PR edit, live provider call, schema change, or
configuration change. The user's untracked
`docs/implementation/admin-s1-production-cutover.md` was not touched.

## Result

`OrganizationMemberFacts` contains all existing member safety fields and no
email. `OrganizationMember` extends that shape and keeps email. The existing
`OrganizationDirectory` adds `memberFactsPage(MemberPageRequest)` with the
existing `Page` result. The WorkOS implementation keeps raw management evidence,
checks organization and status scope, reads the current role catalog, maps all
roles and application permissions, computes the same revision, follows the
returned cursor, and checks stop signals around remote reads. The facts page
makes no user lookup. Display pages and `member()` retain their email reads.

Only the removal scan uses the new page. Its checks still compare all target
safety fields, count current Admins across complete pages, handle duplicate
membership IDs with the latest record, and retain the ten-page limit. The
30-second lifetime, durable admission, exact deletion, terminal receipts,
pending holds, retry behavior, and shutdown rules are unchanged.

The public directory declaration changes. T2 Need architect is expected for the
changed public declaration snapshot and declared contract change. No new
production module, component, package dependency, or runtime component edge is
added. The manager owns the complete-candidate impact evidence, snapshots,
registry check, metrics, required gates, and final review.

## BDD and TDD evidence

Logs in this directory retain all runs listed below. The first acceptance red
run occurred before any production-source edit. The facts red run occurred
before the directory contract and WorkOS facts implementation. The coordinator
red run occurred before switching the removal scan.

| Command | Exit and result | Log |
| --- | --- | --- |
| `node --import tsx --test test/acceptance/auth/hosted-member-removal-budget.test.ts` | 1; actual `unknown`, required `applied`; 1 failed | `acceptance-red.log` |
| `node --import tsx --test test/unit/auth-workos/workos-organizations-member-facts.test.ts` | 1; new method absent; 18 failed | `facts-red.log` |
| `node --import tsx --test test/unit/auth-workos/workos-organizations-member-facts.test.ts test/unit/auth-workos/workos-organizations-members.test.ts` | 0; 57 passed | `facts-green.log` |
| `node --import tsx --test test/unit/organizations/membership-removal-rules.test.ts` | 1; old display scan ignored new facts seams; 22 passed, 16 failed | `coordinator-red.log` |
| `node --import tsx --test test/acceptance/auth/hosted-member-removal-budget.test.ts test/unit/organizations/membership-removal-rules.test.ts test/unit/organizations/membership-removal-lifetime.test.ts test/unit/auth-workos/workos-organizations-read-lifetime.test.ts test/integration/auth/workos-removal-lifetime.test.ts` | Interrupted with exit 130 after a new target-user pause also paused fixture warmup; 69 passed, 1 cancelled. Fixed the test pause guard to activate only after warmup. | `coordinator-green.log` |
| Same coordinator command after the guard fix | 0; 73 passed | `coordinator-green-retry.log` |
| `node --import tsx --test test/integration/auth/workos-member-facts.test.ts` | 0; 4 passed | `sdk-facts-green.log` |
| `node --import tsx --test test/unit/auth-workos/*.test.ts test/unit/organizations/*.test.ts test/integration/auth/workos-member-facts.test.ts test/integration/auth/workos-removal-lifetime.test.ts test/acceptance/auth/hosted-member-removal-budget.test.ts` | 0; 465 passed | `focused-final.log` |
| `node --import tsx --test --test-concurrency=1 test/acceptance/auth/hosted-member-removal.test.ts test/acceptance/auth/hosted-member-self-removal.test.ts test/acceptance/auth/hosted-member-removal-scope.test.ts test/acceptance/auth/hosted-membership-deletion.test.ts test/acceptance/auth/hosted-seats.test.ts test/integration/auth/hosted-administration.test.ts test/integration/auth/workos-provider-administration.test.ts` | 0; 46 passed | `acceptance-display-green.log` |
| `git diff --check` | 0 | No output |

All final source test runs had zero failures, cancellations, skips, or todos.
The worker used Node 24.20.0 with tsx. No generated build artifacts were changed.
The final focused and browser/display runs cover 511 passing cases in total.
The acceptance uses the real WorkOS adapter and coordinator with a controlled
provider and a store fake. The fake store asserts the exact pending intent at
DELETE and the same operation's terminal receipt. It does not establish SQL
durability; the unchanged SQL and restart gates supply that evidence.

Both monotonic and fake timer clocks advance by 300 milliseconds for each
successful display-user read after setup. With 100 active memberships, the
repaired removal is applied after one direct-target user lookup (300 simulated
milliseconds), deletes only `member-1`, leaves the acting Admin, and has one
admission with the exact terminal `applied` operation. This fixture is a
regression case; it gives no real-provider throughput guarantee.

## Coverage of retained safety rules

- Facts tests cover explicit status/organization filters, request cursor, next
  cursor, empty pages, all safety fields, full grants, current role catalog,
  revision order independence, all management states, unknown roles, failed
  membership/role reads, and zero user lookup.
- SDK integration cases run the real raw membership reader and pinned SDK
  against local wire responses. Missing/null management remains unknown; the
  request list contains only membership and role GETs.
- Removal rules and lifetime seams now use `memberFactsPage` and a separate
  facts-page layout/read log. They cover later-page Admins, duplicate/latest
  facts, the ten-page bound, failed later pages, repeated cursors, stale facts
  for every safety field, reversed grant order, unsafe roles and management,
  actor changes, no display-page dependency, deadlines, and close.
- Provider lifetime tests pause actor pages, direct-target roles, direct-target
  user lookup, and facts-page roles. An in-flight read may finish after stop;
  no next read or DELETE starts. Existing display enrichment-stop tests stay
  on `memberPage`.
- The process restart helper still records `memberPageReads` for its explicit
  current Members refresh. That display seam is intentional and unchanged.

## Changed files owned by this worker

Production:

- `src/accounts/organizations/organization-directory.ts`
- `src/accounts/organizations/membership-removal-checks.ts`
- `src/accounts/providers/workos/workos-organizations.ts`

Tests and doubles:

- `test/acceptance/auth/hosted-member-removal-budget.test.ts` (new)
- `test/integration/auth/workos-member-facts.test.ts` (new)
- `test/integration/auth/workos-removal-lifetime.test.ts`
- `test/support/doubles/organizations/organization-directory-double.ts`
- `test/unit/auth-workos/workos-organizations-member-facts.test.ts` (new)
- `test/unit/auth-workos/workos-organizations-read-lifetime.test.ts`
- `test/unit/organizations/membership-removal-lifetime.test.ts`
- `test/unit/organizations/membership-removal-rules.test.ts`

## Remaining manager checks

The worker did not run `npm test`, typecheck, portal build, habit-hooks,
ast-metrics, declaration generation, Docker, SQL runtime/restart gates, or
browser runtime gates. This follows the manager's shared-artifact coordination
request, and is not a claim that those gates are optional. No required gate was
replaced with a skip. The manager must run selected complete-candidate gates,
review the source and tests, update public API evidence and documentation,
classify the committed candidate, and record current-candidate T2 approval.
