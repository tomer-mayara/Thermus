# MCP-PIPE-04 implementation record

Status: implemented and validated; manager sign-off complete.
All required functional gates and final environment restoration passed.
Quality findings are retained with explicit reasons below. PR #162 tracks
Ready, the final head's Actions checks, and the authorized merge.
Baseline: `190d60f7d8af0b6e0c61017154b363a49686653d` on `origin/main`.
Reviewed implementation: `756175a7ec25c027448625116a3ae300ca1723f9`.
MCP-PIPE-03 merged in [PR #160](https://github.com/tomer-mayara/Thermus/pull/160)
on 2026-10-18 at the owner's request.

PR: [#162](https://github.com/tomer-mayara/Thermus/pull/162), opened as a draft before source changes.

## Scope

Implement [MCP-PIPE-04](mcp-pipelines-plan.md#mcp-pipe-04--add-incoming-processing-and-typed-withholding-together).
Convert the cleaner adapter to the incoming step and remove the temporary
processor port. Carry a typed scan failure or scan limit from the sanitizer
to the incoming decision. Keep the current exact Markdown response, including
empty success for known withholding. Keep ordinary empty content allowed.

## Implemented contracts

`ProcessHtmlStep` replaces `HtmlPageProcessor` and the temporary `PageProcessor`
port. The two dedicated local executors bind the trusted outgoing and incoming
roles; a step-supplied ID cannot select another role. The HTML step runs the
shared UTF-8 size guard before any cleaner or parser. The fixed HTML pipeline
keeps its ad cleaner, sanitizer, and converter order.

The removal session carries `scan_failed` or `scan_limit` through the sanitizer
and `Ctx.scanWithholding`. Warnings remain available; no release decision reads
warning text.
`FetchPage` returns a neutral `released` result with exact Markdown or a
payload-free `withheld` result with a known code. Ordinary empty Markdown is
released. Only the trusted incoming binding can accept known scan codes.
Unknown codes, invalid results, generic blocks, and failures give the fixed
processing error. Known withholding maps explicitly to exact empty MCP success,
without an error flag or structured content; completion remains `success`.

Each entered incoming step attempts one fixed record with ID
`incoming.process_html`. Completed empty output is allowed; typed withholding
is blocked. The outgoing record does not change when later work fails or is
cancelled. Cancellation and hosted capacity ownership continue through cleanup
and settlement. Metrics, limits, and renderer diagnostics retain their owners.

## Interim verification

The draft opened before source changes. The first BDD acceptance run failed
because no incoming record existed: 6 tests, 0 passes, 6 failures. Its existing
empty-success assertions passed before the new event assertion failed. This
was a new-observation red step, not a change to the empty response contract.

Executable red runs then covered the source signal, sanitizer propagation,
and adapter validation. The executor was implemented under the failing public
acceptance specification; no separate executor red run was recorded. Focused
green runs covered the executor, MCP mapping, and cancellation. Logs are local
under `.cache/mcp-pipe-04/`; they are evidence for the saved interim candidate,
not a substitute for the final gates.

| Proof | Interim result | Log |
| --- | --- | --- |
| BDD incoming records | Red: 6 tests, 0 pass, 6 fail | `acceptance-red.log` |
| Removal-session signal | Red: 8 tests, 6 pass, 2 fail; green: 8 pass | `scanner-red.log`, `scanner-green.log` |
| Sanitizer propagation, changed warning words | Red: 10 tests, 8 pass, 2 fail; green: 10 pass | `sanitizer-red.log`, `sanitizer-green.log` |
| Adapter field capture and array refusal | Red: 19 tests, 16 pass, 3 fail; fixed before later green selections | `adapter-validation-red.log` |
| Focused executor selection | Green: 109 tests, 109 pass | `executor-green.log` |
| HTTP and related contracts | Green: 134 tests, 134 pass | `http-green.log` |
| Cancellation and cleanup | Green: 54 tests, 54 pass | `cancellation-green.log` |

The green selections above report zero failures, cancelled tests, skipped tests,
and todo tests. The failed red runs are intentional specification evidence,
not final gate failures. Complete-candidate results are recorded below.

## Final focused run

The following commands exited 0 on the reviewed source and test candidate:

```sh
pnpm run build
pnpm exec node --test \
  dist/test/unit/page-fetch/execute-incoming-step.test.js \
  dist/test/unit/page-fetch/execute-outgoing-step.test.js \
  dist/test/unit/html-cleaner-pipeline/process-html-step.test.js \
  dist/test/unit/html-cleaner-pipeline/prompt-injection-remover/hidden-html/hidden-html-removal-session.test.js \
  dist/test/unit/mcp/get-url-as-markdown.test.js \
  dist/test/integration/page-fetch/fetch-page.test.js \
  dist/test/integration/mcp/get-url-as-markdown-pipeline.test.js \
  dist/test/integration/mcp/renderer-setup-report.test.js \
  dist/test/acceptance/architecture/page-fetch-boundaries.test.js \
  dist/test/acceptance/mcp/incoming-step.test.js \
  dist/test/acceptance/mcp/incoming-step-cancellation.test.js \
  dist/test/acceptance/mcp/hosted-fetch-tool.test.js \
  dist/test/acceptance/mcp/self-hosted-fetch-tool.test.js \
  dist/test/acceptance/mcp/outgoing-step.test.js \
  dist/test/acceptance/mcp/outgoing-step-cancellation.test.js \
  dist/test/acceptance/mcp/http-fetch.test.js \
  dist/test/acceptance/mcp/http-request-isolation.test.js
```

The selection includes all 16 new or changed executable test files and the
unchanged outgoing executor regression suite. The build exited 0. The test run
reported 319 tests in 6 suites: all 319 passed, with zero failures, cancelled,
skipped, or todo tests, in 11,454.336334 ms. Logs:
`focused-final-build.log` and `focused-final.log` under `.cache/mcp-pipe-04/`.

Scoped ESLint on all changed source, test, and support files exited 0 with zero
warnings (`scoped-eslint.log`). `git diff --check` exited 0. These focused checks
precede the complete-candidate functional and quality gates below.

## Complete-candidate functional gates

`pnpm run build:hosted` exited 0 on implementation `756175a7`. It completed
`check`, all integration tests, the hosted offline selection, and the real
renderer gate. Every selected test passed, with zero failures, cancelled,
skipped, or todo tests in each phase:

| Phase | Tests / passed | Suites |
| --- | ---: | ---: |
| Backend unit | 2,847 / 2,847 | 194 |
| Portal unit | 19 / 19 | 0 |
| Build tests | 13 / 13 | 0 |
| Portal acceptance | 16 / 16 | 0 |
| Integration | 535 / 535 | 44 |
| Hosted offline acceptance/interface selection | 142 / 142 | 17 |
| Real renderer | 9 / 9 | 1 |

The final renderer phase supplies the complete rendered MCP proof under the
[test gate policy](test-gate-policy.md#renderer-gate-mcp-p03). It is recorded
once and needs no duplicate host renderer run. The build also completed
type checking and the portal build. Evidence is in
`.cache/mcp-pipe-04/build-hosted.log` and `build-hosted.status` (`0`).
`pnpm run test:acceptance` also exited 0. The backend reported 556 tests in
47 suites, all 556 passed, in 30,873.287625 ms. Portal acceptance reported
16 tests in 0 suites, all 16 passed, in 166.173 ms. Both phases reported zero
failures, cancelled, skipped, or todo tests. The dedicated native container
suite is conditional in ordinary acceptance; that suite's explicit gate is
separate. This acceptance report contains no skipped tests. Evidence is in
`.cache/mcp-pipe-04/acceptance-full.log` and `acceptance-full.status` (`0`).

`pnpm run test:container` exited 0: 13 tests in 1 suite, all 13 passed, with
zero failures, cancelled, skipped, or todo tests, in 73,902.811209 ms. Evidence
is in `.cache/mcp-pipe-04/container-self-hosted.log` and
`container-self-hosted.status` (`0`). The manager compared container, volume,
and network inventories, original image tags, and Docker context against the
pre-task snapshot; the native gate cleanup was verified (`native-cleanup.ok`).

The unchanged `pnpm run test:container:hosted` exited 0 on Linux AMD64 under
Rosetta with 2 CPUs and 4 GiB. It reported 9 tests in 0 suites, all 9 passed,
with zero failures, cancelled, skipped, or todo tests, in 1,090,160.375375 ms.
The count includes the parent and eight subtests: seven runtime proofs and the
deliberate failing-check proof that prevents a runtime image. That negative
build proof passed in 303,394.2315 ms. Evidence is in
`.cache/mcp-pipe-04/container-hosted-rosetta.log` and
`container-hosted-rosetta.status` (`0`).

The runner exited 0 and restored the original VM. The manager independently
verified 757 tracked implementation inputs against the snapshot; the exact
bytes of all three original configuration files; Docker context and engine;
stopped-container, volume, and network inventory; and original image tags.
The VM is back to 4 CPUs, 4 GiB, and its original stopped state. The marker is
`.cache/mcp-pipe-04/environment/final-restoration.ok`. Source, tests, and README
have no diff from `756175a7`. A fresh fetch confirmed that `origin/main` remains
`190d60f7`.

## Implementation review

The manager reviewed all source and tests. The review requested captured
decision fields, removal of a redundant catch, and proof that a sink-triggered
abort cannot release Markdown. These changes and proofs are complete. This is
the completed functional review. Final manager sign-off is recorded below.

Both production editions use `test/support/fixtures/incoming-pages.ts` for
seven page cases in each protocol era: empty, hidden-only, ad-only, real scan
failure, eight-scan exhaustion, oversize, and excessive depth. Each edition and
era also checks fetch failure. Existing normal and redirect cases keep exact
Markdown. The SDK negotiation and raw protocol driver are unchanged.

## Quality review and retained findings

The default `pnpm exec node script/ast-metrics-delta.ts` run failed because its
optional comparison could not compare with `origin/main`. It did not establish
an HTML comparison pass. The manager then ran:

```sh
pnpm exec node script/ast-metrics-delta.ts --no-compare
pnpm exec node script/ast-metrics-mcp.ts file <path>
pnpm exec node script/ast-metrics-review.ts
```

There were three delta passes, each exit 1 with identical reports: 8 of 9
measured production files remained below 85. Each pass inspected all eight
files with the file command: 24 calls, all exit 0, with identical inspections.
The manager found no further source change that improved these bounded roles.
The final review exited 1 with 4 high, 10 medium, and 4 low findings, plus
2 improvements. These nonzero quality results are retained findings, not green
gates. The full Markdown from `ast-report/review.md` belongs in PR #162.

| Production file under `src/` | File score | Retained reason |
| --- | ---: | --- |
| `page-fetch/execute-incoming-step.ts` | 47.2 | One lifecycle owns await, validation, cancellation, and terminal recording in `finally`. The function has 32 physical lines, 21 logical lines, and 9 paths. The 9-line result guard has 10 paths; its object and closed-code helpers have 3 lines each. A generic runner or phase flags would obscure ownership. |
| `html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts` | 50.9 | The existing 31-line, 8-path `invoke` owns report accumulation. This slice adds only the typed field; it preserves the algorithm and warnings. This also disposes of the high class finding. |
| `page-fetch/fetch-page.ts` | 53.6 | The callback has 24 lines and 3 paths. The 31-line factory keeps guard, outgoing, fetch, and incoming order explicit. The redundant processing catch was removed. |
| `html-cleaner-pipeline/prompt-injection-remover/hidden-html-removal-session.ts` | 58.1 | `run` has 26 lines and 6 paths. Only typed exit/result metadata changed. Eight scans, provenance, and warning maxima stay together. The high class score is 63. The empty constructor's zero score is a metric artifact. |
| `html-cleaner-pipeline/process-html-step.ts` | 59.7 | The 15-line, 10-path method owns the size guard, one pipeline call, captured own fields, closed scan codes, and string output. It replaces one adapter. Splitting it into an adapter chain would hide this boundary. This also disposes of the high class finding. |
| `mcp/get-url-as-markdown.ts` | 67.5 | The 6-line, 6-path callback explicitly maps known scan codes and released strings. The score drop from 87 to 67 reflects the required compatibility whitelist. |
| `fetch-tool.ts` | 80.3 | Runtime behavior changes only in the adapter binding. The 17-line, 1-path factory and existing privacy helpers retain composition ownership. |
| `page-fetch/step-record.ts` | 83.2 | Only the closed code type changed. The existing writer has 7 lines and 2 paths; duration handling has 5 lines and 3 paths. |

`html-to-markdown-pipeline.ts` scored 92.3. The high hosted acceptance score
drop, 32 to 26, comes from the real edition/era page cases and failure proof at
one public boundary. Both editions reuse fixture data; a mechanical file split
would not improve that responsibility. The two new 10-path guards are reported
as medium findings even though the guide names more than 10 paths. Their bounded
validation roles and malformed-result tests justify retaining them.

The review also reports unchanged dispatch length (47 physical/30 logical
lines) and outgoing executor file complexity (23 paths); the manager verified
no diff in those files. Composition/core dependencies, 16 and 13, are public
role contracts. Dispatch's 14 dependencies are unchanged. Aggregate dependency
bags would hide them. The real-pipeline integration Halstead estimate rose
from 0.49 to 0.68 with once/order and typed-record assertions; it is a test-volume
estimate, not an observed defect. Core integration improved from 1.66 to 1.20,
and the scanner test improved from 0.55 to 0.43.

`habit-hooks` exited 1. The manager retained all findings with these reasons:

- Four unchanged CLI exports (`readyToken`, `discoverHostedAuthorization`,
  `callbackResult`, `launchBrowser`) require a separate CLI/test-boundary cleanup.
- Fourteen existing comments explain reasons or contract limits: five
  composition lifetime/deduplication/privacy lines, three `Ctx` count/category
  lines, one best-effort record line, three self-hosted renderer-double,
  final-host-rule, and ban-lifecycle lines, and two scan lines for unchecked last
  output and warning maxima.
- Three oversized test files keep cohesive public-boundary fixtures:
  `http-request-isolation.test.ts`, `self-hosted-fetch-tool.test.ts`, and the
  core integration `fetch-page.test.ts`. No meaningful new split was identified.

Rules and `.ast-metrics-baseline.yaml` are unchanged. The habit-hooks snooze
file remains `[]`. Logs are under `.cache/mcp-pipe-04/`, including
`ast-delta-default.log`, `ast-delta-pass1.log` through `ast-delta-pass3.log`,
24 `ast-pass*-*.log` inspections, and `habit-hooks-final.log`.

## Final sign-off and pull request state

The manager reviewed and signed off the implementation, tests, current docs,
functional gate evidence, environment restoration, and retained quality
findings. All changed tests ran before the implementation commit. The final
structural documentation checks cover links, anchors, fences, inventory paths,
and current status. The historical `outgoing-step-records` anchor is preserved.

This slice adds no decision record. The user authorized the manager to merge.
PR #162 still owns the final Ready transition, exact-head Actions checks, and
one authorized merge under [AGENTS.md](../../AGENTS.md) and the
[test gate policy](test-gate-policy.md). This record does not claim that the
pull request is merged or that those final pull request steps have finished.
