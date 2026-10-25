# Independent S2.5-01b safety review

Date: 25 October 2026. Read-only source review. The manager supplied parent
`122d65bf1f035fc195792cc083732aa05c423c58`. This review did not run Git commands,
builds, full suites, Docker, or live provider calls. No source or test was changed.

The manager later authorized the focused correction below. The initial review
and its probe remain historical evidence. The finding is now resolved, subject
to the manager's complete candidate checks and review.

## Finding

**P2 — The total work deadline does not reach the provider read substeps.**
`src/accounts/organizations/membership-removal-lifetime.ts:24-30` checks before
and after one directory method. However,
`src/accounts/providers/workos/workos-organizations.ts:148-157` makes a list read,
a role read, and up to 100 serial user reads within one `memberPage()` call.
The adapter does not know that the removal stopped. If the deadline or shutdown
occurs during an early user read, it can start the remaining user reads after the
public removal has returned. The same issue affects `membershipsOf()` at
lines 135-142 and its paging loop at lines 235-248. Each request keeps its 5-second
bound, but the full adapter operation can continue much longer than 30 seconds.

This does not permit a late DELETE: the outer guard still prevents dispatch and
keeps the operation held. It does leave the claimed total server work budget
unenforced for current reads. The plan's common completion rule gives a fixed
total budget for current reads/pages, storage, dispatch, and finalization. The
implementation record also says to bound all remaining work.

Pass the remaining lifetime or a stop check into removal-specific provider reads,
and check it before each new outbound read. A narrow removal-facts read could
also omit email hydration. Add a test with the real `WorkOSOrganizations` adapter
that stops during the first user read and proves that no later read starts.
The current lifetime tests double the entire directory method, so they cannot
detect this gap. If the intended contract permits all subreads of a started
directory call to continue, document that exception and the larger bound instead
of calling the 30-second limit a total server work budget.

### Probe evidence

A direct TypeScript probe used the existing `WorkOSOrganizationsDouble`, the
real `WorkOSOrganizations.memberPage()`, and `RemovalLifetime.wait()`. The first
`getUser()` stopped the lifetime. After one event-loop turn, the output was:

```json
{"result":"unavailable","calls":[{"userId":"user_01ALICE","afterStop":false},{"userId":"user_SECOND","afterStop":true}]}
```

The probe called no network service and wrote no source or test file.

## Correction and red/green evidence

The manager authorized changes to the directory contract, WorkOS read adapter,
and focused tests. The coordinator agent owns the matching lifetime propagation.

`OrganizationDirectory.membershipsOf(user, signal?)` and `member(id, signal?)`
now take an optional `AbortSignal`. `MemberPageRequest` has an optional `signal`.
The real provider adapter passes it through actor pages, role reads, direct
membership reads, and serial user reads. One small helper checks immediately
before and after each remote read. A signal does not cancel the provider
transport. A call already sent retains its existing five-second timeout; after
abort, no later read starts. Existing readers omit the signal and keep their
behavior. No SDK configuration, dependency, or write method was changed.

Before any correction source change, the real-adapter BDD integration cases
failed 0/6. Each failure showed one later provider read after shutdown or the
30-second deadline. Focused provider tests then failed 0/10 before the provider
change and passed 10/10 after it. With coordinator propagation in place, all
six BDD cases pass. The actor-page fixture terminates normally if work is not
stopped; the final cases also assert zero DELETE calls and no completion of the
held operation. Existing and new provider cases passed 106/106.

Logs:

- `.cache/s25-01b/checks/provider-lifetime-bdd-red.log`
- `.cache/s25-01b/checks/provider-read-lifetime-red.log`
- `.cache/s25-01b/checks/provider-read-lifetime-green.log`
- `.cache/s25-01b/checks/provider-lifetime-regression.log`
- `.cache/s25-01b/checks/provider-lifetime-bdd-green.log`

All checks above used direct TypeScript test entry points. No build, Git command,
Docker process, or live provider call was used for this correction. The manager
must refresh public declaration snapshots and rerun the complete candidate
validation and applicable metrics. This agent does not independently sign off
its own correction.

The manager reviewed and accepted the signal correction. A later test-only habit
fix replaced the target setup's non-null assertion with `assert.ok(target)`
before reading its revision. The new provider unit file has no non-null
assertions or mutable flags; its two mutable values count observed calls.
The changed integration file passed 6/6 again with direct TypeScript execution.
Log: `.cache/s25-01b/checks/provider-lifetime-habit-fix.log`. No manufactured red
step was used for this test setup change. The manager retains complete candidate
validation and final sign-off.

## Other review results

No concrete deletion-safety defect was found in the inspected flow:

- Initial authority runs before admission. Unknown admission cannot dispatch.
- The SQL primary key and conditional upsert admit one pending operation per
  organization. Completion checks the same organization and operation ID and
  cannot overwrite an opposite terminal outcome.
- SQL clients are released before provider dispatch. The existing SQL runtime
  retains its acquisition, statement, operation, and queue bounds.
- Post-admission checks use current actor facts, exact target ID, revision,
  ordinary management, all target role grants, and complete active pages.
  Later duplicate records win. Direct and paged target facts must match.
- Current usable Admin permissions decide authority and the last-Admin rule.
  Partial pages and page-limit failures cannot authorize deletion.
- Deadline and close guards prevent late DELETE and late new finalization work.
  Unknown provider results keep the durable hold and are not replayed.
- Completion uncertainty requires an exact terminal receipt. An explicit mismatch
  stays unknown. An already-started terminal SQL write can commit after the
  public deadline without changing the public unknown result.
- Recorder failure cannot change the result. Production composition supplies
  the same concrete store and stops the removal owner before SQL close.

The owner, checks, and lifetime modules each have a clear role. No excess
abstraction was found that merits a change in this review.

## Evidence and limits

Read `AGENTS.md`, `docs/coding-principles.md`, and the common completion rule and
S2.5-01b scope in `docs/design/organization-admin-plan.md`. Inspected the new owner,
checks, lifetime, store contract, SQL implementation and migration, application
composition, safe recording, real provider read flow, unit cases, SQL contention
and reopen cases, three process crash points, and SQL outage coverage.

The test sources give meaningful coverage of last-Admin, cross-instance overlap,
organization isolation, uncertain writes, wrong receipts, stale completions,
restart, and held unknown results. This review did not independently execute
those suites. Their pass status and full candidate checks belong to the manager's
validation evidence. The implementation record is still marked in progress and
must be completed before a finished-candidate claim. Browser routes, customer
audit wiring with a trusted browser tenant, live deletion, and restore drills
remain in their later slices as declared.
