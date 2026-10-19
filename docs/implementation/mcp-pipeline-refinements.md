# MCP pipeline refinements

Status: implemented and validated in [PR #164](https://github.com/tomer-mayara/Thermus/pull/164). Date: 2026-10-18.
Implementation commit: `cf976dc8`.
Review baseline: `27fa96c2bc47d890787a35be81ff6a2ebff42d61`.

The [reviewed improvement plan](../archive/mcp-pipelines-improvement-plan.md) selects small
contract refinements. This record tracks their implementation and verification.
The independent [Martin-inspired review](../archive/mcp-pipelines-review-martin.md) and
[Metz-inspired review](../archive/mcp-pipelines-review-metz.md) remain historical review
baselines. They do not describe a verified final candidate.

## Scope

- MCP-REFINE-01: audit the existing characterization coverage before refactoring.
- MCP-REFINE-02: rename inner `Step` to `HtmlTransformation` and `Ctx` to
  `HtmlProcessingContext`, with no permanent compatibility aliases.
- MCP-REFINE-03: remove the unused executable `PipelineStep.id` and concrete
  declarations. Keep record identity in trusted executor bindings.
- MCP-REFINE-04: add one bounded `Code extends BlockCode = BlockCode` parameter
  to `StepResult` and `PipelineStep`. Use `OutgoingStep` for
  `PipelineStep<string, string, 'blocked'>` and `IncomingStep` for
  `PipelineStep<WebsiteFetchResult, string>`. Prove outgoing code rejection and
  incoming code acceptance through typecheck.

The small transformation loop stays. Partial and repeated arrays stay valid.
A partial context can lack Markdown. `ProcessHtmlStep` remains the completion
boundary and returns the incoming decision. No second completed-result union,
wrapper, or producer is added. Runtime validation, snapshot reads, withholding,
record schema, cancellation, and capacity ownership stay unchanged.

MCP-REFINE-05 remains deferred. No inspected defect or measured change cost
requires a fixed processor or narrow leaf contracts. Early withholding exit,
stronger cancellation, extra outer decisions, and privacy-policy changes remain
outside this work.

## Characterization audit

The audit found existing coverage for the runtime acceptance criteria:

| Contract | Existing coverage |
| --- | --- |
| Guard precedence and original URL | Page-fetch integration tests |
| Final URL for rules and relative links | Redirect unit and interface tests |
| Title, counts, reports, partial and repeated arrays | HTML pipeline unit tests, pipeline-counter acceptance tests, and real MCP pipeline integration tests |
| Malformed results, own-property checks, and captured values | Executor and `ProcessHtmlStep` unit tests |
| Trusted records and safe fields | Executor unit and MCP acceptance tests |
| Cancellation, call isolation, and capacity settlement | Unit and MCP acceptance tests |

These are unchanged behaviors. Passing characterization coverage is the starting
point; a false red acceptance case is not required. The new gap is static code
precision. The compile-time interface proof must fail before narrowing and pass
after it. The proof is
[`test/interface/page-fetch/pipeline-step-types.ts`](../../test/interface/page-fetch/pipeline-step-types.ts).
It derives result types from the dependencies of `createFetchPage`, so it checks
the role types that the fetch operation actually accepts. It has two negative
outgoing scan-code assignments and six positive assignments: outgoing allow and
block, incoming allow, and all three incoming block codes.

The implementation agent ran `pnpm exec tsc --noEmit` before narrowing. It exited
1 with exactly two TS2578 unused `@ts-expect-error` diagnostics. The same command
after narrowing exited 0. No production cast was added to satisfy this proof.

## Verification

Before edits, the implementation agent reports a successful build and a passing
characterization run: 1,475 tests in 102 suites. A focused run after the naming
change passed 1,251 tests. These runs cover intermediate candidates and do not
replace final complete-candidate gates.

The implementation agent reports these focused results. Exact selections are
in the local run evidence `.cache/mcp-refine/commands.txt`; logs are in the same
directory. The test counts do not include the compile-only proof.

| Check | Result | Log |
| --- | --- | --- |
| Before-edit characterization | 1,475 tests, 102 suites passed | `characterization.log` |
| Naming slice | 1,251 tests passed | `rename.log` |
| Executable ID removal | 253 tests, 2 suites passed | `id.log` |
| Compiler negative proof | Exit 1, exactly two TS2578 diagnostics | `types-red.log` |
| Compiler positive proof | Exit 0 | `types-green.log` |
| `npm run typecheck` | Exit 0 | `typecheck.log` |
| Final focused build | Exit 0 | `final-build.log` |
| Scoped ESLint | Exit 0 | `eslint.log` |
| Final focused runtime selection | 1,490 tests, 103 suites passed; zero failed, cancelled, skipped, or todo | `final-focused.log` |
| Last test-title wording cleanup | 10 tests, 1 suite passed | `context-wording.log` |

The final focused selection covers page-fetch and HTML pipeline units,
`ProcessHtmlStep`, single-slot ownership, page-fetch and real MCP integration,
renderer setup reporting, pipeline counters, hosted ad policy, and outgoing and
incoming MCP step acceptance. No live or runtime interface file changed.

The manager reviewed the production runtime diff and tests and accepted the
implementation handoff. Runtime logic is unchanged. The static contracts are
narrower, and executable IDs are removed.

The complete local `npm run build:hosted` command exited 0
(`build-hosted.log` and `build-hosted.status`). Its test results were:

| Suite | Passed tests | Suites |
| --- | ---: | ---: |
| Backend unit | 2,847 | 194 |
| Portal unit | 19 | 0 |
| Build checks | 13 | 0 |
| Portal acceptance | 16 | 0 |
| Integration | 535 | 44 |
| Hosted offline | 142 | 17 |
| Pinned renderer | 9 | 1 |

The full acceptance command exited 0 (`acceptance-full.log` and
`acceptance-full.status`): 556 tests in 47 suites, plus 16 portal acceptance
tests. Both complete commands reported zero failed, cancelled, skipped, or todo
cases. The native self-hosted container gate also exited 0
(`container-self-hosted.log` and `container-self-hosted.status`): 13 tests in
1 suite, with zero failed, cancelled, skipped, or todo. The manager verified the
inventory after this run. The hosted image gate exited 0 (`container-hosted.log` and
`container-hosted.status`): 9 tests, 0 suites, 9 passed, and zero failed,
cancelled, skipped, or todo, in 972,698.9655 ms. This includes rejection of an
expected failing build in a temporary copy; that build produced no final image.

The environment wrapper exited 0. `environment/restoration.ok` confirms the
three original configuration files are byte-identical, the VM has its original
4 CPU and 4 GiB settings and is stopped, and Docker uses the original `colima`
context and endpoint. `environment/gates-and-cleanup.ok` confirms all original
containers, volumes, networks, and images are preserved, with no running builds.
The manager verified 757 implementation inputs and `docs/lightpanda-runtime.md`
are unchanged. The final updates affect documentation only, outside the image
input allowlist. A fresh fetch still placed `origin/main` at the review baseline.

All required functional gates are complete. The quality exceptions below remain
retained. Ready status, Actions, owner review, and merge are tracked in PR #164;
these local results do not claim that lifecycle is complete.

## Quality review and retained findings

The quality tools did not pass. The manager reviewed the findings and retained
them with the reasons below. No source change was made only to raise a metric.

The default delta comparison could not compare this worktree with `origin/main`
(`ast-delta-1.log`, exit 1). The supported `--no-compare` option completed three
measurement passes (`ast-measure-1.log` through `ast-measure-3.log`). Each pass
reported the same seven production files below 85. Each file was inspected in
each pass with the one-call MCP command. The score limit still failed.

| Production file | File score | Reason retained |
| --- | ---: | --- |
| `src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts` | 37.3 | Existing selector and removal rules are unchanged. Splitting them only for a score would expand this contract refinement. |
| `src/page-fetch/execute-incoming-step.ts` | 47.2 | The role keeps validation, captured values, cancellation, settlement, and one trusted record together. Its runtime decisions are unchanged. |
| `src/page-fetch/execute-outgoing-step.ts` | 48.2 | The role keeps exact-URL validation and its trusted record together. Its runtime decisions are unchanged. |
| `src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts` | 50.9 | Existing sanitation, report preservation, and typed withholding remain together. Only the context and transformation names changed. |
| `src/page-fetch/fetch-page.ts` | 53.6 | The protected sequence keeps guard precedence and effect order visible. Runtime work is unchanged. |
| `src/html-cleaner-pipeline/process-html-step.ts` | 59.7 | Size, withholding, and completion checks remain at the existing incoming boundary. Only its static role and unused ID changed. |
| `src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts` | 62.0 | Existing conversion and report accumulation remain together. Only the context and transformation names changed. |

The AST review exited 1 with 3 high, 9 medium, and 3 low findings. The complete
Markdown report is the local generated `ast-report/review.md`; the captured
output is `.cache/mcp-refine/ast-review.log`. It reports no file-score drop.
The manager retains these findings:

- High: class maintainability is below 85 for `ProcessHtmlStep` (59),
  `PromptInjectionRemoverSanitizer` (50), and `HiddenHtmlRemovalSession` (63).
  The first two retain the existing validation and sanitation boundaries for
  the reasons above. `hidden-html-removal-session.ts` is unchanged in this
  candidate; its high finding concerns existing scan and withholding logic.
  A separate targeted inspection (`ast-removal-session-review.log`, exit 0)
  measured the file at 58.1, with 20 decision paths and 7 functions. Its `run`
  method has 26 lines and 6 paths. The class score of 63 above is a separate
  measure. The session remains the bounded scan, provenance, report, and
  withholding owner.
- Medium: the two community-cycle reports concern existing package groups.
  Moving the result contract or changing authentication dependencies to change
  those groups is outside this refinement. The server factory retains 30
  logical lines and 47 lines. The incoming executor file retains 28 decision
  paths; its execution function retains 21 logical lines and 32 lines. The
  outgoing executor file retains 23 decision paths.
  The fetch factory retains 31 lines. These existing sequences keep guard,
  settlement, and record ownership clear; the candidate changes no runtime logic.
- Low: outgoing coupling remains 16 for `fetch-tool.ts`, 14 for
  `mcp/fetch-tool-server.ts`, and 13 for `page-fetch/fetch-page.ts`. These
  composition and coordination roles still need their existing collaborators.
  Type-only names also count as dependencies in this tool.

Habit-hooks exited 1 with 15 findings (`habit-hooks.log`). The manager retains:

- Four test-only export findings: `readyToken` and
  `discoverHostedAuthorization` in unchanged `script/fetch-url/helper/oauth.ts`, and
  `callbackResult` and `launchBrowser` in unchanged
  `script/fetch-url/helper/browser.ts`. The functions are used internally; only their
  exports are accessed solely by tests. They concern existing CLI test access. A CLI
  entry-point or module redesign is separate work and is not hidden by a snooze.
- Nine comment findings. Three context-field comments define the distinct
  counter and finding contracts. Four compiler-proof comments state role
  constraints and include the two executable `@ts-expect-error` directives.
  The converter comment explains why a DOM BOM differs from a file BOM. The
  deep-scan test comment explains why runtime optimization permits either safe
  result. These explain contracts, compiler checks, or non-obvious reasons.
- Two file-size findings in the fetch-operation integration test and outgoing
  executor unit test. Each file covers one public behavior boundary. Mechanical
  splitting would scatter its related cases without improving that boundary.

The habit-hooks snooze file remains `[]`. The metrics baseline and rules are
unchanged. These retained findings are review exceptions, not passing tool
results.

Follow [the test gate policy](test-gate-policy.md), [test layout](../testing/test-code-layout.md),
and [ast-metrics review guide](ast-metrics-review.md). Run every changed test
locally before commit. Keep the habit-hooks snooze file empty and the metrics
baseline unchanged unless the metrics rules change.

## Review and sign-off

The manager reviewed and signs off both agents' source, test, and documentation
work, the completed functional gates, and the retained quality findings. The
selected refinements 01–04 are implemented and validated; 05 remains deferred.
The quality tools retain the explicit exceptions above and are not recorded as
passing. [PR #164](https://github.com/tomer-mayara/Thermus/pull/164) tracks Ready
status, Actions, owner review, and merge. No completed PR lifecycle is claimed.
