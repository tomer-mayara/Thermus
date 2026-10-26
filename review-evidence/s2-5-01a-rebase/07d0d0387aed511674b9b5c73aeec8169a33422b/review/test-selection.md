# PR 251 complete-candidate check selection

Selection compares `581f30cfaa32b01399422b087b0f0bdc3b800f70` with
`e1e55dc04f5afa1e46eab5946067683fa496aaa6`. It follows that base's AGENTS.md,
coding principles, test gate policy, and test code layout. The PR changes source
under `src/accounts/` and `src/app/`, so source selection takes precedence.

Before Ready, run the following with pinned Node 24.20.0 and installed locked
dependencies. Record each result and any unavailable prerequisite.

```sh
npm test
npm run typecheck
npm run build:user-portal
npm run test:container
npm run build:hosted
npm run test:container:hosted
npm run test:hosted-live
habit-hooks
pnpm exec node script/pr-review/api-surface.ts --check
```

The hosted image must pass on Linux AMD64. Run hosted-live through the staging
launcher when its settings are available. If unavailable, record not run;
missing settings and skipped cases do not constitute a pass. The changed live
compositions belong to that dedicated group.

The separate renderer, search-live, logging PostgreSQL, and logging Collector
gates are not selected by this increment. It changes none of their source
behavior. The hosted offline build still includes its own renderer phase.
Do not add `npm run check` or a separate complete interface suite after the
ordinary suite: those would repeat selected checks.

The new and changed ordinary files need focused execution before commit. A
clean backend build can prepare them together:

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

Source metrics and architecture evidence must describe the current candidate.
After the final source/test changes, use:

```sh
pnpm exec node script/code-quality/ast-metrics-snapshot.ts --base origin/main
pnpm exec node script/code-quality/ast-metrics-snapshot.ts
pnpm exec node script/code-quality/ast-metrics-process.ts --base origin/main --collect-coverage --json ast-report/process.json
pnpm exec node script/code-quality/ast-metrics-crap.ts --base origin/main --json ast-report/crap.json
pnpm exec node script/pr-review/check.ts --base origin/main --repo tomer-mayara/Thermus \
  --impact ast-report/impact.json \
  --base-snapshot ast-report/snapshot-base.json --head-snapshot ast-report/snapshot.json \
  --crap ast-report/crap.json --process ast-report/process.json --review ast-report/review.json
```

Verify `origin/main` still resolves to the pinned base before these comparisons.
Stamp the committed impact declaration with the actual head and merge base, as
the checker guide says. Inspect eligibility and blockers, not only exit status.
Refresh the evidence if committing the required new metric record changes head.

Old PR test passes remain history. They do not validate the rebased complete
candidate. Upstream changed production source, tests, and the coverage mapper,
so old source/input-bound coverage and current comparison reports are stale.
Do not relabel or edit them. Preserve immutable metric history as history.

A verified report may be reused only when the tool confirms all source,
input/build, runtime, compiler, measurement, and selected-suite identities.
The commit label alone proves no compatibility. Fresh coverage is permitted
here because the source rule selects both complete unit parts. A later
document-only commit may reuse that fresh report if the checked identities
still match. Current base/head snapshots, process, CRAP, impact, and review
must remain bound to the current comparison and preserve provenance.
