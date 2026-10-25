# S2.5-R1 validation plan

Prepared on 2026-10-25. This is a plan, not a check result. No test, build,
metrics process, Docker mutation, or PR action ran in this planning task.

## Candidate and selection

- Branch: `codex/s2-5-r1-removal-facts`; draft PR #257.
- Actual parent: PR #255, `0530dd634fe8302b55d4a0669463ef733199cc40`, local
  ref `origin/codex/s2-5-02-removal-verification`.
- Planning HEAD: `1a192d743a4c71ae6faebfd00f7ae6fd4c72ea0e`.
- Current main: `581f30cfaa32b01399422b087b0f0bdc3b800f70`. It contains
  separate Audit fixes. The actual full-stack merge base remains
  `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.
- The parent evidence binding in `.cache/s25-review/candidate-binding.json`
  covers `0530dd63` and says that its production/test/configuration bytes
  equal the earlier reviewed `806ccc57`. It does not cover this source repair.

Select from all changes against the actual main merge base, plus staged,
unstaged, and new files. The full stack changes source in organizations,
WorkOS, application composition, web account pages/routes, Audit encoding and
PostgreSQL storage. Thus AGENTS.md and the test gate policy select the full
ordinary suite, typecheck, portal build, private PostgreSQL, Collector, Members
browser, WorkOS staging, self-hosted container, hosted offline build, and hosted
AMD64 image. The image's nested build supplies the hosted offline build.

Do not run `npm run check`, separate complete unit/integration/acceptance/
interface/portal groups, or a separate host `npm run build:hosted` after the
required commands below. These would repeat coverage already selected.
The renderer runtime files run inside the hosted image's offline build; no
changed renderer/search/rules source independently selects another host renderer
gate. Search live, the separate Axiom `.live.ts` interface proof, manual work
slices, destination smoke, production release/restore drill, and operator cutover
are outside this repair request. Do not treat them as PR gate passes.

## Prerequisites and safe environment

Use Node `v24.20.0` and pnpm `12.10.1` (both verified). Policy requires
`pnpm install --frozen-lockfile` before checks; existing `node_modules` is not
proof that this was done for the final candidate. This installation can build
native code; run it before test execution, while no other process uses outputs.

Use this absolute renderer path for commands that need it:

```sh
export LIGHTPANDA_BIN="/Users/tomermayara/.codex/worktrees/c617/Thermus/.cache/lightpanda/1.0.0/lightpanda"
```

The checkout has no `.env.local`. Axiom's source file is
`/Users/tomermayara/git/Thermus/.env.local`. It has nonempty `AXIOM_API_KEY` and
`AXOIM_ENDPOINT_URL`; the test dataset is permitted. Give only those settings
and `AXIOM_SYSTEM_LOG_TEST_DATA_SET=system-log-test` to the ordinary-suite child.
Do not `cat`, shell-source, copy, or log the file. A safe process-only launcher
can use Node `parseEnv` and `spawnSync`:

```js
const { readFileSync } = require('node:fs');
const { parseEnv } = require('node:util');
const { spawnSync } = require('node:child_process');
const settings = parseEnv(readFileSync('/Users/tomermayara/git/Thermus/.env.local', 'utf8'));
const child = spawnSync('npm', ['test'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    AXIOM_API_KEY: settings.AXIOM_API_KEY,
    AXOIM_ENDPOINT_URL: settings.AXOIM_ENDPOINT_URL,
    AXIOM_SYSTEM_LOG_TEST_DATA_SET: 'system-log-test',
  },
});
if (child.error) throw new Error('Cannot start the ordinary suite.');
process.exit(child.status ?? 1);
```

Run that wrapper with Node from the repository root; it prints no values.
The ordinary Axiom acceptance/interface files send logs to `system-log-test`.
The interface suite also needs public access and Lightpanda.

For staging, use the existing Keychain-backed launcher:
`/Users/tomermayara/.config/thermus/with-workos-staging.cjs`. A read-only boolean
probe confirmed a staging key, client ID, and issuer. The launcher's allowlist
requires the preserved old `3-headed-monkey/Thermus` origin alias. Keep that
alias. Do not change a remote or the launcher to run tests. Do not print or
persist the key. The gate's provider preflight must still prove the password-only
settings; the boolean probe proves only local availability.

All Docker gates must inherit an explicit `DOCKER_CONTEXT`. If an isolated
profile is used, prefix every Docker-using command with:

```sh
env -u DOCKER_HOST -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH -u BUILDX_BUILDER DOCKER_CONTEXT=colima-thermus-s25-r1 <command>
```

See `environment.md` for the proposed local profile and capacity limits. No global
Docker context switch, shared-resource cleanup, cloud resource, or paid service
is needed.

## Acceptance-first and focused R1 checks

The source worker owns the red/green record. At planning time it had added:

- `test/acceptance/auth/hosted-member-removal-budget.test.ts`: the removal
  regression through the public hosted boundary, with expensive unused display
  reads, current Admin protection, and exact removal outcome.
- `test/unit/auth-workos/workos-organizations-member-facts.test.ts`: the new
  facts-page contract, without display hydration.

After each relevant build, their exact focused commands are:

```sh
node --test dist/test/acceptance/auth/hosted-member-removal-budget.test.js
node --test dist/test/unit/auth-workos/workos-organizations-member-facts.test.js
```

A direct command requires a successful `npm run build` of the same source first.
Do not rebuild while the source worker runs a focused test. Before commit, run
each other new or changed R1 ordinary test locally too, using its emitted path.
Refresh this list after the worker finishes. Existing tests that directly cover
the repaired collaboration include WorkOS organization membership/member reads,
read lifetime, organization removal rules/lifetime/outcomes, WorkOS removal
lifetime integration, and hosted member removal/scope/self-removal. Shared
directory and WorkOS doubles also feed the ordinary auth/hosted-admin cases and
the runtime/browser/live groups listed below. The complete ordinary command
covers all ordinary consumers; the separate gates cover the other consumers.

## Minimal complete-candidate command sequence

Freeze the source and test bytes first. Save full HEAD, parent, main, actual
merge base, dirty-path list (if any), command arguments, start/end time, exit,
logs, and test counts. After a later source edit, do not call earlier results
current. Use one runner for this checkout because `npm run build` deletes
`dist/`. Gate package scripts rebuild it. Do not overlap any gate with a build,
coverage collection, source edit, or metrics checkout/comparison.

1. `pnpm install --frozen-lockfile`; verify `pnpm exec node --version`.
2. Run the focused R1 tests above and all other R1 changed tests. The worker's
   current focused checks can supply this phase if their byte identity is kept.
3. Run **`npm test` once** through the Axiom wrapper with `LIGHTPANDA_BIN`.
   It builds backend output and selects every ordinary backend and portal test.
   The self-hosted container file is intentionally skipped in this ordinary run;
   this is not its dedicated pass. Hosted image is excluded by basename.
4. Run **`npm run typecheck`**, then **`npm run build:user-portal`**.
5. Run **`npm run test:logging:postgres`** in the pinned test Docker context.
6. Run **`npm run test:logging:collector`** in that same pinned context.
7. The preceding PostgreSQL/Collector command leaves current backend output and
   phase 4 leaves current portal assets. Run the Members file directly:
   `THERMUS_BROWSER_EVIDENCE_DIR="$PWD/.cache/s25-r1/browser" node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js`.
   This is the same selected browser file as the policy command, with both
   prerequisite builds already satisfied. If source/assets changed, rebuild
   before this command. Review the retained 390 x 844 screenshot.
8. Run **`npm run test:hosted-live`** through the WorkOS launcher, with
   `LIGHTPANDA_BIN` and pinned `DOCKER_CONTEXT`. Exact example:
   `env -u DOCKER_HOST -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH -u BUILDX_BUILDER DOCKER_CONTEXT=colima-thermus-s25-r1 LIGHTPANDA_BIN="$LIGHTPANDA_BIN" node /Users/tomermayara/.config/thermus/with-workos-staging.cjs npm run test:hosted-live`.
   The script builds backend and portal, then runs both live files in sequence.
   Keep ports 46443 and 46480 free and allow no other hosted live/work-slice run.
   Record scoped fixture cleanup and the fact that the removal file currently
   records fixture evidence under `.cache/s25-02/live`.
9. Run **`npm run test:container`** in the pinned context.
10. Run **`npm run test:container:hosted`** in the pinned context. Its real
    Docker build and runtime force `linux/amd64`. The nested `build:hosted`
    supplies all hosted offline checks, including both renderer runtime files.
    Record the nested build log as well as the outer seven image assertions.

The order keeps fast failures first and runs costly image work last. Run Docker
gates sequentially. Do not run a separate image build just to warm the cache.
If gates fail for disk, DNS, setup, or provider state, retain the first log and
record the exact unchanged retry and scope. Do not relax an assertion, timeout,
network policy, or environment gate to get a green result.

## Exact dedicated file groups

`npm run test:logging:postgres` selects these seven emitted files, in sequence:

- `test/acceptance/logging/audit/destination-settings.runtime.ts`
- `test/acceptance/logging/audit/hosted-storage-failure.runtime.ts`
- `test/integration/logging/audit/destination-settings.runtime.ts`
- `test/integration/logging/audit/removal-operations.runtime.ts`
- `test/acceptance/auth/membership-removal.runtime.ts`
- `test/acceptance/auth/membership-removal-restart.runtime.ts`
- `test/acceptance/auth/hosted-member-removal-integrated.runtime.ts`

`npm run test:logging:collector` selects:

- `test/integration/logging/audit/audit-sender.runtime.ts`
- `test/acceptance/logging/audit/hosted-audit-journey.runtime.ts`

The Members browser file is
`test/acceptance/auth/hosted-member-removal-browser.runtime.ts`.
The WorkOS live group is `test/acceptance/auth/hosted.live.ts` followed by
`test/acceptance/auth/hosted-removal.live.ts` (fresh exact fixtures and SQL).
The dedicated container files are
`test/acceptance/auth/self-hosted-container.test.ts` and
`test/acceptance/auth/hosted-image.test.ts`.

All emitted paths replace `.ts` with `.js` and start with `dist/`.

## Quality/checker handoff

The manager must also run complete-candidate habit-hooks, keep snooze `[]`,
refresh changed public declarations, inspect the registry, and run the required
source metrics/impact process. These are separate checks, not behavioral gates.
Use `habit-hooks --branch origin/main --no-snooze` for the full-stack report;
dispose every enforced finding. Compare the R1 API/architecture/MI/CRAP increment
against the actual parent `0530dd63`, not current main's unrelated Audit work.
Keep complete-candidate validation against the actual main merge base visible.

The old coverage is stale after this source repair. If only a unit capture is
needed, collect it once with
`pnpm exec node script/code-quality/ast-metrics-coverage.ts --suite unit --out ast-report/coverage.json`,
then give that compatible report to the process with `--coverage`; do not also
use `--collect-coverage`. If the coordinator needs the same full coverage union
as the parent evidence, request `--suite unit --suite integration --suite acceptance`
once, with the Axiom process environment. All three groups are already selected,
but this intentionally repeats them for instrumented metrics evidence. A compatible
fresh capture can be reused by later process runs. Do not edit coverage or reuse
parent bytes as a new repair measurement. Do not run metrics comparisons while a
test/coverage command uses this checkout. Source edits require fresh affected
coverage and final evidence. The manager owns final base choice and reports.

No earlier pass count is a promised current count. A gate is passed only on exit
0 with nonzero selected tests and all required cases passed. Keep skip/todo,
failure/retry history, and environment limits explicit. Draft status and required
human approval remain separate from behavioral success.
