# PR 251 complete-candidate validation selection

Base: `8c6d204e8588a664438ba8934ab36670b802525f`.
Stable rebased head: `fd7fa0b1e53d653f92168b75ba4d65618a9138a8`.
Prior PR head: `07d0d0387aed511674b9b5c73aeec8169a33422b`.

Read AGENTS.md, coding principles, test gate policy, test code layout, package scripts, the full candidate source/test delta, and prior local evidence. This is a behavior-preserving rebase. No new source behavior or new test is needed. Before a gate, bind its inputs to the stable head and base. Source-free document edits may coexist; record them in the run binding and refresh final evidence after commit. Old passes are history and do not validate the new runtime inputs.

## Required runs

Three source paths change: the organization directory contract, WorkOS organization adapter, and hosted WorkOS composition. Source selection takes precedence. Run locked installation, verify pinned Node 24.20.0, then:

| Run | Reason |
| --- | --- |
| `pnpm install --frozen-lockfile` | Required locked dependencies; cached runtime may avoid downloads. |
| `pnpm exec node script/pr-review/api-surface.ts --check` | Changed public directory declaration; check only. Manager owns generation if needed. |
| Focused changed ordinary files listed below | Required local new/changed test evidence before commit. |
| `npm test` | Complete ordinary unit, integration, acceptance, interface and portal source suites. |
| `npm run typecheck` | Required source check, including portal types. |
| `npm run build:user-portal` | Required source portal build. |
| `npm run test:hosted-live` through the secure staging launcher | WorkOS organization reads/composition and three changed live case modules. Record unavailable settings as not run. |
| `npm run test:container` | `src/accounts/` and `src/app/` affect self-hosted composition. |
| `npm run test:container:hosted` on Linux AMD64 | Hosted source changes. Its Dockerfile invokes the complete `npm run build:hosted` with network disabled. Preserve full build output as hosted offline evidence. |
| `npm run test:logging:postgres` | Changed WorkOS fake is a real consumer in hosted storage-failure runtime acceptance. |
| `npm run test:logging:collector` | Changed WorkOS fake is a real consumer in the mounted hosted Audit journey. |
| `habit-hooks` | Complete-candidate quality review; keep snooze empty and disposition retained findings. |
| `git diff --check` | Conflict and whitespace review. |

Do not add a second `npm run check`, whole interface run, or standalone hosted offline build after successful nested hosted image checks. The image build executes `build:hosted`, including the real renderer phase; its log must show the command, all selected phases, and successful completion. If BuildKit reuses that whole check layer, it is not fresh runtime evidence: report this and resolve the cache/provenance limit before calling the offline gate passed.

Standalone renderer and search-live gates are N/A: no fetch composition, search, renderer, cleaner or rules-loading source changes. The ordinary suite already covers the ordinary Axiom files; the separate Axiom `.live` proof is not selected. No release or deployment is requested.

### Focused changed ordinary files

A single clean backend build prepares this explicit, serial Node test command:

```sh
npm run build
node --test --test-concurrency=1 \
  dist/test/acceptance/auth/hosted-membership-deletion.test.js \
  dist/test/integration/auth/workos-connection.test.js \
  dist/test/integration/auth/workos-google-onboarding.test.js \
  dist/test/integration/auth/workos-provider-administration.test.js \
  dist/test/integration/auth/workos-provider-directory.test.js \
  dist/test/integration/auth/workos-provider-organizations.test.js \
  dist/test/unit/auth-workos/workos-membership-reads.test.js \
  dist/test/unit/auth-workos/workos-organizations-deletion.test.js \
  dist/test/unit/auth-workos/workos-organizations-members.test.js \
  dist/test/unit/auth-workos/workos-organizations-memberships.test.js \
  dist/test/unit/auth-workos/workos-organizations.test.js
```

### Shared-support trace and correction

The organization directory double and its record conversion are used by ordinary organization unit, integration and acceptance tests. The WorkOS fake and fake directory are used by ordinary WorkOS flows. `npm test` covers those consumers. Their private unit fixture remains in the same unit group.

Two additional real runtime consumers require their dedicated groups:

- `hosted-storage-failure.runtime.ts` imports `WorkOSFake` and calls `composeApplicationWithWorkOSFake`. Its current membership reads execute the fake directory's changed list filter, even when `deletedMembershipIds` is empty. Select `test:logging:postgres`.
- `hosted-audit-journey.runtime.ts` calls `openAuditSenderSite().publicJourney()`. The site mounts the emitted source/support tree and runs `hosted-audit-journey-probe`, which calls `runHostedAuditJourney` -> `serveWorkOSSite` -> `WorkOSFake`. This is runtime use across a container mount, not only the site's type import of the journey result. Select `test:logging:collector`.

This corrects prior #251 evidence that marked both logging groups N/A. The correction follows the current complete candidate and the shared-support rule; it needs no source change. The manager confirmed this selection.

## Coverage and review evidence

Manager owns metrics and coverage after gates. Start with fresh unit-only capture through `ast-metrics-coverage.ts --suite unit --out ast-report/coverage.json`. This collects both complete unit parts, which source selection permits, and matched the prior changed-function measurement scope. Use the current mapper and current stable source/build inputs; do not relabel old captures. The tool must verify full completion and input/runtime/compiler/measurement identities. If changed functions miss goals or coverage is unknown, select any further coverage only from already selected complete groups and retain the failure history.

Run the required base/head snapshots, process, CRAP, architecture/registry assessment and review-tier checker against the pinned base and current committed head. The manager stamps impact and owns any resulting metric history commit. Use compatible coverage in the process to avoid another collection; a new document-only head may reuse that new report only after identity verification. Public contract changes retain architecture review requirements. This file is test selection, not approval or merge eligibility.

## Environment and runner

Detected Node, npm, pnpm, habit-hooks, Docker, Colima, OpenSSL and Git executables. Node/npm are in `/Users/tomermayara/.nvm/versions/node/v24.20.0/bin`. The cached Lightpanda binary and secure staging launcher exist. Their presence alone does not prove runnable prerequisites. Ordinary tests need process-only Axiom settings from the existing primary checkout `.env.local`, public network and Lightpanda 1.0.0. The runner parses only the Axiom keys into the ordinary child environment and never prints values or edits settings. The secure staging launcher reads its WorkOS key from Keychain and verifies the repository origin; live settings, configured fixtures, Chromium, loopback and ports 46443/46480 must still work.

The manager prepares the owned `colima-thermus-pr251-r2` Docker context. The prior `colima-thermus-rebase251` context was deleted. Do not use the default shared Docker VM for these gates. Containers need Buildx/Compose; hosted image needs Linux AMD64 execution and public HTTPS; logging groups need pinned container pulls/cache and OpenSSL. Keep existing telemetry settings and network isolation. Cleanup belongs only to task-owned resources.

`validation/run-gates.mjs` is a fresh, serial runner. It rejects dirty or untracked runtime/build inputs, records concurrent source-free document changes, and writes attempt logs, a gate ledger and full Docker build streams to this new cache root, preserves original commands/selections and stops at a failure. Its Docker wrapper forwards the real command's streams and exit status while retaining build progress. It does not bypass checks. The old runner is unsuitable unchanged because it binds an old output directory, deleted context and mutating API generation.

After manager review and launch authorization:

```sh
node .cache/pr251-rebase-8c6d204e/validation/run-gates.mjs
# Bound a run, or resume explicitly after a reviewed failure:
node .cache/pr251-rebase-8c6d204e/validation/run-gates.mjs ordinary portal
```

No gate was executed while preparing this selection. For every run retain exact commands, start/end, exit/signal, test counts and failures/retries. Zero tests, skips and todos do not prove a pass. Keep prior evidence immutable. Do not publish credential-bearing logs without the manager's evidence scan.
