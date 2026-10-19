# Test gate policy

This policy selects the test commands and gates for a Thermus pull request.
[AGENTS.md](../../AGENTS.md) gives the rules, and this policy gives the details.
If the two disagree, follow AGENTS.md and correct this policy.

## Suite commands

Run each command from the repository root. `pnpm <script>` runs the same
package script. Each package command that runs `dist/` output makes a clean
build first. A direct focused command must build first too. A build prepares
outputs; it does not select more test groups.

The table is an inventory of commands. The [required runs](#required-runs)
select which commands apply to a pull request. A command in this table is
not a requirement for every change.

Install dependencies with `pnpm install --frozen-lockfile` before the checks.
The manifest and lockfile pin Node 24.20.0 for pnpm scripts, including non-login
workers. The initial installation needs network access if that runtime is not
cached. `pnpm exec node --version` must report `v24.20.0`. For direct `npm` or
`node` commands, select the same version with `nvm use` or your runtime manager.

| Suite | Command | Selects | Needs |
| --- | --- | --- | --- |
| Unit | `npm run test:unit` | `dist/test/unit/**/*.test.js` and `test/unit/user-portal/**/*.test.ts` | Offline. No renderer. |
| Build | `npm run test:build` | `test/unit/build-output.test.ts`, from source | Offline. It builds temporary projects with the real compiler. |
| Integration | `npm run test:integration` | `dist/test/integration/**/*.test.js` | Offline. |
| Acceptance | `npm run test:acceptance` | `dist/test/acceptance/**/!(hosted-image).test.js` and `test/acceptance/user-portal/**/*.test.ts` | Axiom ingest credentials and public network access for the OTel logger test. |
| Interface | `npm run test:interface` | `dist/test/interface/**/*.test.js` | Lightpanda 1.0.0, Axiom ingest credentials, and public network access. |
| Axiom interface | `npm run test:interface:axiom` | `dist/test/interface/logging/otel-logger-axiom.live.js` | Axiom ingest credentials and public network access. Writes one test log to `system-log-test`. |
| Signup provider contract | `npm run test:interface:workos-signup` | `dist/test/interface/auth/workos-signup.live.js` | Configured Thermus WorkOS Staging key and client, and public network access. Creates and deletes disposable organizations only. Production keys are refused. |
| Portal | `npm run test:user-portal` | Portal unit and acceptance tests from TypeScript source | Offline. Local DOM and provider doubles. |
| All | `npm test` | `dist/test/**/!(hosted-image).test.js` and portal source tests: the unit, integration, acceptance, and interface suites | Lightpanda 1.0.0, Axiom ingest credentials, and public network access. |
| Container | `npm run test:container` | `dist/test/acceptance/auth/self-hosted-container.test.js` with `THERMUS_CONTAINER_GATE=1` | Docker Engine with Buildx and Compose. The image build needs network access, or a build cache with the pinned images, the packages, and the Lightpanda asset. The containers under test run without outbound access. The gate supplies its own trusted rules fixture; `ad-rules.txt` next to `compose.yaml` is the operator's file. |
| Hosted offline build | `npm run build:hosted` | `check`, all emitted integration tests, the explicit acceptance/interface selection, and the renderer gate below | No live credentials or public network access. Pinned absolute `LIGHTPANDA_BIN`, OpenSSL, free local port 46443, and local loopback access. The Docker build supplies the renderer. |
| Hosted image | `npm run test:container:hosted` | `dist/test/acceptance/auth/hosted-image.test.js` only | Docker Engine with Buildx and a Linux AMD64 builder/runtime, native or emulated. Image build needs network access or cached pinned inputs; the renderer test needs HTTPS egress to `https://example.com/`. No live WorkOS or Axiom credential. |
| Hosted live | `npm run test:hosted-live` | `dist/test/acceptance/auth/hosted.live.js` only, after a build of the portal | A WorkOS staging environment with its settings and dashboard configuration, public network access, Playwright Chromium, OpenSSL, and free local ports 46443 and 46480. The [hosted live gate](#hosted-live-gate-auth-06) gives the details. |
| Renderer | `npm run test:mcp:renderer` | `dist/test/acceptance/mcp/get-url-as-markdown.runtime.js` | `LIGHTPANDA_BIN` with the absolute path of the pinned Lightpanda 1.0.0 executable. No public network access and no Axiom credentials: the pages are local fixtures on `127.0.0.1`. |

`npm run check` runs `npm run typecheck`, `npm run test:unit`,
`npm run test:build`, the portal acceptance tests, and `npm run build:user-portal`.
The backend unit command uses `node --test --test-concurrency=1` with the
complete unit glob. It runs one test file at a time, so other unit files do not
compete with the child processes that check work deadlines. Test selection,
process isolation, assertions, and deadlines stay unchanged.
It does not run the full integration, acceptance, interface, or container suites,
the hosted image gate, or the renderer gate. `npm test` does not run the build test, because `tsconfig.build.json`
excludes it from `dist/`. Only `npm run test:hosted-live` runs the hosted live file.
The ordinary `test` and `test:acceptance` commands use the quoted Node glob
`**/!(hosted-image).test.js` to exclude the hosted image test by basename.
Node 24.20.0 supports this exclusion. Only `npm run test:container:hosted` runs
that gate; the ordinary commands do not register it as a skipped test.

`npm test` and `npm run test:acceptance` also select the container test file.
Without `THERMUS_CONTAINER_GATE=1`, its suite is skipped and runs no test. Only
`npm run test:container` sets the setting.

The renderer gate file uses the `.runtime.ts` name, so `npm test` and
`npm run test:acceptance` do not select it. `npm run test:mcp:renderer`
runs it directly, and `npm run build:hosted` runs the same complete file as its
last phase. The [renderer gate](#renderer-gate-mcp-p03) section gives the rules.

The interface suite needs the pinned Lightpanda executable. It also contains a
public-site smoke test that needs public network access.
[Lightpanda runtime](../lightpanda-runtime.md#verify-rendering) gives the setup
and separate commands for the local fixture tests and the smoke test.

The OTel acceptance and interface tests export to Axiom's `system-log-test`
dataset on every run. They also use a loopback receiver to check the HTTP payload
and need no renderer. The separate Axiom interface file uses `.live.ts`, so the
normal test globs do not select it. All three files need `AXIOM_API_KEY` and
`AXOIM_ENDPOINT_URL`, from the environment or the repository's `.env.local`.
`AXIOM_SYSTEM_LOG_TEST_DATA_SET` defaults to `system-log-test`; another dataset is
rejected. The tests do not use the production `AXIOM_SYSTEM_LOG_DATA_SET` setting.
Missing credentials or a failed export fail the test. See
[OTel logger tests](../testing/otel-logger.md) for the contract and commands.

A change that adds a prerequisite to a suite adds it to this table.

Local-command tests that execute `loadDeploymentConfig()` belong to the
integration suite, also when they use an administration role double. Config and
local commands are separate logical packages. See the
[auth refactoring package map](../archive/auth-refactoring-plan.md#logical-packages-and-dependency-rules).
`npm run check` does not select these tests. Use their focused commands;
run the integration group only when the path rules below select it.

Provider tests that execute shared context creation or the canonical auth
rejection class run in `test/integration/auth/`. MCP rejection and access tests
run in `test/integration/mcp/` for the same reason. The direct auth import guards
run through the existing ESLint configuration in `habit-hooks`. Their fixture
specification is `test/acceptance/architecture/auth-boundaries.test.ts`.
Select its focused run and test group by the [required runs](#required-runs).
The rules D1 to D7 of the
[test code layout](../testing/test-code-layout.md#dependency-rules) run through
the same ESLint configuration. Two specifications prove them:
`test/acceptance/architecture/test-type-boundaries.test.ts` for D2 and D3, and
`test/acceptance/architecture/test-support-boundaries.test.ts` for D1 and D4 to
D7. A change only to those ESLint rules needs the relevant focused
specifications, not the complete acceptance suite. A change to the
specifications themselves also selects the acceptance group.

## Focused commands

Run a selected new or changed ordinary test file. Dedicated runtime, live,
and container files use their group command, with the
[nested-run limit](#keep-the-selection-through-nested-commands).

```sh
npm run build && node --test dist/test/<suite>/<path>.test.js
```

Portal tests run directly from source; the separate portal TypeScript config
checks them. Use this focused command for each changed portal test file:

```sh
node --test test/<suite>/user-portal/<path>.test.ts
```

Run one case in that file. The pattern is a regular expression:

```sh
npm run build && node --test --test-name-pattern="<test name>" dist/test/<suite>/<path>.test.js
```

Make sure that the report shows the name of each test that you selected. The
build test runs from source and needs no build:

```sh
node --test --test-name-pattern="<test name>" test/unit/build-output.test.ts
```

## Required runs

Before each commit, run each selected new or changed test with its focused
command. Apply the nested-run limit below; record a changed test that needs
a broader nested suite as deferred, not passed. For a deleted test, run the
remaining tests of its affected group. Before Ready, apply the selection
below to the complete candidate: every change of the pull request against
its merge base with `origin/main`, including committed, staged, unstaged,
and new files. Include deleted paths and both
the old and new paths of a rename or move.

### Select by changed path

Apply these rules in order:

1. **A path under the repository's `src/` changed:** run `npm test`,
   `npm run typecheck`, `npm run test:build`, and
   `npm run build:user-portal`. Then run the applicable
   [production gates](#production-gates-for-source-changes) below. The
   prefix is exactly `src/`; a folder named `src` elsewhere does not count.
2. **No `src/` path changed, but a repository `test/` path changed:** run
   only the affected test groups. Combine the groups when changes affect
   more than one. For each other changed path, add its existing focused
   tests. Do not replace this selection with `npm test` or `npm run check`.
3. **Neither `src/` nor `test/` changed:** run only existing focused tests
   for the changed paths. Do not run a full suite or a whole test group.
   A documentation-only change outside those folders can have no applicable
   executable test; record that result instead of adding an unrelated run.

The full ordinary suite means the existing `npm test` command. It includes
ordinary unit, integration, acceptance, interface, and portal tests. It
does not include every dedicated runtime, live, container, or build gate.
The source validation in rule 1 also covers the stages of `npm run check`
without repeating its unit and portal test runs. `npm run check` remains an
aggregate command, not an additional required run.

| Changed path or test kind | Selection when no `src/` path changed | Command or example |
| --- | --- | --- |
| `test/unit/`, except the separate build test | Unit group | `npm run test:unit` |
| `test/unit/build-output.test.ts` | Build test group | `npm run test:build` |
| `test/integration/` | Integration group | `npm run test:integration` |
| Ordinary tests in `test/acceptance/` | Acceptance group | `npm run test:acceptance` |
| Ordinary tests in `test/interface/` | Interface group | `npm run test:interface` |
| Portal unit or acceptance tests | The corresponding unit or acceptance group | `npm run test:unit` or `npm run test:acceptance`; do not add the other group through `test:user-portal`. |
| Dedicated runtime, live, container, or manual work-slice files | Their own group, before the ordinary folder rule | Use their dedicated command from the suite table or the test's guide, subject to the nested-run limit below. |
| `test/support/` or shared test fixture files | The union of their real consuming groups | Trace imports and run-time uses, including child processes and container mounts; then use the selected group commands. |
| `script/`, build configuration, dependencies, migrations, Docker inputs, or other non-test paths | Existing focused tests for the changed files | For example, `npm run test:build` for build behavior, or `npm run build && node --test dist/test/unit/script/ast-metrics-coverage.test.js` for that command's behavior. |
| Documents outside `src/` and `test/` | Relevant existing focused tests, if any | Check the changed instructions and links; a reference to a command does not select it. |

The [code-quality README](../../script/code-quality/README.md#available-tests)
lists the complete available ordinary and live script tests, including the
coverage collectors. Its focused documentation contract is
`npm run build && node --test dist/test/acceptance/script/script-readme.test.js`.
It reads command help and the two document inventories without running their
listed commands. Use the path rules above to select it and other affected tests.

A shared support change does not select every suite because the file is
under `test/support/`. Find its actual consumers and record the selected
groups. A private fixture follows its consuming group too. A component name
such as authentication, hosted, or renderer does not select another whole
group. For a new support file, use the consumers that this candidate adds;
for a deleted or moved file, also inspect its former consumers.

Examples:

- A change to `src/auth/` plus a unit test selects the source validation
  in rule 1 and applicable production gates.
- A change only to a unit test selects the unit group. A change to unit and
  integration tests selects those two groups.
- A change to a support module used by integration and acceptance tests
  selects those two groups, including a use through another support module.
- A script helper change with a new unit test selects the unit group and
  the relevant existing focused script tests. Its hosted use does not add
  an integration suite or an image build.
- A change only to `.habit-hooks/` boundary rules selects the relevant
  focused architecture specifications. If those acceptance specifications
  also change, add the acceptance group.
- A move out of `src/` still selects rule 1 because its old path changed.
  A move between two test groups selects both groups.

### ast-metrics focused and live contracts

For command or double changes, select existing focused tests and the live
contracts of the affected behavior. Do not select all metrics live files
unconditionally. Trace shared modules and doubles to their real consumers.
The [README inventory](../../script/code-quality/README.md#available-tests)
lists the available focused tests and identifies both coverage collectors.

| Changed module area or contract | Affected live contract |
| --- | --- |
| `ast-metrics-mcp.ts`, `mcp/`, or MCP double behavior | `ast-metrics-mcp.live.ts`; snapshot and architecture contracts only when their MCP use is affected. |
| `ast-metrics-snapshot.ts`, `snapshot/`, snapshot identity/provenance, or analysis/MCP snapshot answers | `ast-metrics-snapshot.live.ts`; structural architecture when its snapshot input is affected. |
| `ast-metrics-coverage.ts`, `coverage/`, capture provenance, or build/suite collection | `ast-metrics-coverage.live.ts`; collecting architecture when report compatibility or joining is affected. Both are subject to the collector limit below. |
| `ast-metrics-architecture.ts`, `architecture/` structural input, matching, map, table, or trend behavior | Structural `ast-metrics-architecture.live.ts`, with `--no-coverage`. |
| Architecture coverage compatibility, correspondence, CRAP, bands, or coverage rendering | `ast-metrics-architecture-coverage.live.ts`, subject to the collector limit; select affected focused tests with doubles even when collection is deferred. |
| `ast-metrics-crap.ts`, `crap/`, or its source classification, coverage join, goal advice, or threshold comparisons | `ast-metrics-crap.live.ts` with an existing compatible report; select the affected focused tests too. This live file starts no build or collector. |
| Shared repository, identity, provenance, process, or double helpers | Only the focused and live contracts that consume the changed behavior. Apply the collector limit to each collecting consumer. |
| `ast-metrics-process.ts`, `process/`, `ast-metrics-baseline.ts`, `baseline/`, or structured review outcomes | Affected ordinary process, baseline, and stage-outcome contracts. Add a live contract only when a stage's real behavior or a shared dependency is affected. Process tests grant no collection eligibility. |
| README command help or either test inventory | The existing focused `script-readme.test.ts` contract. Reading a listed command does not select that command. |

`ast-metrics-architecture.live.ts` contains only the structural case and
starts no suite. The separate `ast-metrics-architecture-coverage.live.ts`
and `ast-metrics-coverage.live.ts` each build and run both complete unit
parts. Run either collector only when a `src/` path changed or both complete
parts were independently selected by the path rules: emitted Node tests and
source portal tests. A dedicated live-file change, a focused unit test, or a
script/document change does not select those complete parts. The process
command follows the same rule: `--collect-coverage` is an explicit request,
not permission to expand the independently selected tests. Missing or stale
coverage never starts collection automatically; `--skip-coverage` cannot
make an unassessed required goal pass. Keep an affected
collector deferred outside that scope. Deferred is not passed.

For a slice that changes only these dedicated live files and their documents,
run the changed MCP, snapshot, and structural architecture contracts and the
existing focused README contract. Build only to prepare their emitted files:

```sh
npm run build
node --test dist/test/acceptance/script/ast-metrics-mcp.live.js
node --test dist/test/acceptance/script/ast-metrics-snapshot.live.js
node --test dist/test/acceptance/script/ast-metrics-architecture.live.js
node --test dist/test/acceptance/script/script-readme.test.js
```

This example selects these files because that slice changes their contracts.
For a narrower change, select only affected rows. Do not add the whole unit,
acceptance, integration, or interface suite, `npm run check`, or
`npm run build:hosted`. Record both collectors as deferred for this slice.
MCP, snapshot, and architecture live files skip without ast-metrics on PATH;
`ast-metrics-coverage.live.ts` needs no ast-metrics. An absent-tool skip is
not a pass. Both collectors use private output reports and assert that the
default report stays unchanged. Architecture cases use private trend stores.

When collection is selected and permitted, run only the affected collector
file after the build. Run no other suite at the same time on a shared host:

```sh
node --test dist/test/acceptance/script/ast-metrics-coverage.live.js
node --test dist/test/acceptance/script/ast-metrics-architecture-coverage.live.js
```

The CRAP live contract reuses an existing report. Select it when its behavior
or a real shared dependency changes; do not add it as a blanket gate. After
a build prepares its emitted file, pass a compatible private report when
available:

```sh
AST_METRICS_CRAP_COVERAGE=/absolute/path/coverage.json node --test dist/test/acceptance/script/ast-metrics-crap.live.js
```

Without that variable it reads `ast-report/coverage.json`. It starts no build,
suite, or collector. Missing ast-metrics or coverage gives an explicit skip;
record the required assessment as deferred, not passed. A present stale report
fails. Collect a report only when the independent test selection permits both
complete unit parts; an unavailable report does not expand that selection.

### Keep the selection through nested commands

Check what each selected command runs, including child processes and image
builds. Without a `src/` change, a command must not add test groups outside
the selected union or turn focused tests into a complete suite. In
particular, do not add `npm run check`, `npm run build:hosted`, or default
ast-metrics coverage collection only because a changed file is one of
their inputs. The coverage command runs both complete parts of the unit
suite: emitted Node tests and source portal tests. Use it only when both
complete parts are already selected or rule 1 applies. A focused unit file
or package does not select both complete parts. The same limit applies to
a live metrics test that starts coverage collection. Use an existing coverage file only when it is valid for the
source, unit-test, and build inputs, or report metrics without coverage
as the review guide permits.

Dedicated tests keep their own commands: for example,
`npm run test:mcp:renderer`, `npm run test:hosted-live`,
`npm run test:interface:workos-signup`, and `npm run test:container`.
Their prerequisites and evidence rules still apply. Do not use
`npm run build:hosted` to prepare a test-only renderer or hosted-live run;
use the backend and portal builds that its dedicated command requires.

The hosted image acceptance command, `npm run test:container:hosted`, builds
`Dockerfile.hosted`. That build necessarily runs `npm run build:hosted`
and its checks from several groups. It cannot currently isolate the hosted
image group from those checks. For a test-only or other non-source change,
use the relevant existing focused tests that fit the selected scope and
record that the complete image gate did not run because its nested build
exceeds that scope. Do the same for any container command with an unavoidable
nested full-suite run. An omitted gate is not a pass. Do not change an image,
a package script, an assertion, a deadline, or an environment gate to bypass
its checks. The real image and release checks remain unchanged.

### Production gates for source changes

This subsection applies only when rule 1 selects a `src/` change. It does
not make a dependency, script, Docker input, test, support file, or document
change select a production gate on its own. A changed dedicated test can
select its own group under rule 2, with the nested-run limit above.

In addition to the source validation in rule 1, run these gates when the
changed source affects their behavior:

- `npm run test:mcp:renderer` for the fetch tool composition
  (`src/fetch-tool.ts`), renderer runtime (`src/website-fetcher/`), cleaning
  pipeline (`src/html-cleaner-pipeline/`), or rules loading
  (`src/config/ad-rules-file.ts`).
- `npm run test:container` for the self-hosted server and commands, including
  `src/index.ts`, `src/application.ts`, `src/fetch-tool.ts`, `src/auth/`,
  `src/config/`, `src/hosted-admin/`, `src/http/`, `src/logging/`, `src/mcp/`,
  `src/organizations/`, and `src/terminal/`.
- `npm run build:hosted` and `npm run test:container:hosted` for source that
  affects the hosted application, its portal, or its offline checks. The
  image gate must pass on Linux AMD64; a host-only or ARM64 run is not a
  replacement.
- The offline signup retry proof,
  `test/interface/auth/workos-signup.test.ts`, and the Staging provider
  contract, `npm run test:interface:workos-signup`, for source that affects
  signup creation, its acceptance record, or its SDK retry configuration.
  The [FS-01 record](fs-01.md) gives the scope and limits.
- `npm run test:hosted-live` for source that affects hosted authentication
  or WorkOS organization reads and changes, when the staging settings are
  available. If they are unavailable, record that the gate did not run.

The ordinary full suite includes the offline Better Auth and WorkOS
interface proofs. Select a focused run of those proofs when needed to
verify the changed source; no separate whole interface run is needed after
`npm test` passes.

### Common checks and evidence

Run `habit-hooks` on every complete candidate. Correct each enforced smell,
or give the reason that you keep it. Keep `.habit-hooks/snooze.json` as `[]`.
Use the code quality review process of AGENTS.md with this same test scope;
it must not add an unrelated suite through coverage collection.

If a test's group or a helper's consumers are unclear, inspect its command,
imports, and run-time paths and record the scope you can establish. Do not
resolve uncertainty by running all suites. Record any unresolved coverage
limit and any required run that could not be completed.

Record each command and its result in the commit message or pull request
notes. Give the exit status and the counts that Node reports for tests,
passes, failures, skipped tests, and todo tests. Record the reason for an
omitted run and do not call it a pass. For a non-source pull request, list
the selected groups and focused tests, and state why broader gates did not
apply. An explicit release request uses the separate release rules below,
regardless of this pull request selection. Editing or referring to release
instructions alone is not a release request.

## Evidence rules

- A run gives evidence of a pass only when it exits with status 0 and its report
  shows each required test as passed.
- A command that selects zero tests does not give evidence of a pass.
  `node --test` reports `tests 0` and exits with status 0 when its glob matches
  no file.
- A skipped test is not a pass of that test. A todo test is not a pass of that
  test. Node exits with status 0 for both.
- A name pattern that matches no test does not give evidence of a pass. Node
  then reports the file as one passing test.

## Container gate

AUTH-09 added the container acceptance suite
`test/acceptance/auth/self-hosted-container.test.ts` and its own command,
`npm run test:container`. The command makes a clean build, sets
`THERMUS_CONTAINER_GATE=1`, and runs the file. The suite:

- builds the image of the current candidate from `Dockerfile` two times. The
  second build has another revision label, so it is another image with the same
  content, for the image replacement case;
- builds the image a third time with another file in place of the Lightpanda
  download: a build context with the name `lightpanda-asset` replaces that
  stage. The build must stop with `Lightpanda SHA256 check failed` and make no
  image. This build needs no network access for the asset;
- runs the server and the bundled commands in containers of that image, with the
  real provider and SQLite on Docker volumes;
- copies the trusted rules fixture `test/support/fixtures/trusted-ad-rules.txt`
  with `docker container cp` to `/etc/thermus/ad-rules.txt` in each server
  container before it starts. Command containers get no rules file. The gate
  does not use the operator's `ad-rules.txt` next to `compose.yaml`;
- gives the containers only the settings of the image and `PUBLIC_BASE_URL`, so
  the normal production telemetry settings apply, also
  `LIGHTPANDA_DISABLE_TELEMETRY=true`. The server containers of the two renderer
  cases also get `NODE_OPTIONS` and `CONTAINER_GATE_PAGE` for the test-only page
  seam below;
- puts each container that runs Thermus on an internal Docker network without a
  route out, so each outbound connection fails. An edge container forwards the
  test connections to the server and is the DNS server of the containers, so it
  records each outbound connection that they try by name. A connection to an IP
  address fails without a record. Before each case, a lookup of a control name
  must appear in the record, so the record works on this engine. Each case
  fails when the record has another query;
- checks that a server container without the rules file stops before it listens
  with a `FATAL` line that names `AD_RULES_FILE` and writes nothing to its
  volume, and that a command container still adds an account;
- calls the fetch tool with an address-literal URL, so the call needs no DNS
  lookup. The container has no route out, so the renderer cannot connect, and
  the call gets `Page fetch failed` and a `fetch_failed` record. The renderer
  starts, so the server log gets no renderer setup report;
- loads the test-only page seam `test/support/container/container-page.ts` into the server
  container of the two renderer cases, with `--import` in `NODE_OPTIONS`. The
  seam serves a JavaScript page on port 8090 of the container and gives the
  lookup of `localhost` a public address, as `resolveAsPublic` does. With
  `CONTAINER_GATE_PAGE=permitted`, it also lets the renderer reach `127.0.0.1`
  for that page, as `permitIPv4Fixture` does. With `blocked`, the renderer starts
  with the production options. The seam does not change the renderer
  environment, so the telemetry settings of the image and the fetcher apply.
  Production has no such seam;
- checks in the permitted case that `LIGHTPANDA_BIN` in the server container
  names the pinned executable, which reports 1.0.0, that the client gets the
  exact cleaned Markdown, and that the server writes one safe completion record;
- checks in the blocked case that the fetcher blocks the loopback address and
  the private address of the server container before a renderer starts, and
  that the renderer blocks the loopback socket of `localhost`. Each call gets
  `Page fetch failed` and a `fetch_failed` record, and the page gets no
  connection;
- keeps hosted, paid, and private-provider paths closed to a signed-in local
  user, with no new account and only the fetch tool in MCP. Starting this
  self-hosted image with `DEPLOYMENT=hosted`, valid WorkOS settings, trusted
  rules, and its pinned renderer stops before listening because the image has
  no portal build. The safe FATAL message names the build command, the exit
  code is 1, the fresh volume stays empty, and no outbound call occurs. RHD-03
  supplies the separate hosted image;
- checks in the image that `LIGHTPANDA_BIN` names the pinned executable, which
  root owns and the `node` user cannot change, that the executable reports
  1.0.0 and loads the CA certificates of the image, and that the image sets
  `LIGHTPANDA_DISABLE_TELEMETRY=true`;
- removes its containers, networks, volumes, and images when it ends.

Only a run of `npm run test:container` that exits with status 0 and shows each
container test as passed is a container gate pass. A container run with outbound
access allowed is not a container gate pass. A container run with changed
telemetry settings is not a container gate pass. `npm test` and
`npm run test:acceptance` select the file but skip its suite, so a run through
them is never a container gate pass. Without the docker CLI, a running engine,
Buildx, or Compose, the suite fails with a setup error. A container gate pass
gives evidence of the renderer of the image only for the cases above: one local
page, and the blocks of private and loopback addresses. It cannot reach a
public HTTPS page. It is not a pass of the
[renderer gate](#renderer-gate-mcp-p03), which alone proves the rendered tool
behavior with redirects, hidden content, failures, and cancellation.

An interrupted run can leave resources. Each one has the label
`thermus.container-gate`, so these commands remove them:

```sh
docker container rm --force $(docker container ls --all --quiet --filter label=thermus.container-gate)
docker network rm $(docker network ls --quiet --filter label=thermus.container-gate)
docker volume rm $(docker volume ls --quiet --filter label=thermus.container-gate)
docker image rm --force $(docker image ls --quiet --filter label=thermus.container-gate)
```

## Hosted offline build checks

The aggregate `npm run build:hosted` is selected only for an applicable
source change or an explicit release request. A test-only change uses its
selected groups and focused files instead; this section does not add groups.
The command starts with `npm run check`. That command builds the
backend during the unit suite and builds the portal last. The hosted command
then runs these emitted files directly, without another build:

1. `dist/test/integration/**/*.test.js`: the complete offline integration suite.
2. `dist/test/acceptance/architecture/*.test.js`: all architecture specifications;
   `dist/test/acceptance/hosted-ad-policy.test.js`,
   `dist/test/acceptance/auth/hosted-startup.test.js`,
   `dist/test/acceptance/auth/hosted-portal.test.js`,
   `dist/test/acceptance/auth/hosted-mcp-origin.test.js`,
   `dist/test/acceptance/auth/hosted-workos-signup.test.js`,
   `dist/test/acceptance/auth/hosted-signup-restart.test.js`,
   `dist/test/acceptance/auth/hosted-signup-guidance.test.js`,
   `dist/test/acceptance/auth/hosted-mcp-signup-guidance.test.js`,
   `dist/test/acceptance/mcp/hosted-fetch-tool.test.js`,
   `dist/test/acceptance/mcp/hosted-process-shutdown.test.js`,
   `dist/test/acceptance/mcp/server-only-modules.test.js`, and
   `dist/test/interface/hosted-renderer-startup.test.js`.
3. `dist/test/acceptance/mcp/get-url-as-markdown.runtime.js`: the real local
   renderer gate, with the pinned executable.

The exact selection is in `package.json`. It includes the current emitted
integration glob and explicit, nonempty acceptance and interface paths. It
excludes the Axiom tests, public-site renderer smoke test, live WorkOS gate,
and Docker gates. The command needs the pinned Node and dependencies, OpenSSL
in `PATH`, a free local port 46443, local loopback connections, and the
absolute `LIGHTPANDA_BIN` of Lightpanda 1.0.0. It needs no live credential or
public network access. When that aggregate gate is selected, a local command is:

```sh
LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda" npm run build:hosted
```

`Dockerfile.hosted` supplies its checked renderer and runs this command with
`RUN --network=none`. The final runtime copies backend and portal outputs
from that checked stage, so BuildKit cannot skip its checks. The final stage
then checks the assembled outputs with the production dependencies, as the
non-root runtime user, without network access. It does not rebuild them.
A failed check must prevent a final runtime image. No Docker daemon runs
inside the build. These checks supplement the pull request runs only when
the hosted build gate is selected. Every real hosted image build still runs
the complete checks; the path selection does not weaken the image.

The check stage of `Dockerfile.hosted` has no git executable, no `.git`
folder (`Dockerfile.hosted.dockerignore` excludes it), and no ast-metrics.
So a unit test of a script must not depend on git or ast-metrics; the unit
tests of the ast-metrics commands put a stub of git first on a PATH that
holds nothing else (`test/support/doubles/ast-metrics/git-cli-stub.ts`).
A run of the unit tests of the scripts with a PATH that holds only `node` is
the local stand-in for that part of the image gate:

```sh
mkdir -p /tmp/node-only && ln -sf "$(command -v node)" /tmp/node-only/node
env PATH=/tmp/node-only node --test "test/unit/script/*.test.ts"
```

### Acceptance: hosted build with constrained CPU

Given a Linux AMD64 Render Starter builder with two CPUs and 8 GB of memory
and the pinned build inputs, when `npm run build:hosted` runs, then every
selected test must pass with its existing assertions and deadlines. The build
must keep the complete test selection and the production selector limits.
A failed check must still prevent a runtime image.

The local image proof uses an AMD64 runtime in a VM with two CPUs and 4 GiB
of memory. Record the local proof and the Render build result separately.

The initial Render build, `dep-db8pua7f3r2c73f0b3ag`, failed this scenario on
main `3736b78d`: 2,533 of 2,534 backend unit tests passed. The case
`rejects 32 repeated descendant combinators within the time limit` took
12,309 ms in total, and its child did not close within the separate 3,000 ms
work deadline. The total includes child startup; it is not selector CPU time.
CPU contention between test files is a hypothesis, not a proven cause. This
failed build is the initial regression evidence; it is not a gate pass.

## Hosted image gate

`npm run test:container:hosted` makes a clean backend build and runs only
`test/acceptance/auth/hosted-image.test.ts` as emitted JavaScript. The ordinary
`test` and `test:acceptance` command globs explicitly exclude this basename.
When selected, the command is the entry point for that file. Its nested
build has the [scope limitation](#keep-the-selection-through-nested-commands)
for a change without `src/`:

```sh
npm run test:container:hosted
```

FS-04 renamed this file from `hosted-image.runtime.ts` to `hosted-image.test.ts`
on October 16, 2026. Earlier validation records keep the command and filename
used for those runs. Use the current dedicated command for a new run. The
renderer and live gate names did not change.

The gate must build and run the final `Dockerfile.hosted` image for
`linux/amd64`. It needs Docker Engine with Buildx and a native or emulated
AMD64 builder and runtime. Downloading the pinned base images, packages, and
Lightpanda asset needs network access unless those inputs are cached. The runtime test needs public HTTPS egress to
`https://example.com/`. Tests need no live WorkOS or Axiom credential. The final-image run must prove real
native cleaner loading, CA-backed HTTPS and JavaScript rendering, private
network refusal, capacity refusal, cancellation, bounded shutdown, invalid
startup refusal, the exact approved pre-sign-in notice with signup enabled only
in an image test, and a failed offline check that prevents a runtime image.
The [RHD-03 record](rhd-03.md) tracks the case details and results.
The gate allows 60 minutes for its build and image cases. Its deliberate
failed-check case injects a failing offline test into an existing unit file.
The build must stop there without producing a runtime image. This allowance
does not change production readiness or shutdown limits.

A successful build alone does not pass the runtime gate. A pass of the
self-hosted container gate, host renderer gate, or ARM64 image does not prove
this Linux AMD64 image. A pass does not prove real WorkOS behavior or a
Render deployment. Record architecture and complete test counts with the
command result.

## Renderer gate (MCP-P03)

MCP-P03 added the explicit renderer gate,
`test/acceptance/mcp/get-url-as-markdown.runtime.ts`, and its own command,
`npm run test:mcp:renderer`. The command makes a clean build and runs
`node --test dist/test/acceptance/mcp/get-url-as-markdown.runtime.js`. The
`.runtime.ts` name does not match the `*.test.js` globs on purpose, so
`npm test` and `npm run test:acceptance` do not select it. The command is also
the focused command of the file.

The gate needs `LIGHTPANDA_BIN` with the absolute path of the pinned Lightpanda
1.0.0 executable. [Lightpanda runtime](../lightpanda-runtime.md) gives the
setup. The gate needs no public network access and no Axiom credentials. The
pages are local HTTP fixtures on `127.0.0.1`. The test-only `permitIPv4Fixture`
seam in `test/support/doubles/website-fetcher/network-fixture.ts` lets the renderer reach only that
address in the test scope. It keeps the other launch options of the fetcher,
also the renderer environment, so the gate checks the telemetry setting of the
fetcher. Production has no private-network bypass.

The gate runs the production `serve()` in the test process with real Better
Auth, the real cleaning pipeline, trusted test rules, and the pinned renderer.
The real MCP SDK HTTP client calls `getURLAsMarkdown`. The nine cases cover:

- exact cleaned Markdown from a local JavaScript page and one safe completion
  record, in the modern 2026-07-28 and the legacy 2025-11-25 era, after the
  user signs in and consents on the bundled pages;
- a local server whose environment does not set `LIGHTPANDA_DISABLE_TELEMETRY`:
  the renderer run has telemetry off. The case gives the server a new `HOME`,
  and the renderer writes no telemetry install ID, the file `iid`, in its data
  directory there. Thus it starts no telemetry sender and tries no connection
  to `telemetry.lightpanda.io`;
- a redirect that changes the host and the path: `requestedUrl` keeps the
  requested spelling, and the final URL selects the rules and resolves links;
- hidden content, sanitizer-withheld HTML with exact empty success, an HTTP
  error with `Page fetch failed` and no renderer setup report, and a DOM deeper
  than 256 levels with `Page processing failed`;
- a page whose script completes after 6.5 seconds and returns rendered content
  within the fixed 20-second readiness allowance;
- a page that never reaches network idle: the child stops before the call
  completes, no partial Markdown returns, and the server writes one safe
  `readiness_timeout` report and one `fetch_failed` completion record;
- a modern client cancellation that stops the renderer child and writes one
  `cancelled` record;
- a legacy call that server shutdown cancels: the renderer child stops before
  the server finishes stopping, and one `cancelled` record is written.

Setup fails when `LIGHTPANDA_BIN` is unset or empty, is relative, does not run,
or reports a version other than 1.0.0. Each setup message starts with
`Renderer gate setup failed:` and points to the runtime guide. The normal
acceptance suite has `test/acceptance/mcp/renderer-gate-setup.test.ts`. It runs
the gate four times with bad prerequisites. It checks that each run fails with
its setup error and that no gate test passes, is skipped, or is left as todo.

A run of `npm run test:mcp:renderer` that exits with status 0 and shows
each of the nine cases as passed is a renderer gate pass. The final phase of
`npm run build:hosted` runs that same complete file; record its renderer
result separately from the earlier build phases. A run that selects zero
tests, skips a test, leaves a test as todo, or stops with a setup error is not a
pass. A passing default acceptance suite never counts as rendered end-to-end
proof, and a container gate pass does not count either. Claim rendered tool
behavior only after a renderer gate pass.

## Hosted offline checks

AUTH-12 added the hosted placeholder, AUTH-07 added organization onboarding and
selection behind the provider contracts, and AUTH-08 added User and Admin grant
management, invitations, change records, and the User seat summary. AUTH-06
replaced the placeholder in production with the WorkOS provider, and AUTH-07W
connected the organization reads of the hosted edition to WorkOS. After that,
no composition used the placeholder, and a follow-up of AUTH-07W removed it
and its unit test. AUTH-08W connected the member and invitation reads and
changes to WorkOS. These tests run offline and need no WorkOS account,
credential, or network access. They use doubles at the provider contracts, or
the pinned SDK with a local fake of the WorkOS API
(`test/support/doubles/workos/workos-fake-api.ts` and `test/support/doubles/workos/workos-fake.ts`).
They are in the existing suites:

- unit: `test/unit/hosted-admin/account-routes.test.ts`,
  `test/unit/hosted-admin/account-routes-effects.test.ts`,
  `test/unit/hosted-admin/account-routes-organization-page.test.ts`,
  `test/unit/hosted-admin/account-routes-selection-input.test.ts`,
  `test/unit/hosted-admin/account-routes-selection.test.ts`,
  `test/unit/hosted-admin/account-routes-administration-pages.test.ts`,
  `test/unit/hosted-admin/account-routes-administration-changes.test.ts`,
  `test/unit/hosted-admin/account-routes-administration-input.test.ts`,
  `test/unit/organizations/organization-administration.test.ts`,
  `test/unit/organizations/organization-administration-grants.test.ts`,
  `test/unit/organizations/organization-administration-targets.test.ts`,
  `test/unit/organizations/organization-administration-changes.test.ts`,
  `test/unit/organizations/organization-administration-members.test.ts`,
  `test/unit/organizations/organization-administration-invitations.test.ts`,
  `test/unit/organizations/organization-administration-invitation-overview.test.ts`,
  the WorkOS provider tests in `test/unit/auth-workos/`, with
  `test/unit/auth-workos/workos-organizations-memberships.test.ts`,
  `test/unit/auth-workos/workos-organizations-members.test.ts`,
  `test/unit/auth-workos/workos-organizations-grants.test.ts`,
  `test/unit/auth-workos/workos-organizations-invitations.test.ts`,
  `test/unit/mcp/protected-resource-endpoint.test.ts`,
  `test/unit/config/deployment-config.test.ts`,
  `test/unit/application.test.ts`, and
  `test/unit/application-operator-log.test.ts`, in `npm run test:unit`;
- integration: `test/integration/auth/hosted-account.test.ts`,
  `test/integration/auth/hosted-organizations.test.ts`,
  `test/integration/auth/hosted-administration.test.ts`,
  `test/integration/auth/local-installation.test.ts`,
  `test/integration/auth/portal-access.test.ts`,
  `test/integration/auth/workos-provider-verification.test.ts`,
  `test/integration/auth/workos-provider-access.test.ts`,
  `test/integration/auth/workos-provider-directory.test.ts`,
  `test/integration/auth/workos-provider-organizations.test.ts`,
  `test/integration/auth/workos-provider-administration.test.ts`,
  `test/integration/auth/workos-browser-session.test.ts`, and
  `test/integration/mcp/required-permission.test.ts`, in
  `npm run test:integration`;
- acceptance: `test/acceptance/auth/hosted-startup.test.ts`,
  `test/acceptance/auth/hosted-workos.test.ts`,
  `test/acceptance/auth/hosted-workos-organizations.test.ts`,
  `test/acceptance/auth/hosted-workos-administration.test.ts`,
  `test/acceptance/auth/hosted-organizations.test.ts`,
  `test/acceptance/auth/hosted-organization-requests.test.ts`,
  `test/acceptance/auth/hosted-grants.test.ts`,
  `test/acceptance/auth/hosted-grant-refusals.test.ts`,
  `test/acceptance/auth/hosted-invitations.test.ts`, and
  `test/acceptance/auth/hosted-seats.test.ts`, in
  `npm run test:acceptance`. The self-hosted container gate also checks that
  `DEPLOYMENT=hosted` with placeholder WorkOS settings fails before listening,
  because that image has no built portal.

Select only the groups and focused files required by the changed paths.
The lists above are an inventory, not a requirement to run all hosted tests.
For example, after a clean backend build, these are separate focused runs:

```sh
npm run build
node --test dist/test/integration/auth/hosted-account.test.js
node --test dist/test/acceptance/auth/hosted-startup.test.js
```

Run each example only when it covers a changed path. Do not combine hosted
integration and acceptance tests merely because both concern the hosted
edition. A group command is required only when the path rules select that
group, or when a source change selects the full suite.

Each pass gives evidence only for the behavior of its selected tests. The
complete selection above covers the application side of the hosted edition:
the WorkOS provider and its organization reads and changes with the pinned
SDK against a fake, and the application policy of the hosted routes and of
`OrganizationAdministration` with doubles. These offline tests never give a
pass of the [hosted live gate](#hosted-live-gate-auth-06) or proof of WorkOS
behavior, such as the claims of real tokens, safe grant changes, or invitation
acceptance in WorkOS. Do not report it as either.

## Self-hosted release

These rules apply to an explicit request to release the self-hosted
evaluation image. Editing or referencing release documents does not invoke
them. A release needs a pass of each command below on a clean checkout of
the release commit: `git status --porcelain` shows
nothing, because the image build and the container gate read the working tree.
Each command must exit with status 0 and show each required test as passed:

1. `npm run check`
2. `habit-hooks`, with each finding corrected or its reason given
3. `npm run test:integration`
4. `npm run test:acceptance`
5. `npm run build && node --test dist/test/interface/auth/better-auth.test.js`
6. `npm run test:container`

If an Actions job starts for the release commit, it must pass too. Then build the
release image with `docker compose build`. The release notes must not claim
payment collection, hosted features, or migration between editions.

## Pull request steps

1. Open a draft pull request first.
2. Do the [required runs](#required-runs).
3. Update the documents that the change affects in the same pull request.
   Then run the process "Code quality review with ast-metrics" of AGENTS.md
   on the complete candidate; the
   [ast-metrics review guide](ast-metrics-review.md) gives the commands.
4. Mark the pull request Ready. Wait for every Actions job that starts for its
   head to pass. A started job that is pending, skipped, cancelled, or failed is
   not a pass.
5. If you must make a fix after Ready, return the pull request to Draft first.
   Then continue from step 2 with the new candidate.
6. The review is manual. The manager reviews the work of each subagent. The
   owner reviews the pull request. No agent reviewer runs on it.
7. Merge a clean pull request one time. The owner merges a pull request that
   adds a decision record under `architecture/decisions/`.

A Delamain worker run does the required runs and none of the pull request steps.
For a Delamain ticket, the session opens and merges the pull request one time
each. A restart reuses the same pull request and merge result.

## Actions jobs

This repository has no workflow in `.github/workflows/` now. No Actions job
starts for a pull request head. The required runs give all gate evidence.

If a change adds a workflow, the AGENTS.md wait rule applies to every job that
starts for the head. The required runs stay required. That change also updates
this section.

## Hosted live gate (AUTH-06)

`npm run test:hosted-live` makes a clean build, builds the portal, and runs
only `dist/test/acceptance/auth/hosted.live.js`. The `.live.ts` name does not
match the `*.test.js` globs on purpose. Thus `npm test` and
`npm run test:acceptance` do not select it.

The gate needs a WorkOS staging environment and these settings in the
environment of the command:

| Setting | Value |
| --- | --- |
| `WORKOS_API_KEY` | The API key of the staging environment. It must start with `sk_test_`, because the live proofs make and change users, organizations, memberships, and invitations. |
| `WORKOS_CLIENT_ID` | The client ID of the staging environment. |
| `WORKOS_AUTHKIT_ISSUER` | The AuthKit domain of the staging environment, exactly as WorkOS shows it: an absolute `https` URL without spaces, a username, a password, a query, or a fragment. |
| `WORKOS_MFA_POLICY` | Omitted or `optional` selects the Optional profile; `required` selects the Required profile. These are the only accepted exact values. The provider must match the selected profile. |

On the owner's Mac, the staging launcher reads the API key from the macOS
Keychain and gives the three settings only to the command that it starts:

```sh
LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda" node ~/.config/thermus/with-workos-staging.cjs npm run test:hosted-live
```

The launcher is outside the repository. Never print its key or copy it into a
file, a ticket, or a log.

The command uses one MFA profile for the complete run:

```sh
# Default profile: WorkOS MFA must be Optional.
LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda" node ~/.config/thermus/with-workos-staging.cjs npm run test:hosted-live
# Required profile: use only after WorkOS MFA is set to Required.
WORKOS_MFA_POLICY=required LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda" node ~/.config/thermus/with-workos-staging.cjs npm run test:hosted-live
```

The provider preflight checks `mfaEnabled: true` and requires `mfaRequired` to
be false for Optional or true for Required before any live test or login. A
mismatch fails the run. The command does not change provider MFA settings.
The Optional profile proves normal browser/Connect flows with no application
MFA evidence and explicit administration refusal. The Required profile keeps
the positive administration proofs under the matched password-MFA contract.
Each profile registers 79 cases, including the two FS-02 signup cases. Required
keeps the eight positive application administration cases. Optional replaces
them with refusal and invitation-acceptance cases that preserve the MFA boundary.
Operator/API administration contract proofs run in both profiles: those service-credential
proofs do not give an Optional browser session administration authority.
A pass of one profile does not prove the other. Restore shared Staging to
Optional after an authorized Required-profile run.

Configure the other staging settings as the hosted edition needs them:

- Email and password sign-in and Google OAuth with the built-in Google
  credentials of WorkOS. No other social sign-in provider, no passkey, and no
  magic sign-in. Optional gives no MFA evidence for any method. Only the
  explicit Required profile can use Password under its verified provider
  requirement; Google gives no MFA evidence. Google sign-in is on since
  2026-10-14, for the
  [auth WorkOS MCP URL fetch work slice](../../test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md)
  (decision D1 of its [plan](auth-workos-mcp-url-fetch-plan.md)).
- Dynamic Client Registration (DCR) and Client ID Metadata Documents (CIMD)
  on, so that MCP clients such as Claude Code register themselves at AuthKit.
  They are on since 2026-10-14, for the same work slice.
- Multiple roles for each membership, and the roles and permissions of the
  [hosted role mapping](../design/authentication-design.md#hosted-role-mapping).
- The redirect URI `https://localhost:46443/callback` as the default, the
  default Sign-out URI `https://localhost:46443/`, the Initiate login URI
  `https://localhost:46443/login`, and no CORS origin.
- The MCP resource indicator `https://localhost:46443/mcp`.

The WorkOS API can save the redirect URI and the resource indicator. The
Sign-out URI and the Initiate login URI are dashboard settings. The dashboard
also keeps the sign-in methods and the social providers, under Authentication,
and DCR and CIMD. The WorkOS connector can change these too, with its
`updateAuthkitSettings` operation. The configuration proofs of the gate read
back each setting that the API or the hosted pages show. The proof of the
AuthKit metadata reads DCR and CIMD back: the `registration_endpoint` and
`client_id_metadata_document_supported`. The session-end proofs follow the
redirects of the WorkOS logout to the Sign-out URI and of a direct AuthKit
visit to the Initiate login URI. A redirect is not a page, so these proofs
watch the navigation requests of the browser.

The auth WorkOS MCP URL fetch work slice uses the same staging environment,
the same origin `https://localhost:46443/`, and the same registered URIs. Thus
the slice and the gate cannot run at the same time. The gate does not delete
the configured slice organization or its users: a run deletes
only the data with its own name or email prefix. The normal hosted
composition of the gate enables no automatic Google onboarding. Only the manual slice opts
in to that policy for its configured organization. Its real browser-first
Google, Connect consent, authenticated HTTPS fetch, and Axiom proof is
separate from the gate. Keep PR #108 in Draft until that proof and the required
complete-candidate checks pass; configuration read-back alone is not a pass.

The default local HTTPS front forwards every request to the production hosted
application, including the portal and assets. Thus the browser checks use its
real portal policy. A custom development application keeps the front-served
portal. The production application runs its local startup checks before it can
serve the live gate.

The final FS-02 cases stop that site and start a test composition with clearly
marked test documents and signup enabled. It retains the production portal,
fetch tool, renderer checks, and cleanup. The default composition stays closed.
The two cases reuse the original fixture workspaces and Connect application.
Their registry owns only their new signup user and personal organization.
Cleanup recovers a lost personal-organization response through the deterministic
external ID of a fixture-owned user; it never sweeps all signup organizations.
These cases prove activation, selector-to-portal navigation, and real MCP fetches
for the verified token workspace. Revoking workspace A denies the same token
while browser B and a fresh B token still work. A repeat activation cannot
restore A. No production setting or policy page changes.

The gate also needs:

- An absolute `LIGHTPANDA_BIN` path to the pinned Lightpanda 1.0.0 executable.
  Hosted startup checks its version with the fixed timeout and output bounds
  in the [runtime guide](../lightpanda-runtime.md#select-the-executable).
  This local version check does not replace the renderer gate.

- Chromium for Playwright 1.64.0: `pnpm exec playwright install chromium`.
- OpenSSL in `PATH`: the local HTTPS test server makes a new self-signed
  certificate for `localhost` for each run.
- Free local ports: 46443 for the local HTTPS test server, and 46480 for the
  callback of the test MCP client, which the browser catches. Nothing else
  listens on port 46443: not the auth WorkOS MCP URL fetch work slice, and
  not the integration case of the local HTTPS site in
  `test/integration/auth/hosted-live-site.test.ts`, which
  `npm run test:integration` runs.
- One run at a time: a run deletes the staging users, organizations, and
  Connect applications that an earlier run left, by their name prefix.

The historical Required-profile run took about 12 minutes: the third
complete run of AUTH-08W run r3 ran its 77 tests in 688 seconds after the builds. One AUTH-06 case waits for the 300-second access
tokens to expire, and the AUTH-07W expiry case after it uses the same wait.

If a setting is missing, empty, or refused, the command fails with one setup
error that names each such setting and the reason. The error shows no value.
The command then makes no network request and runs no other test.
`test/acceptance/auth/hosted-live-setup.test.ts` specifies this behavior
offline.

The hosted gate passes only when the dedicated command runs with the required
settings and every live test passes. Missing hosted credentials, a setup error,
and skipped live tests can never count as a successful hosted gate. Do not put
credentials in the repository, in logs, or in pull request notes.

The Required profile has the six parts below. The Optional profile keeps
the common browser, session, Connect, access, organization, and revocation
proofs and replaces positive MFA/administration expectations with no-evidence
and administration-refusal cases. Neither profile silently changes the
provider setting. Counts and final candidate results belong in the
[validation record](auth-workos-mcp-url-fetch-validation.md).

The Required profile has these parts:

- The provider proofs of AUTH-06: the AuthKit metadata and key sets, the saved
  configuration, the browser sign-in with required MFA, sessions and their
  end, Connect authorization and tokens, and the membership reads. The
  [authentication plan](../design/authentication-design.md#live-provider-proofs)
  lists them and records their results.
- The AUTH-06 cases of the hosted live gate, in
  `test/acceptance/auth/hosted-live/hosted-server.ts`. The local HTTPS test
  server, `test/support/hosted-live/local-https-site.ts`, forwards all requests
  at `https://localhost:46443/` to the production hosted application of Thermus
  with the staging settings. The application serves the portal and assets. Playwright
  drives the portal, the sign-in, and the sign-out; a test MCP client sends
  Connect tokens to the MCP endpoint. The cases cover the sign-in with MFA and
  the session cookie, the onboarding of a user without a membership, the
  product access of User, Admin only, and the default role, Connect tokens at
  the MCP endpoint, the refusal of browser and M2M tokens, the organization of
  each credential, the external sign-in through `/login`, the sign-out, and
  the revocation limits and cookie rotation after the 300-second token
  lifetime.
- The AUTH-07W provider proofs, in
  `test/acceptance/auth/hosted-live/operator-setup.ts`. They run the steps of
  the [operator runbook](hosted-organization-setup.md) with the pinned SDK
  against the staging environment, through the test-support driver
  `test/support/hosted-live/operator-runbook.ts`, and read the result with the
  real `WorkOSOrganizations` and `OrganizationAdministration`. The proofs cover
  the organization setup by external ID, the Super Admin grant, revocation,
  replacement, and recovery, the inspection after an unknown outcome, and the
  operator records. Each Super Admin change is one role assignment on the
  authorization resource of the organization, or its removal. The proofs also
  cover that resource, which has the external ID of the organization, and a
  customer single-role change between the inspection of the runbook and its
  write, which stays. The driver is test support only: the product has no
  operator method or route. Its decisions also have a focused unit test with
  an SDK double, `test/unit/auth-workos/operator-runbook.test.ts`.
- The AUTH-07W cases of the hosted server, in
  `test/acceptance/auth/hosted-live/organization-server.ts`, with the same
  local HTTPS test server. The cases cover the onboarding of users without an
  authorized organization, the organization page and the selection with the
  WorkOS names, refused selections, a Super Admin of the operator organization
  with the billing page, a refused customer grant of Super Admin and the
  revocation by the operator, and a refused selection after the access token
  of the session expired. `hosted.live.ts` registers the AUTH-07W cases before
  the AUTH-06 cases and the expiry case after them, so that the 300-second
  wait of the AUTH-06 cases also lets the access token of the selection
  session expire.
- The AUTH-08W provider proofs, in
  `test/acceptance/auth/hosted-live/administration-proofs.ts`. They run the
  single-role writes of WorkOS with the pinned SDK, and the grant changes,
  member reads, User seat count, and invitation changes of the real
  `WorkOSOrganizations`, against the staging environment. The proofs cover a
  repeated write, concurrent writes of two roles, the removal of a role that
  the membership does not have, a write on the resource of another
  organization, retries on an old revision, the removal of the last role,
  inactive and pending memberships, the member reads in pages of two with
  each status filter, the User seat count, and the invitation send, its
  refusals, the resend, and the revoke.
- The AUTH-08W cases of the hosted server, in
  `test/acceptance/auth/hosted-live/administration-server.ts`, with the same
  local HTTPS test server. The cases cover a forged Admin grant of an
  Admin-only member, the self-grants of a Super Admin with MFA and their
  change records, the revoke and the regrant of its own Admin, the
  revocation of Admin and then of User of a member with a browser session
  and an MCP token, the removal of the last grant, forged posts and a post on
  an old revision, the invitation forms, and the acceptance of two
  invitations. For an acceptance, Playwright opens the invitation link.
  AuthKit sends the browser through the Initiate login URI to `/login` of the
  server, which starts a sign-in. AuthKit shows the invitation in that
  sign-in and accepts it before the callback
  (`acceptInvitationThroughPortal()` in
  `test/support/hosted-live/portal-visit.ts`, with the `/invite` step of
  `test/support/hosted-live/authkit-driver.ts`). `hosted.live.ts` registers
  the AUTH-08W proofs after the AUTH-07W proofs, and the AUTH-08W cases after
  the first four AUTH-07W cases and before the AUTH-06 cases. Thus the
  AUTH-07W expiry case still comes after the 300-second wait.

For the AUTH-07W proofs and cases, the run makes its own operator
organization, `Thermus live <run ID> operator` with the external ID
`thermus-live-<run ID>-operator`, and 15 more users
(`test/support/hosted-live/organization-fixtures.ts`). It deletes them at the
end with its other fixtures. They need no other setting or prerequisite.

For the AUTH-08W proofs and cases, the run makes two more organizations,
`Thermus live <run ID> C` for the cases and `Thermus live <run ID> D` for the
proofs, and 25 more users, each with a password and a verified email, with
their memberships (`test/support/hosted-live/administration-fixtures.ts`).
Organization C has the external ID `thermus-live-<run ID>-c`, as each
customer organization of the operator runbook has one. WorkOS names the
authorization resource of such an organization only by its external ID, so
the grant cases in C cover the role writes on a resource that the external ID
names. Organization D has no external ID, so the proofs in D cover an
organization without one, whose resource WorkOS names by the organization ID.
Organization B of the staging fixtures holds the second membership of two of
these users. The invitations of the proofs and cases go only to these
existing users, because an invitation to a new address needs an email
verification code at the acceptance. The run deletes them at the end with
its other fixtures. They need no other setting or prerequisite. With them,
the complete command has 77 tests: the 60 tests of AUTH-06 and AUTH-07W, with
the three operator proofs of the ticket
`9255ad59-3484-43bd-bdf5-e6e391e07bd6`, and the 17 AUTH-08W tests.

Record the results of the AUTH-06 cases separately from the full hosted release
gate. A pass of the AUTH-06 cases lets AUTH-06 complete its scope: identity
verification, browser sessions, and read-only access resolution. It is not a
pass of the full hosted gate. The first hosted release also needs the
applicable AUTH-07W and AUTH-08W live cases, and the operator and customer
changes that they prove stay unavailable until those cases pass. The
AUTH-07W cases passed in run r2 of AUTH-07W, and the AUTH-08W cases in run
r3 of AUTH-08W.

Record the results of the AUTH-07W proofs and cases separately in the same
way. Run r2 of AUTH-07W on 2026-10-14 passed them with the complete command:
57 of 57 tests. The ticket `9255ad59-3484-43bd-bdf5-e6e391e07bd6` changed the
Super Admin steps of the runbook to single-role writes and added three
operator proofs. Its run r1 on 2026-10-14 passed them with the complete
command: 60 of 60 tests. The runbook also requires a completed operator MFA
before each write ([before you start](hosted-organization-setup.md#before-you-start)). This
precondition is a manual check of the operator, not a part of this gate: the
WorkOS API cannot show a completed operator MFA. On 2026-10-14, the owner
removed its proof from AUTH-07W. The decision ticket
`ae984833-e115-4da9-bebe-7c4b1fb1a025` decides how it is enforced and proven.

Record the results of the AUTH-08W proofs and cases separately in the same
way. First, a run of only the AUTH-08W tests, with the name pattern
`AUTH-08W`, passed the 16 proofs and cases that existed then. It ran through
the staging launcher after `npm run build && npm run build:user-portal`:

```sh
node ~/.config/thermus/with-workos-staging.cjs node --test --test-name-pattern="AUTH-08W" dist/test/acceptance/auth/hosted.live.js
```

It reported 16 tests, 16 passed, 0 failed, and 0 skipped. A run with a name
pattern runs only a part of the gate, so it is a record of those tests, not a
gate pass. The ninth AUTH-08W provider proof came after it. Then run r3 of
AUTH-08W ran the complete command, `npm run test:hosted-live`, three times on
2026-10-14 with the staging launcher:

1. Before the merge of main, on commit 564bdff: status 0, 74 tests in 17
   suites, 74 passed.
2. After the merge of main (77 tests with the three operator proofs of the
   ticket `9255ad59-3484-43bd-bdf5-e6e391e07bd6`) and the organization read of
   the role writes, with an external ID for C, on commit fd3967a: status 1,
   74 passed and 3 failed. Three AUTH-08W cases in C got the `500` failure
   page for a page read after successful changes; the run kept no cause. The
   cases now show the last operator reports of the server for a failed page,
   and a run of only the 17 AUTH-08W tests then passed each of them. A failed
   complete run is not a pass, and a pattern run does not replace it.
3. On commit 9b47df0: status 0, 77 tests in 17 suites, 77 passed, 0 failed,
   0 cancelled, 0 skipped, and 0 todo, in 688 seconds after the builds.

Thus the third complete run of AUTH-08W run r3 is a pass of the AUTH-08W part
and of the hosted live gate as a whole. The completed operator MFA stays a
manual check outside this gate, as the paragraph above gives.

Until the AUTH-06 cases pass, the hosted edition is not released. The
[hosted offline checks](#hosted-offline-checks) never count as this gate.

## Later gates

Later tickets add these suites. They have no command yet. The ticket that adds a
suite also adds its explicit command to `package.json` and to the suite table.
A suite must not depend on another command that selects it silently.

### Paid billing gate (AUTH-11)

AUTH-11 adds the paid billing suites after the owner chooses the payment
provider. The [AUTH-11 specification](../design/billing-design.md#auth-11-implementation-specification)
lists them. The provider contract file `test/interface/billing/<provider>.live.ts`
and the live acceptance file `test/acceptance/billing/paid-billing.live.ts` run
in the provider sandbox with a dedicated command. The `.live.ts` names do not
match the `*.test.js` globs on purpose. If the sandbox credentials are missing,
the command must fail with a clear setup error.

The paid billing gate passes only when the dedicated command runs with the
sandbox credentials and every live test passes. Missing credentials, a setup
error, and skipped live tests can never count as a pass. Do not put
credentials in the repository, in logs, or in pull request notes. The free
billing tests are not a paid billing gate. Until this gate passes, the hosted
edition uses `BillingFree`, and no release collects payments.

## Gate sources

These files state test commands or gates. Keep them consistent with this
policy. Update them in the same pull request as a gate change.

- [AGENTS.md](../../AGENTS.md): pull request rules, test types, and Delamain
  worker limits.
- [CLAUDE.md](../../CLAUDE.md): Claude model rules. It includes AGENTS.md.
- [package.json](../../package.json): the exact suite commands.
- [README.md](../../README.md#build-and-test-commands): the script list, build
  behavior, suite prerequisites, and the release checks.
- [Test inventory](../testing/test-list.md): executed and pending test cases,
  with focused commands.
- [Authentication implementation plan](../design/authentication-design.md#verification-and-release-gates):
  planned authentication suites and release gates.
- [Paid billing design](../design/billing-design.md#auth-11-implementation-specification):
  planned paid billing suites and the paid gates.
- [Lightpanda runtime](../lightpanda-runtime.md#verify-rendering): renderer
  setup, interface test commands, and the renderer gate.
