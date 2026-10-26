# PR 253 complete-candidate validation selection

Main: `8c6d204e8588a664438ba8934ab36670b802525f`.
Actual parent: `f03a7b73b2c27dc26477d5378a3356f28744a367` (`origin/codex/s2-5-01a-membership-deletion`, PR 251).
Prior head: `0ff3f6cdde5be4124df0ed2ab002844d5db1c502`; prior parent: `122d65bf1f035fc195792cc083732aa05c423c58`.
Stable gate candidate: `fa5d4d7f57ef270df2a056ad523ec22e3b5032b6` (manager supplied and bound in `candidate-pin.json`).

Read AGENTS.md, coding principles, test gate policy, test code layout, package scripts, source/test changes of the parent against main and this increment against its old parent, and the support import/runtime consumers. This is a rebase with conflict resolution only. No new production behavior or tests are in this task. Old runs remain history. They do not validate the new candidate.

## Selected checks

The complete candidate has source changes. Rule 1 applies: locked install and pinned Node 24.20.0; `npm test`; `npm run typecheck`; `npm run build:user-portal`. Run the 18 new or changed ordinary files below after one clean backend build. The full ordinary suite covers all ordinary support consumers and the remaining affected tests.

Additional gates:

| Command | Selection reason |
| --- | --- |
| `pnpm exec node script/pr-review/api-surface.ts --check` | Changed public organization contracts and new public removal-store contract. Read-only verification; manager owns generation. |
| `npm run test:hosted-live` through secure staging launcher | Changed WorkOS reads/removal and hosted composition; three inherited live modules change. If settings are unavailable, record not run with a reason. |
| `npm run test:container` | Accounts, application and logging source affect the self-hosted server and commands. |
| `npm run test:container:hosted` | Hosted composition/lifetime changes. Must execute Linux AMD64. The Docker build runs `npm run build:hosted`; retain and review the full fresh offline checks and renderer output as this selected gate's evidence. |
| `npm run test:logging:postgres` | Removal coordinator/store, SQL runtime/lifetime, migration and changed hosted-storage-failure runtime. New group selects all six files listed below. |
| `npm run test:logging:collector` | Changed WorkOS fake is used by the mounted hosted Audit journey; changed shared runtime paths are also consumed by the real Collector site. |
| `habit-hooks --branch origin/main` | Review complete candidate; keep snooze empty and explain retained findings. |
| `git diff --check` | Conflict/whitespace check. |

Do not add a second `npm run check`, whole interface run, or standalone `build:hosted` after verified fresh nested hosted checks. If the build layer is cached, record the provenance limit and resolve it before claiming fresh hosted-offline success. The hosted image's nested renderer proof does not require another standalone renderer run: no complete-candidate source under fetch composition, renderer, search, cleaner or rules loading changes. Search-live and separate Axiom interface-live are not selected. No deployment or release is requested.

### Focused ordinary selection

```sh
npm run build
node --test --test-concurrency=1 \
  dist/test/acceptance/auth/hosted-membership-deletion.test.js \
  dist/test/integration/auth/hosted-storage-lifecycle.test.js \
  dist/test/integration/auth/workos-connection.test.js \
  dist/test/integration/auth/workos-google-onboarding.test.js \
  dist/test/integration/auth/workos-provider-administration.test.js \
  dist/test/integration/auth/workos-provider-directory.test.js \
  dist/test/integration/auth/workos-provider-organizations.test.js \
  dist/test/integration/auth/workos-removal-lifetime.test.js \
  dist/test/unit/auth-workos/workos-membership-reads.test.js \
  dist/test/unit/auth-workos/workos-organizations-deletion.test.js \
  dist/test/unit/auth-workos/workos-organizations-members.test.js \
  dist/test/unit/auth-workos/workos-organizations-memberships.test.js \
  dist/test/unit/auth-workos/workos-organizations-read-lifetime.test.js \
  dist/test/unit/auth-workos/workos-organizations.test.js \
  dist/test/unit/logging/audit/pg-removal-operation-store.test.js \
  dist/test/unit/organizations/membership-removal-lifetime.test.js \
  dist/test/unit/organizations/membership-removal-outcomes.test.js \
  dist/test/unit/organizations/membership-removal-rules.test.js
```

### PostgreSQL dedicated selection

The actual candidate package command must retain these six files with serial test-file execution:

- `dist/test/acceptance/logging/audit/destination-settings.runtime.js`
- `dist/test/acceptance/logging/audit/hosted-storage-failure.runtime.js`
- `dist/test/integration/logging/audit/destination-settings.runtime.js`
- `dist/test/integration/logging/audit/removal-operations.runtime.js`
- `dist/test/acceptance/auth/membership-removal.runtime.js`
- `dist/test/acceptance/auth/membership-removal-restart.runtime.js`

Ordinary globs do not select `.runtime.ts`. The image build does not launch nested PostgreSQL or Collector containers. This group's changed/new runtime files need this own group command. `MembershipRemovalProcess` -> `membership-removal-child` belongs to restart runtime only. The new migration is read through `loggingSettingsMigrations` by the PostgreSQL site.

## Shared support trace

Organization doubles and the private WorkOS fixture are used by ordinary tests. WorkOSFake and WorkOSFakeDirectory also run in `hosted-storage-failure.runtime.ts` and in `hosted-audit-journey.runtime.ts` -> `openAuditSenderSite().publicJourney()` -> mounted probe -> `runHostedAuditJourney` -> `serveWorkOSSite` -> `WorkOSFake`. These require the PostgreSQL and Collector groups.

`module-paths.ts` consumers include ordinary child-process tests, local/hosted container sites, hosted-live sites, the PostgreSQL migration site and the Collector mount site. This change adds the membership-removal child and migration; retained exported paths do not change. These real consumers are covered by the selected union above. No unrelated runtime/live group is selected just because it shares a folder.

## Limits and provenance

PR 251's rebased PostgreSQL failure and exact-main diagnostic are historical context only. PR 253 changes `hosted-storage-failure.runtime.ts` itself, so its new group must run and its actual outcome must be inspected. Do not transfer PR 251's failure disposition to this candidate. Keep every attempt and retry. Zero tests, skipped cases and todo cases are not passes.

The known R1 display-hydration performance defect remains outside this rebase scope. Keep R1, unmerged parent, pending current-candidate architect/human approval, any failed required gate and any other checker blocker visible. The requested stopping point is Draft; no Ready or merge.

Manager owns metrics, coverage, impact stamping and final classification against the actual parent. Source selection permits all selected complete ordinary suites for coverage. Use fresh combined unit, integration and acceptance coverage: `pnpm exec node script/code-quality/ast-metrics-coverage.ts --suite unit --suite integration --suite acceptance --out ast-report/coverage.json`. All three complete groups are already selected by source rule 1. This matches the empirically useful final coverage scope of the prior PR 253 candidate and avoids unknown coverage for newly added callbacks. This is a new capture, not reuse of prior candidate evidence. Retain any failed/insufficient capture history. Verify runtime, compiler, measurement and source/build identity; do not relabel an old report. The complete candidate's validation against main remains visible.

## Runner boundary

`run-gates.mjs` and `bin/docker` are preparation only until manager review. The manager pins the committed stable head in `candidate-pin.json`, confirms the explicit selection against that head and starts task-owned `colima-thermus-pr253`. The runner rejects unmerged paths, changed refs, or dirty/untracked runtime/build inputs, including SQL migrations. It records gate input hashes, full command, times, Docker context, each attempt and exit/signal. It stops on a failure; resume only after manager review of that failure. Logs use this new cache only. Docker streams and exit status are forwarded unchanged while full build progress is retained.

Pinned Node/npm: `/Users/tomermayara/.nvm/versions/node/v24.20.0/bin`. Lightpanda: `.cache/lightpanda/1.0.0/lightpanda`. Axiom keys are read from the existing primary checkout `.env.local` into only the ordinary child process, without changing files or printing values. WorkOS live uses the existing Keychain staging launcher; the old origin alias is intentional and must stay. Root owns Docker startup, gate launch, evidence scan and publication. No gate was run during preparation.
