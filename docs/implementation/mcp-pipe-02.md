# MCP-PIPE-02: operation correlation

Status: merged in PR #159; functional validation, environment restoration, and manager review complete.
Implementation baseline: `a50382ea` on `origin/main`.
Tested implementation revision: `aa76f9f634225096fde405a5d1736e2cba34bb3f`.
PR: [#159](https://github.com/tomer-mayara/Thermus/pull/159).

The user authorized this slice after merging MCP-PIPE-01 in
[PR #155](https://github.com/tomer-mayara/Thermus/pull/155). The baseline also
includes the architecture evolution plan in PR #156. The
[reviewed ticket](mcp-pipelines-plan.md#mcp-pipe-02--correlate-operations-and-update-record-readers)
defines the scope. Implementation and hosted Linux AMD64 image validation are
complete. Environment restoration and manager review are complete; the owner
merged PR #159.

## Scope and intended behavior

Add one operation ID to each dispatched MCP call and its existing completion
record. Allocate the UUID before tool-name and argument validation. Preserve
the same ID and signal through the protected operation, hosted capacity wrapper,
development spy, and direct callers.

Replace the third operation argument with readonly `ExecutionContext { signal, operationId }`;
keep the three-parameter contract. Validate supplied identity once before work
or logging. Do not add an optional fallback or allocate a second ID inside the
operation. Keep current permission, URL, cancellation, and busy precedence.

The core's `assertOperationId` accepts 36-character hyphenated hexadecimal
UUIDs with version 1–8 and variant 8/9/a/b, preserving letter case. It rejects
nil/max, braces/compact forms, whitespace, extra text, or wrong version/variant
with fixed `Invalid execution context`, without raw input or a cause. Validation
follows cancellation, permission, and URL guards and precedes fetch work.
Dispatch uses Node `randomUUID`; client IDs, `_meta`, and arguments do not select it.

Update record readers to select the event type and operation ID. A non-completion
event must not resolve `firstCompletion`. Keep one completion attempt per
dispatched call and no completion for HTTP/auth/body/envelope refusals before
dispatch. The existing completion fallback and best-effort behavior remain.
Its URL path and verbatim reason can still contain sensitive text.

This slice adds no outgoing/incoming standard steps, step records, policy,
redaction, cache, or typed withholding. Exact Markdown, empty success, fixed
public failures, renderer diagnostics, and cleanup/capacity ownership remain.

## Intended BDD and TDD evidence

Write the new acceptance case first and record its genuine failure before the
behavior exists. Then use focused TDD for identity and forwarding, keep tests
green after each change, and run the acceptance case again.

- Given concurrent dispatched calls in either edition/protocol era, when they
  finish, then IDs are distinct and each call's collaborators receive its
  original ID and signal.
- Given unknown, invalid, denied, busy, or cancelled dispatched calls, when
  they finish, then each completion has its ID. Pre-dispatch refusals still
  have no tool completion.
- Given a reader and a different event type, when that event arrives, then
  the completion wait stays pending; the actual completion resolves it once.
- Given invalid direct-call ID text, when validation runs, then no protected
  work starts and unchecked identity text does not reach records.
- Given abort or overlapping hosted work, when calls settle, then cancellation
  and busy precedence remain, and the slot stays owned through real cleanup.

Use the repository test definitions: real collaboration between packages is
integration, including protected core tests with real auth. Keep focused
single-package tests at their own boundaries and reuse existing MCP drivers/sites.
Update the current tool/logging reference and test inventory with the final
interfaces and actual changed tests after implementation.

## Verification record

The foundation ran no implementation suites or AST measurements. The BDD, TDD,
and focused results are below. The final hosted build, complete integration,
renderer proof, and full acceptance passed after the test-only reader fixes.
The failed first acceptance run remains recorded. The self-hosted container
and hosted Linux AMD64 container gates passed. Environment restoration is verified.
The completed quality reviews retain the findings explained below.

The manager checked Node `24.20.0`, `pnpm install --frozen-lockfile`, Lightpanda
`1.0.0`, and ast-metrics `0.43.1`. These prerequisite checks are not test-gate
passes.

| Evidence | Status |
| --- | --- |
| First failing acceptance specification | Expected red: exit 1; 24 tests, 0 suites, 22 passes, 2 failures; zero cancelled/skipped/todo |
| UUID contract TDD | Red: exit 1, 27 tests, 12 passes, 15 failures; green: exit 0, 27 passes; zero cancelled/skipped/todo |
| Context forwarding TDD | Red: exit 1, 29 tests, 27 passes, 2 failures; included in the focused green run below |
| Reader acceptance/TDD | Red: exit 1, 31 tests, 28 passes, 3 failures; included in the focused green run below |
| Initial ordinary changed-test run | Exit 0; 232 tests, 8 suites, 232 passes |
| Remaining work-slice reader fixes | Exit 0; 8 tests, 2 suites, 8 passes; zero failed/cancelled/skipped/todo |
| Changed renderer runtime assertion | Final hosted build passed: 9 renderer tests, 1 suite, 9 passes |
| Complete check | Final hosted build passed |
| Habit-hooks review | Exit 1; retained findings with reasons below; snooze `[]` |
| Complete integration | Final hosted build passed: 522 tests, 44 suites, 522 passes |
| Full acceptance | Final run exit 0: backend 464 tests, 47 suites, 464 passes; portal 16 tests, 0 suites, 16 passes; zero other outcomes |
| Self-hosted container | Exit 0; 13 tests, 1 suite, 13 passes; zero failed/cancelled/skipped/todo |
| Hosted Linux AMD64 container | Exit 0; 9 tests, 0 suites, 9 passes; zero failed/cancelled/skipped/todo |
| Environment restoration | Verified against original inventory; VM stopped with original 4 CPUs/4 GiB |
| Required AST delta/inspection passes and final review | Complete; nonzero results and retained findings below |
| Manager implementation and docs review | Signed off |
| Owner PR review | Owner merged PR #159 |

The first red command was:

```sh
pnpm run build && pnpm exec node --test dist/test/acceptance/mcp/http-fetch.test.js
```

`.cache/mcp-pipe-02/acceptance-red.log` records the result. The positive call in
each protocol era failed because completion `operationId` was undefined. These
are failures of the new requirement, not artificial failures of existing Markdown.

The UUID contract used the same command for red and green:

```sh
pnpm run build && pnpm exec node --test dist/test/unit/page-fetch/execution-context.test.js
```

`context-red.log` records the 15 rejected-input cases that wrongly succeeded
before validation. `context-green.log` records all 27 cases passing. Both logs
are under `.cache/mcp-pipe-02/`.

The forwarding red command was:

```sh
pnpm run build && pnpm exec node --test dist/test/unit/mcp/single-fetch-operation.test.js dist/test/integration/page-fetch/fetch-page.test.js
```

`.cache/mcp-pipe-02/forwarding-red.log` records the two failures: an invalid
supplied ID wrongly succeeded, and the hosted wrapper treated the context as
a signal. The same assertions remain after the contract change. These focused
results do not replace the complete-candidate gates.

The reader red command was:

```sh
pnpm run build && pnpm exec node --test dist/test/acceptance/mcp/http-fetch.test.js dist/test/unit/test-support/operator-log.test.js
```

`.cache/mcp-pipe-02/readers-red.log` records two premature `firstCompletion`
resolutions and an exact-ID query that returned both records. There were zero
cancelled, skipped, or todo cases in the forwarding and reader red runs.

### Focused green

`.cache/mcp-pipe-02/focused-green.log` records the 232 passing tests. The run
includes the ordinary tests changed at that point and the entry point for the changed
`test/integration/auth/hosted-live-site/mcp.ts` module. It does not replace the
renderer runtime test or final gates.

```sh
pnpm run build && pnpm exec node --test \
  dist/test/unit/page-fetch/execution-context.test.js \
  dist/test/unit/mcp/get-url-as-markdown.test.js \
  dist/test/unit/mcp/single-fetch-operation.test.js \
  dist/test/unit/test-support/fetch-operation-spy.test.js \
  dist/test/unit/test-support/operator-log.test.js \
  dist/test/integration/page-fetch/fetch-page.test.js \
  dist/test/integration/mcp/fetch-tool-server.test.js \
  dist/test/integration/mcp/tool-completion-record.test.js \
  dist/test/integration/mcp/get-url-as-markdown-pipeline.test.js \
  dist/test/integration/mcp/get-url-as-markdown-mcp.test.js \
  dist/test/integration/mcp/renderer-setup-report.test.js \
  dist/test/integration/fetch-tool-renderer-setup-report.test.js \
  dist/test/integration/auth/hosted-live-site.test.js \
  dist/test/acceptance/mcp/http-fetch.test.js \
  dist/test/acceptance/mcp/http-fetch-refusals.test.js \
  dist/test/acceptance/mcp/http-fetch-cancellation.test.js \
  dist/test/acceptance/mcp/http-request-isolation.test.js \
  dist/test/acceptance/mcp/http-shutdown.test.js \
  dist/test/acceptance/mcp/http-cancelled-shutdown.test.js \
  dist/test/acceptance/mcp/http-dns-cancellation.test.js \
  dist/test/acceptance/mcp/http-renderer-shutdown.test.js \
  dist/test/acceptance/mcp/hosted-fetch-tool.test.js \
  dist/test/acceptance/mcp/self-hosted-fetch-tool.test.js
```

A follow-up replaced structural signal comparison with strict reference
identity assertions:

```sh
pnpm run build && pnpm exec node --test dist/test/acceptance/mcp/http-request-isolation.test.js
```

`.cache/mcp-pipe-02/signal-identity-green.log` records exit 0, 10 tests,
0 suites, and 10 passes, with zero failed/cancelled/skipped/todo. Scoped ESLint
on all 35 changed/new source and test TypeScript files exited 0 with no findings;
its exact argument list is in `.cache/mcp-pipe-02/focused-eslint.log`.
This scoped check is not the complete check or habit-hooks review.

### Final hosted build and renderer

The complete candidate after the reader fixes passed this command with exit 0:

```sh
LIGHTPANDA_BIN=/Users/tomermayara/git/Thermus/.cache/lightpanda/1.0.0/lightpanda pnpm run build:hosted
```

`.cache/mcp-pipe-02/build-hosted.log` records the seven phases in order:

| Phase | Tests | Suites | Passed |
| --- | ---: | ---: | ---: |
| Backend unit | 2754 | 194 | 2754 |
| Portal unit | 19 | 0 | 19 |
| Build | 13 | 0 | 13 |
| Portal acceptance | 16 | 0 | 16 |
| Complete integration | 522 | 44 | 522 |
| Hosted offline | 128 | 17 | 128 |
| Real renderer | 9 | 1 | 9 |

Every phase had zero failed, cancelled, skipped, or todo tests. Typechecks and
the portal build also passed. This run supplies the complete check, integration,
hosted offline build, and real-renderer proofs, including the changed runtime
record assertion. The earlier pass before the reader fixes is preserved in
`.cache/mcp-pipe-02/build-hosted-initial.log`; the final repeat had the same
counts. This command does not supply full acceptance or either container gate.

### Full acceptance: first run

The first `pnpm run test:acceptance` run exited 1.
`.cache/mcp-pipe-02/acceptance-first.log` records 464 backend tests in 47 suites:
459 passed, 5 failed, and zero cancelled/skipped/todo. The command stopped before
portal acceptance.

Three auth WorkOS work-slice cases and the two basic work-slice protocol-era
cases compared completion records with old exact objects that had no
`operationId`. The actual records included the new generated ID. These reader
assertions need to validate the ID and retain the existing field checks.
The failed full run is not a pass. The focused corrections below and final
acceptance repeat passed.

### Full acceptance: final run

The repeated `pnpm run test:acceptance` command exited 0.
`.cache/mcp-pipe-02/acceptance.log` records 464 backend tests in 47 suites,
all 464 passed, followed by 16 portal tests in 0 suites, all 16 passed.
Both phases had zero failed, cancelled, skipped, or todo tests.

Axiom settings were read from the main checkout's `.env.local` only into the
child process environment, with the designated `system-log-test` dataset.
No secret value was copied into docs or logged. Container gates are separate
proofs.

### Self-hosted container

`pnpm run test:container` exited 0.
`.cache/mcp-pipe-02/container.log` records 13 tests in 1 suite, all 13 passed,
with zero failed, cancelled, skipped, or todo tests. This dedicated image gate
ran the changed `self-hosted-container.test.ts` UUID assertions before the
implementation commit. Every new or changed test has now run locally.
The hosted Linux AMD64 gate and environment restoration passed as recorded below.

The manager committed and pushed the implementation as `aa76f9f6`; PR #159
was merged by the owner. Native gate cleanup matched the original resource inventory;
`.cache/mcp-pipe-02/environment/native-cleanup.ok` records that check. The
hosted image gate used temporary Rosetta with 2 CPUs, 4 GiB, and SSH forwarding.
The original environment is now restored. This slice made no QEMU attempt.

### Hosted Linux AMD64 container

The exact `pnpm run test:container:hosted` gate exited 0 under temporary Rosetta.
`.cache/mcp-pipe-02/container-hosted-rosetta.log` records 9 tests in 0 suites,
all 9 passed, with zero failed, cancelled, skipped, or todo tests. The status
file records 0. Duration was 1,354,877 ms.

The seven packaged runtime cases passed: metadata; CLI/portal/origin handling;
signup notice; public HTTPS and JavaScript rendering; private-address guards,
capacity, disconnect and SIGTERM; startup failures; and missing portal. The
deliberately failing offline build produced no runtime image, so its outer
assertion passed. The ninth result is the parent test.

The positive image's seven offline phases passed with the same counts as the
final hosted build above: 2754/19/13/16/522/128/9 tests and
194/0/0/0/44/17/1 suites, all passed and zero other outcomes.
`.cache/mcp-pipe-02/hosted-positive-build.log` records those inner phases.
All functional proofs are complete.

### Environment restoration

The original VM boot needed one bounded retry. The first restoration helper
then expected QEMU backup entries that had never existed: the original binfmt
inventory held only `python3.12`, `register`, and `status`. Its comparison failed
even though the current inventory matched the original. Restoration-only
verification was corrected to handle only entries present in the original
inventory; no product source, test, or gate changed.

The corrected verifier passed config bytes, binfmt entries, resources, Docker
context/engine, actual CPU count, and non-doc source hashes, then stopped the
VM. The manager independently compared the original backups with the restored
state: exact VM JSON (`Stopped`, 4 CPUs, 4 GiB), all three config files, context
and engine, CPU count 4, original containers/volumes/networks/images, and
non-doc SHA256 values all matched. Evidence is
`.cache/mcp-pipe-02/rosetta/restoration.ok` and
`.cache/mcp-pipe-02/environment/final-restoration.ok`.

### Remaining reader fixes

The work-slice readers now use `completionRecordsIn`, validate the UUID,
and retain the exact two debug lines, one completion, and all previous field
checks. The self-hosted container assertion also validates the UUID before
checking the unchanged legacy fields. These are test-only changes in three files:

- `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.ts`
- `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.test.ts`
- `test/acceptance/auth/self-hosted-container.test.ts`

```sh
pnpm run build && pnpm exec node --test \
  dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.js \
  dist/test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.test.js
```

`.cache/mcp-pipe-02/remaining-readers-green.log` records exit 0, 8 tests in
2 suites, and 8 passes, with zero failed/cancelled/skipped/todo. The container
assertion passed in the dedicated gate above. The repository-wide reader audit
found no further exact-object migration; remaining live readers already filter
the completion event.

Scoped ESLint with `--config .habit-hooks/eslint.config.mjs` on these three
files exited 0 with no findings; see `remaining-readers-eslint.log` under the
same cache directory. The first call omitted the config and exited 2 without
running lint; `remaining-readers-eslint-config-error.log` preserves that setup
error. No production source changed in this correction.

### AST review and retained findings

The branch was checked against unchanged `origin/main` at `a50382ea` before
measurement. The default delta command first failed to add its HTML comparison:
`Cannot compare code with branch or commit origin/main`. No successful HTML
comparison is claimed. All three measurement passes then used:

```sh
pnpm exec node script/ast-metrics-delta.ts --no-compare
```

Each exited 1 because five of the six changed production files were below 85.
The scores stayed the same in all three passes. For each low-score file, each
pass ran `pnpm exec node script/ast-metrics-mcp.ts file <path>`. All 15 inspections
exited 0. Logs are `.cache/mcp-pipe-02/ast-delta-pass{1,2,3}.log` and
`ast-pass{1,2,3}-<file>.log` in the same directory. No structural change was
justified by these inspections.

| Production file | Score | Reason to retain |
| --- | ---: | --- |
| `src/mcp/fetch-tool-server.ts` | 51.4 | The 31-line `callTool` callback has 7 decision paths. It owns one dispatch, result projection, and terminal completion in `finally`. Splitting that sequence would hide its ownership. |
| `src/page-fetch/fetch-page.ts` | 53.0 | The 26-line operation callback has 4 paths. It keeps guard, fetch, process, cancellation, and safe failure order explicit. Phase helpers or mutable phase flags would obscure that order. |
| `src/mcp/tool-completion-record.ts` | 56.5 | The largest function has 6 paths. Fixed input/status projection remains cohesive; broader changes to URL or reason logging are outside this slice. |
| `src/page-fetch/execution-context.ts` | 79.7 | The 6-line validator has 4 paths and checks one UUID invariant. The exact 36-character bound prevents a trailing-newline match and bounds regex input. Smaller predicates would add indirection. |
| `src/mcp/single-fetch-operation.ts` | 83.5 | The 10-line callback has 2 paths and owns one slot through settlement and cleanup. A separate wrapper would hide the release rule. |

The thin MCP adapter scored 87.2. No new function has more than 10 decision
paths. Function path counts above are not file totals.

The final command, `pnpm exec node script/ast-metrics-review.ts`, exited 1.
`.cache/mcp-pipe-02/ast-review-final.log` and `ast-report/review.md` contain its full
Markdown: two high, three medium, and three low findings. Retain them as follows:

- High: `HtmlPageProcessor` class maintainability is 73. Its source has no diff
  from `origin/main`; this finding is inherited from merged MCP-PIPE-01. The
  adapter has a 6-line, 2-path method and a one-line constructor. Keep the same
  small boundary for size and Markdown checks; the
  [MCP-PIPE-01 disposition](mcp-pipe-01.md#ast-measurement-and-retained-findings) still applies.
- High: HTTP fetch acceptance maintainability fell from 38 to 33. The new
  event-wait and client-ID isolation cases use the existing fixture for both
  protocol eras. The file has 142 lines and each test checks focused public
  behavior. A duplicate site/factory or a split made only for the score would
  add structure without a new responsibility.
- Medium: `createFetchToolServer` has 30 logical lines and 47 physical lines;
  `createFetchPage` has 31 physical lines. Keep their dispatch/finally and
  explicit guard/fetch/process flow for the ownership reasons above.
- Low: composition has 15 dependencies and no source diff in this slice. The
  server has 14 dependencies, including direct `node:crypto` UUID allocation at
  dispatch. Keep this allocation with the call that owns identity.
- Low: the core integration test's Halstead estimate rose from 0.83 to 1.01.
  The added cases check ID refusal and guard precedence with real auth. The
  volume estimate does not justify removing those boundary cases or moving
  them into unit tests.

The refresh after the three test-only reader fixes kept the same findings.
Production source stayed unchanged, so the three measurement passes and 15
inspections remain the final production evidence. Three per-file inspections
for the late test changes exited 0: auth WorkOS slice 46.8, basic slice 53.4,
and self-hosted container 17.9. Tests have no 85 goal. Their logs are
`.cache/mcp-pipe-02/ast-final-*.log`; no fourth production pass ran.

The full review Markdown must also be in the PR description. These results are
not recorded as green. `.ast-metrics.yaml` and `.ast-metrics-baseline.yaml`
remain unchanged.

### Habit-hooks review and retained findings

The final `habit-hooks` run exited 1;
`.cache/mcp-pipe-02/habit-hooks-final.log` records four unused exports,
62 existing comment lines in changed files, and five acceptance files over
200 lines. The first run had 38 comment lines and three long files before the
additional reader fixes. The snooze file remains `[]`.

- The four pre-existing CLI exports are `readyToken` and
  `discoverHostedAuthorization` in `script/fetch-url/oauth.mjs`, and
  `callbackResult` and `launchBrowser` in `script/fetch-url/browser.mjs`. Fixing
  their CLI/test boundary needs a separate refactor; no CLI behavior changes
  in this slice.
- Privacy and lifecycle comments explain why log failure cannot change a
  result, why abort cannot release the hosted slot before cleanup, why a test
  holds one verification request, and why a legacy client must close after
  server shutdown. Delayed-cleanup fixtures model an actual renderer lifetime.
- Renderer/version comments state the explicit gate and pinned-binary setup,
  address-literal and process-double seams, Node's asynchronous versus immediate
  launch errors, and direct child observation after socket cleanup. Other
  comments explain platform telemetry directories and the real-login rate limit.
- Policy/parser fixtures explain final-host ad rules, script reparsing that
  forces scan exhaustion, and a ban that leaves a token active but still loses
  access. These reasons are not apparent from the fixture text alone.
- Log-format comments identify the three site output forms, console prefixes,
  complete tenant terminator, and the matching production formats in test
  fixtures. The spy comments explain the code-point limit and why iteration
  preserves surrogate pairs. Keep these format and Unicode constraints visible.
- Work-slice comments distinguish offline provider/process fixtures from the
  manual live proof, explain the second fixture copy under DRY3, and state
  trusted final-host rules. They also explain the listener/public-base split,
  repeat close result and production stop order, unproven Google MFA,
  ineligible onboarding address, and a non-JSON refusal response.
- Packaged self-hosted comments explain why only the dedicated command arms
  the container gate, which hosted capabilities must be absent, and how the
  page/ad-file fixtures work. They retain stored-consent behavior, environment
  isolation when reading Compose, address-literal DNS behavior, and the image
  CA check before an offline HTTPS connection failure.
- The five long acceptance files remain cohesive:
  `get-url-as-markdown.runtime.ts` owns the renderer proof,
  `http-request-isolation.test.ts` owns concurrent isolation, and
  `self-hosted-fetch-tool.test.ts` owns self-hosted edition behavior.
  `auth-workos-mcp-url-fetch.test.ts` owns the offline work-slice scenarios;
  `self-hosted-container.test.ts` owns packaged installation, persistence,
  restore, account, and shutdown proofs on shared images and volumes. Their
  shared fixtures serve each file's public scenarios. Record assertion changes
  do not justify unrelated fixture extraction or a split at 200 lines.

Each listed comment was read. No source change was justified by this review;
the nonzero habit-hooks result remains explicit.

Follow the plan's [shared verification requirements](mcp-pipelines-plan.md#verification-and-shared-definition-of-done)
and [test gate policy](test-gate-policy.md) for commands and prerequisites.
Use the current [AGENTS.md AST process](../../AGENTS.md#code-quality-review-with-ast-metrics)
and [review guide](ast-metrics-review.md): production goal 85, at most three
measurement/inspection passes, justified residuals and review Markdown in the
PR, and no baseline change in this slice.

The manager reviewed and signed off the documentation foundation, committed it
as `ffc8374f`, and opened draft PR #159 before source work started. Functional
validation and environment restoration are complete. The manager signed off
the implementation and docs; the owner merged PR #159. The final
evidence commit changed docs only; the tested source remained `aa76f9f6`. The retained
quality findings above remain explicit.
