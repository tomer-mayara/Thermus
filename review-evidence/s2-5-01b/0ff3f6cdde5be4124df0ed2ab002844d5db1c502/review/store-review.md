# S2.5-01b durable store review

This report covers the shared SQL store, its public contract, migration, store tests, restart proof, loader proof, and the extended hosted storage outage case. The manager owns the full candidate, architecture classification, metrics, required suites, commit, and pull request. No source change was made for the habit fixes.

## Result

The existing `PgDestinationSettingsStore` now implements `RemovalOperationStore` through its existing `BoundedSqlRuntime`. The production loader exposes that same concrete store for both roles. There is one persistent row for each organization. Admission can replace only a terminal row. Pending intent returns busy. Completion matches organization and operation ID. A repeated matching terminal completion is allowed; a different terminal or stale operation is rejected. Terminal receipts remain readable until a new operation is admitted.

The statements have no delete, lease, queue, replay, worker, or transaction across provider HTTP. Query failure after a write is marked unconfirmed. Failed acquisition is unavailable. Unit checks prove that clients are released before the store promise resumes its caller. Separate-pool SQL checks prove contention, organization isolation, persistence after reopen, and stale completion protection.

## Red and green evidence

- Store unit red: 0/7. The new methods did not exist. `../checks/store-unit-red.log`.
- Store and existing settings unit green: 14/14. `../checks/store-unit-green.log`.
- SQL store red: 0/3. The removal table did not exist. `../checks/store-sql-red.log`.
- SQL store green: 3/3. `../checks/store-sql-green.log`.
- Restart acceptance red: 0/3 while the coordinator API did not exist. Child failure context records TypeError without exception text. `../checks/restart-red.log`.
- Restart acceptance green: 3/3, including a repeat after coordinator lifetime hardening. `../checks/restart-green-initial.log`, `../checks/restart-bounded-controller.log`, and the final focused log below.
- Production-loader proof passed first as characterization, 4/4 with the other SQL integration cases. No red was manufactured. `../checks/store-loader-characterization.log`.
- Hosted SQL outage extension passed first as characterization, 1/1 selected case. No red was manufactured. `../checks/store-outage-characterization.log`.
- Final focused run after coordinator hardening: 23/23. This selects 7 removal units, 7 existing settings units, 4 SQL integration cases, 3 process restart cases, and both hosted storage outage cases. `../checks/store-restart-final-focused.log`.
- A concurrent typecheck found one new test callback type error: `SystemLog.error` accepts unknown. The error collector was corrected to `unknown[]`. The final typecheck passed. `../checks/store-restart-final-typecheck.log`, `../checks/store-restart-final-typecheck-green.log`.
- The loader case was rerun after that type-only correction: 1/1. `../checks/store-loader-final.log`.
- The final habit-only test changes use a tuple and an asserted winner instead of non-null assertions. A scoped `AsyncDisposableStack` keeps lock release and settlement ahead of container cleanup without a mutable holding binding. The focused two-file rerun and typecheck are recorded in `../checks/store-habit-fixes-focused.log` and `../checks/store-habit-fixes-typecheck.log`; their final results are appended below.

The focused command for the final 23-test run was:

```sh
node --import tsx --test --test-concurrency=1 test/unit/logging/audit/pg-removal-operation-store.test.ts test/unit/logging/audit/pg-destination-settings-store.test.ts test/integration/logging/audit/removal-operations.runtime.ts test/acceptance/auth/membership-removal-restart.runtime.ts test/acceptance/logging/audit/hosted-storage-failure.runtime.ts
```

No shared `dist` build or full suite was run by this worker. The manager will run those checks on the full candidate.

## Process and outage proof

The restart cases launch the real coordinator and SQL store in an owned child process. They pause after committed admission, during the provider call, and after a positive provider response before SQL completion. Another pool observes the same pending operation before SIGKILL. A fresh process then refreshes Members against unchanged provider facts and submits a valid conflicting request. Each case returns busy, sends zero new provider deletes, and preserves the exact pending operation.

Only the owned child can be killed. Crash cleanup is bounded at 3 seconds and normal exit at 5 seconds. The driver uses the existing coverage crash seal protocol when capture is active. Credentials travel by IPC. Failure text contains safe stage/result fields, error class, exit state, and output byte counts. It does not retain stdout or stderr contents.

The outage case uses the real WorkOS directory and pinned SDK against the local WorkOS fake. A current Admin and an ordinary active second-Admin target have a current provider revision. Settings and removal statements share the hosted application's one-slot SQL runtime. Both tables are locked. While a settings read holds the slot, removal returns unavailable before admission. Once that read times out, dispatched admission waits on the removal table and returns unknown. Both paths send zero provider deletes. The MCP article and health response remain available. Lock cleanup is registered before container cleanup and waits for the held transaction to settle.

## Manual privilege proof

`../manual-sql-privileges.mjs` ran a manual SQL check in one owned PostgreSQL 17 container with networking disabled. This is a manual check, not a test of a migration script. It established `anon`, `authenticated`, and `service_role` before applying the migrations. `service_role` had BYPASSRLS. Owner defaults granted ALL on schemas and tables to those API roles and PUBLIC. Before the new migration, owner defaults also granted ALL on tables to the runtime role.

The result was PASS. All three API roles had no schema USAGE or CREATE and no SELECT, INSERT, UPDATE, or DELETE on the new table. The runtime role had schema USAGE and table SELECT, INSERT, and UPDATE, with no schema CREATE or table DELETE. RLS was enabled and forced. Direct API reads failed on schema privilege checks. A direct runtime DELETE failed on table privilege checks. The container and temporary directory were removed. Safe output is in `../checks/store-sql-privileges.log`.

## Migration scaffold provenance

Supabase CLI 2.122.0 help was read before the migration attempt. The official cached JavaScript shim delegates to the native platform CLI. This exact local command failed:

```sh
pnpm dlx supabase --workdir .cache/s25-01b/supabase-cli migration new membership_removal_operations
```

The exact error was:

```json
{"_tag":"Error","error":{"code":"ProfileLoadError","message":"failed to read profile: open /tmp/pr115-supabase-readonly-profile.toml: no such file or directory"}}
```

No profile or wrapper was changed or bypassed. The manager authorized a local SQL-file fallback. The filename `20261025082850_membership_removal_operations.sql` was derived from actual UTC scaffold time with the repository's existing filename convention. The SQL was then exercised through the source store in disposable PostgreSQL. No live Supabase call, schema write, resource purchase, or persistent Supabase framework was used.

## Composition review and limits

Read-only review found correct sharing in `openLoggingStorage`, `composeLoggingStorage`, and the hosted application composition. The WorkOS composition preserves the removal store when it wraps storage closure. The coordinator closes before the shared SQL runtime. One existing lifecycle assertion expected synchronous storage close; it was reported red, 1/2, because the new ordered await yields before storage cleanup begins. The manager owns that test correction. Evidence: `../checks/store-composition-lifecycle-review.log`.

The new contract and methods change public declarations. The store adds a type-only dependency on the organization-owned contract. The manager must maintain the public surface snapshots and architecture evidence and assess the full candidate. This worker review is not independent human architect approval.

The SQL checks use disposable PostgreSQL, not live Supabase. They prove the stated grants under broad local defaults; they do not audit live project settings. The provider is an external-system fake, not live WorkOS. Restart checks prove durable hold behavior across actual process termination; they do not establish whether a real remote deletion settled. Operator containment, backup restore, independent identity-provider writes, browser removal routes, and live release verification remain outside this worker's scope. Current reads and missing rows are not settlement proof. No replay or recovery authority was added.

## Habit-only follow-up

The two touched test files passed 6/6 after the habit fixes. There were no skips or todos. `../checks/store-habit-fixes-focused.log` records this run. `git diff --check` passed. The same typecheck reported one concurrent test error outside this worker's files: `test/integration/auth/workos-removal-lifetime.test.ts:61` supplied a Billing double without `updateSeats`. The manager and coordinator worker were notified. That error is not waived; a final typecheck is still needed after its correction.

The earlier 23/23 run and green typecheck precede the final provider-read deadline work. They are focused evidence for the stated store and restart checks, not complete-candidate signoff. The manager must refresh required complete-candidate evidence after the last source change.

The coordinator worker then corrected the Billing double. A fresh `pnpm exec tsc --noEmit --pretty false` passed with no diagnostics. Final typecheck evidence is `../checks/store-habit-fixes-typecheck-green.log`. The preceding failure log is retained as history. This resolves the typecheck issue noted above; the manager still owns full candidate checks after all source work.
