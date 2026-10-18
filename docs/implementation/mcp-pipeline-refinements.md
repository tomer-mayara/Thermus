# MCP pipeline refinements

Status: implementation in progress in draft PR #164. Date: 2026-10-18.
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

The manager reviewed the source and test diff and accepted the implementation
handoff. Complete-candidate gates, environment checks, and quality review remain
pending. The manager will add their actual results and any retained findings
with reasons. The focused passes above do not replace those gates.

Follow [the test gate policy](test-gate-policy.md), [test layout](../testing/test-code-layout.md),
and [ast-metrics review guide](ast-metrics-review.md). Run every changed test
locally before commit. Keep the habit-hooks snooze file empty and the metrics
baseline unchanged unless the metrics rules change.

## Review and sign-off

The manager reviewed the source and test diff. Complete-candidate sign-off,
Ready status, Actions results, and owner review are pending. The manager owns PR #164 and the final gates. This
record does not authorize a merge or claim implementation completion.
