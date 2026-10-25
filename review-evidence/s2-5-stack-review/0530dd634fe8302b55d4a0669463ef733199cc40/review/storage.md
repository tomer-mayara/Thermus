# Slice 2.5 storage and recovery review

Reviewed HEAD `806ccc573c6ae09c411a47a755d6dd9316343f8f` against `origin/main` `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.

Scope: SQL admission and completion, shared runtime composition, coordinator stop/restart, real-Postgres tests, removal runbook and Slice 4 recovery. Read `AGENTS.md`, `docs/coding-principles.md`, and the Supabase Postgres best-practices skill. This review changed no source, test, document, cloud setting, or unrelated local resource. The pre-existing untracked `docs/implementation/admin-s1-production-cutover.md` was left alone.

## Verdict

No confirmed P0/P1/P2 source safety defect found in this scope. The core storage design is small and appropriate to the required crash/concurrency guarantee. I would retain it. There are rollout dependencies and evidence limits below; they should not be presented as new code defects when the release record already keeps them open.

## Verified reasoning

- Admission is one atomic statement, scoped by the organization primary key. Its `ON CONFLICT ... DO UPDATE ... WHERE outcome IS NOT NULL` permits exactly one pending owner and permits replacement only after a terminal row (`src/logs/audit/pg-destination-settings-store.ts:17-23`). No SQL transaction or connection stays open during provider HTTP.
- Completion is scoped by organization and operation UUID. It accepts pending -> terminal and the same terminal -> same terminal, but rejects another operation and a contradictory terminal (`src/logs/audit/pg-destination-settings-store.ts:24-26`). An old completion cannot clear a new hold.
- The coordinator dispatches only after an acknowledged admission and current authorization/target checks. An uncertain admission returns unknown before provider deletion. A confirmed no-send refusal may complete only its own intent (`src/accounts/organizations/membership-removal.ts:37-63`).
- An uncertain completion is reread once. Success requires the same organization, operation UUID, and terminal outcome. An absent, pending, contradictory, or overwritten receipt remains unknown (`src/accounts/organizations/membership-removal.ts:66-77`). A new admission can replace an old terminal row before its owner rereads it; this can cause a conservative unknown, but does not permit unsafe replay of an unresolved deletion.
- The lifetime has one total deadline. Close/deadline prevents later local work even if a prior promise later resolves. It does not claim to cancel a sent provider request (`src/accounts/organizations/membership-removal-lifetime.ts:19-49`). A possibly live provider request remains protected by the pending row.
- Hosted shutdown stops the removal owner before closing shared SQL. MCP cleanup is started independently (`src/app/application.ts:173-182`). The production loader provides the same concrete store and runtime to settings and removal (`src/app/logging-storage.ts:28-30`).
- Migration grants are limited to SELECT/INSERT/UPDATE on the new table; PUBLIC and common Supabase API roles lose access, and forced RLS is applied (`sql/migrations/20261025082850_membership_removal_operations.sql:13-45`). The server role intentionally has cross-organization SQL capability; organization scoping is enforced by its parameterized statements, not a tenant-specific RLS predicate.

## Rollout observation: table presence is the activation mechanism

**Classification:** release prerequisite / product error precision; not a new unsafe-delete finding.

**Location:** `src/app/logging-storage.ts:28-30`, `src/logs/audit/pg-destination-settings-store.ts:33-38`, `src/logs/audit/bounded-sql-runtime.ts:109-113`, `src/accounts/organizations/membership-removal.ts:43-45`.

**Scenario:** Existing valid logging-storage configuration supplies a removal store without checking whether the removal migration exists. The UI can offer Remove. An absent table or denied table privilege makes the INSERT throw. Because the SQL runtime marks the operation as a write before sending it, the error becomes `unconfirmed`, then `unknown`, even when the server explicitly rejected the statement. No provider DELETE is dispatched. Once the migration/table grants are present, removal is usable immediately with this code; no separate source activation or notice-version gate exists.

**Smallest correct action:** Preserve the existing release hold and use an explicit deployment order: integrate and approve the exact runtime notice/help, satisfy the prior release prerequisites, apply/verify the migration, and deploy the approved candidate. Check the deployed dependency and one scoped journey. Do not treat merely merging these PRs or applying the migration as an inert preparation step. If rollout must allow code/table provisioning before approval, use one narrow existing deployment gate; do not build a recovery service or new state store.

**Optional later improvement:** Classify a received definite SQL rejection as unavailable/no-send while retaining unconfirmed for connection loss/timeout. This improves support guidance but is not needed to preserve deletion safety. It requires a clear driver error contract; do not add heuristic retries or clear pending rows from a membership read.

The release record already states that the live table is absent, notice integration is pending, and actual release is open (`docs/implementation/admin-s2-5-02.md:112-117`, `:142-153`). Those claims should remain explicit.

## Recovery procedure and evidence limits

- The privilege hold is valid for the specified data-only restore. NOLOGIN blocks new dedicated-role logins; effective INSERT/UPDATE revocation blocks both new admission and completion from surviving sessions. The procedure also requires old sender exit and session containment, verifies effective rather than merely direct grants, excludes ACL/schema/role replay, and rechecks privileges before startup (`docs/implementation/admin-s2-5-02-removal-runbook.md:145-205`). This prevents an empty restored ledger from making removal available.
- This is a hold outside the restored rows, not outside the database. A whole-project/physical restore that rolls back role/table ACLs is not protected by that ACL alone. The procedure correctly excludes shared-project/schema/clean restores. Preserve that scope; do not generalize the drill into proof of arbitrary platform restore recovery.
- Inspected the retained recipe `.cache/s25-02/restore-drill.mts` and its seven-stage `restore/evidence.json` only after reading the production code. It takes an empty data-only snapshot, captures a controlled applied answer in a child before completion, kills that child, revokes effective DML, restores the empty snapshot, enables LOGIN while DML stays revoked, and checks a fresh coordinator sends no DELETE. It then reconstructs the exact captured row and settles it by operation ID before restoring grants.
- The drill's independent applied evidence is controlled IPC from the child directory double. It is independent of the restored SQL row, but it is not an authoritative live WorkOS receipt. The record says this explicitly (`docs/implementation/admin-s2-5-02.md:103-108`).
- Replacement membership and later Admin preservation in the drill are directory-double checks. The SQL snapshot is initially empty; there is no unrelated SQL operation-row sentinel. Thus this drill does not prove a general tenant-selective restore with nonempty unrelated operation rows. Its claimed local empty-snapshot hold scenario is supported. Do not expand the claim or turn it into a new release gate unless that broader restore scope is requested.
- Restart tests launch a real process and use real verified-TLS Postgres, but use a controlled directory. Fresh children intentionally reseed unchanged directory facts. They prove that unchanged reads/restart do not reclaim the durable hold; they do not prove a live provider request's eventual fate (`test/acceptance/auth/membership-removal-restart.runtime.ts:8-36`; `test/support/processes/membership-removal-child.ts:39-49`).
- The lost-write-reply test executes the real SQL statement and then deliberately throws after `client.query` resolves (`test/integration/logging/audit/removal-operations.runtime.ts:65-88`). This supports commit/result-loss handling and durable readback. It does not itself reproduce a kernel/TLS failure during commit. The claim should remain controlled fault proof.

## Focused validation performed in this review

Command:

```sh
node --import tsx --test --test-concurrency=1 \
  test/unit/logging/audit/pg-removal-operation-store.test.ts \
  test/integration/logging/audit/removal-operations.runtime.ts \
  test/acceptance/auth/membership-removal.runtime.ts \
  test/acceptance/auth/membership-removal-restart.runtime.ts
```

Result: **16 tests passed, 0 failed/skipped/cancelled**, about 22 seconds. Seven store unit tests, four real-PG store/composition cases, two real-PG coordinator cases, three crash/restart cases. Source-based execution used no build or dist mutation. Each fixture removed only its own temporary Docker container/volume and temp files. No full gate or live cloud test was rerun. This is focused review evidence, not complete-candidate release approval.

## Simpler current plan

Essential:

1. Keep one pending row per organization, one random operation ID, atomic admission, and same-operation completion. Keep the existing bounded SQL runtime and one 30-second lifetime.
2. Keep current actor/target/last-Admin checks after admission, exact membership deletion, no automatic replay, and unknown outcomes with safe navigation.
3. Keep a short owner procedure for unknown effects: contain old senders, preserve the pending row, obtain exact independent proof, then compare-and-set that exact operation. Keep the data-only restore privilege hold where a restore can erase a pending row.
4. Finish the already identified release dependencies and run the selected final gates once on the release candidate. Use separate controlled fault evidence and scoped live provider evidence.

Needless complexity to avoid:

- No lease, TTL, takeover, replay worker, second store, long-held SQL transaction, background reconciliation, status API, or customer recovery UI is needed for this slice.
- Do not add a new removal-specific pool or encryption key merely to rename the existing shared private SQL ownership. A later rename can improve readability, but is not a safety fix.
- Do not turn future Slice 4 backup cadence/custody/key recovery into new Slice 2.5 release requirements. Keep only the narrow rule that a restore must not erase the safety hold.
- Do not repeat the entire historical test/quality ledger in the working plan. Keep one current blocker list and links to pinned evidence. Preserve the audit history in its existing records.
- Do not rerun the full passing SQL/live suite to improve confidence in unchanged bytes. Add or run a focused scenario only for a concrete unresolved concern.
