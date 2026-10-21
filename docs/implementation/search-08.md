# SEARCH-08: Keep malformed errors inside the safe search boundary

Date: 2026-10-20.
Status: implemented and reviewed; local tests and builds passed; quality exceptions recorded.

This record covers [SEARCH-08](search-pipeline-plan.md#search-08-keep-malformed-errors-inside-the-safe-search-boundary)
in pull request 202. Main was fetched before this slice and remains
`063404050aaf2d8989039309afc96d0308f7b318`, the comparison base. SEARCH-09
remains open, so the pull request stays Draft.
The manager reviewed and signed off the implementation worker's source and
tests before the broader checks.
The source and test candidate is `610251c6`; later commits record evidence only.

## Contract and change

The three search boundaries must keep errors inside their fixed failure
contract, even if reading an error's name throws. Outgoing and engine failures
return `Search failed`; incoming failures return `Search processing failed`.
Neither the original error nor its cause may expose private data. A failed
boundary starts no later stage, and each entered stage attempts one safe
record.

An aborted signal wins before error inspection. A supported `AbortError`
without an aborted signal also becomes the fixed `Request cancelled` error.
Cancellation observed during error inspection must still win. These rules
belong to one small shared check; each executor keeps its own stage outcome.

`search-cancellation.ts` now owns the predicate and its small throwing
checkpoint wrapper. The three callers use it in place of their local copies.
The check guards both `instanceof Error` and the name read, then checks the
signal again. It reads no error property when the signal is already aborted.

A hostile proxy also exposed an unguarded `instanceof WebsiteFetchFailure`
in the engine's reporting path. A narrow guard now keeps that inspection from
replacing the safe failure. Diagnostic capture still precedes reporting, and
cancellation is checked afterward. Fetch code and the reporting interfaces
are unchanged.

## Test-first evidence

The existing protected-core integration contract is the executable
specification for this defect. Before production edits, three new scenarios
failed: a throwing name getter in outgoing, engine, or incoming work exposed
`private name getter` instead of the fixed boundary message. The build passed,
and the selected run had zero passes and three expected failures.

```sh
pnpm exec npm run build
pnpm exec node --test --test-name-pattern='error whose name getter throws' \
  dist/test/integration/search-pipeline/protected-search.test.js
```

Logs: `/tmp/search08-red-build.log` and `/tmp/search08-red-protected.log`.

Before production edits, a second selection added cancellation controls,
hostile prototype inspection, and MCP dispatch through the real protected
pipeline. It had six passes and nine failures. It showed incorrect failed
stage records after getter-triggered cancellation, raw prototype errors, and
outgoing/engine completions incorrectly marked `processing_failed`.

```sh
pnpm exec node --test \
  --test-name-pattern='aborts before throwing a hostile|error name getter aborts|throws a proxy whose prototype|protected search .* unreadable name' \
  dist/test/integration/search-pipeline/protected-search.test.js \
  dist/test/integration/mcp/fetch-tool-server.test.js
```

Logs: `/tmp/search08-controls-red-build.log` and
`/tmp/search08-controls-red.log`. With the shared helper in place, the engine
reporting escape still failed in `/tmp/search08-helper-test.log`; the narrow
reporting guard fixed it. That intermediate run also found three incorrect
test expectations that omitted the existing record `event` field. Correcting
those expectations was not a product fix.

The new helper unit tests were written after the integration specifications
failed and alongside the helper implementation. No independent unit-red run
is claimed. They cover ordinary errors, real abort errors, unreadable names,
hostile prototypes, and cancellation before and during inspection.

The final focused command passed all 234 tests, with zero failures,
cancellations, skips, or todo cases:

```sh
pnpm exec npm run build
pnpm exec node --test 'dist/test/unit/search-pipeline/*.test.js' \
  'dist/test/integration/search-pipeline/*.test.js' \
  dist/test/integration/mcp/fetch-tool-server.test.js
```

Logs: `/tmp/search08-final-build.log` and `/tmp/search08-final-test.log`.
The new core cases check fixed errors without private causes, exact entered
stage records, and calls through the failing boundary only. MCP cases use the
real pipeline with failed loggers and check one operation, one correlated
completion, correct status, and private records. Existing direct malformed
operation tests still prove the dispatcher's separate safe fallback.

## Check selection

The complete candidate changes `src/`. This slice selects the changed focused
tests, full ordinary suite, typecheck, build tests, portal build, pinned local
renderer gate, fresh unit and integration coverage, habit-hooks, and the
complete ast-metrics process. Do not add another `npm run check`.

The test gate policy requires complete-candidate qualification before Ready.
The self-hosted container, hosted offline build, and Linux AMD64 hosted image
gates remain outstanding for the completed SEARCH-07–09 candidate. The earlier
passes in SEARCH-06 and SEARCH-07 remain evidence for their own source and
test inputs; they do not qualify the changed pipeline.

SEARCH-08 needs no public Brave request. SEARCH-09 owns the changed live
assertion and its separate live proof. Live empty-results behavior remains
unverified. Hosted identity and signup live gates are not selected because
their production behavior is unchanged.

## Results

| Check | Result |
| --- | --- |
| Focused search-pipeline and MCP dispatcher tests | 234 passed. |
| `npm test` | 5,815 backend tests in 304 suites and 41 portal tests passed. |
| `npm run typecheck` | Passed. |
| `npm run test:build` | 13 passed. |
| `npm run build:user-portal` | Passed. |
| `npm run test:mcp:renderer` | All 13 fetch and search cases passed with pinned Lightpanda 1.0.0. |
| Fresh unit and integration coverage | 4,020 backend unit, 23 portal unit, and 703 integration tests passed. Verified capture covers 134 files from 1,156 processes. |
| Habit-hooks | No lint errors; 136 findings retained with reasons below. The snooze file remains `[]`. |
| Full ast-metrics process | All four sections completed. Architecture passed; delta, review, and CRAP retain the exceptions below. |

These test runs had zero failures, cancellations, skips, or todo cases.
Commands use pnpm with the pinned Node 24.20.0 runtime. The ordinary suite
uses the same temporary Axiom test launcher as SEARCH-07. It loads the
existing test key and endpoint and fixes the dataset to `system-log-test`.
No secret was copied into this worktree or printed.

Gate logs use `/tmp/thermus-search08-` with `ordinary.log`, `typecheck.log`,
`test-build.log`, `portal-build.log`, and `renderer.log`.

The first coverage capture passed all unit tests, but the collector refused
duplicate shutdown evidence for one process. It exited 1 and preserved the
older report. That capture is unverified and is not used. A fresh capture of
the unchanged inputs passed both suites and wrote a verified report for
`610251c6`. No source or collector was changed, and no coverage data was edited.
The cause of the duplicate evidence was not established. Logs:
`/tmp/thermus-search08-coverage.log` and
`/tmp/thermus-search08-coverage-retry.log`.

## Habit-hooks review

The complete-candidate run reports the same 136 findings as SEARCH-07:
two complexity findings, one function-size finding, 120 comment lines, and
13 file-size findings. Their reasons remain in
[SEARCH-07](search-07.md#habit-hooks-review),
[SEARCH-06](search-06.md#habit-hooks-review), and
[SEARCH-05](search-05.md#habit-hooks-review), and in the pull request.

The existing protected-search and dispatcher files grew with the new cases.
Each still owns one public contract and its independent negative cases.
The new tests check fixed errors, cancellation, stage records, completion,
and privacy at those boundaries. Splitting by line count would not separate
another responsibility. No new shared fixture or test framework is needed.

```sh
habit-hooks --branch 063404050aaf2d8989039309afc96d0308f7b318 --no-snooze
```

Log: `/tmp/thermus-search08-habit.log`. Exit 1 records the retained findings.
The snooze file stays empty.

## Code quality review

All comparisons use `063404050aaf2d8989039309afc96d0308f7b318`.
The process completed delta, review, CRAP, and architecture with verified
compatible unit and integration coverage. It exits 1 for retained goals,
not a tool failure. There are 14 production files below 85, 16 high review
findings, 18 medium findings, and seven low findings. There are no measured
CRAP target misses, but 36 functions have no coverage match and 67 required
functions have unknown assessment or identity. These unknowns are not passes.

All four production files changed in this slice were inspected with
`ast-metrics-mcp.ts file`. Keep their file-score exceptions:

| File | Score | Reason |
| --- | --- | --- |
| `src/search-pipeline/search-cancellation.ts` | 70.4 | One short check guards error inspection and checks cancellation before and after it. The small wrapper gives checkpoints the same rule. Splitting the check would hide this order. |
| `src/search-pipeline/search-pipeline.ts` | 43.3 | One owner keeps validation, stage order, cancellation, and final release together. The narrow renderer-report guard preserves the fixed failure. |
| `src/search-pipeline/execute-outgoing-step.ts` | 48.4 | Exact query checks, refusal, cancellation, and one terminal record belong to the same outgoing stage. |
| `src/search-pipeline/execute-incoming-step.ts` | 47.1 | Validation, typed withholding, cancellation, and one terminal record belong to the same incoming stage. |

The ten other production files keep their earlier inspections and reasons
in SEARCH-05 through SEARCH-07 and the pull request. The 16 high findings
keep their recorded reasons. The dispatcher test score is now 16 instead of
20; its new cases use the real protected pipeline to prove safe completion
at the MCP boundary. They belong with its existing dispatch contract.

The new low finding is incoming-step coupling at 11; pipeline coupling is
now 18. One import replaces the duplicated cancellation checks. Retain that
dependency so all three boundaries apply the same rule. No new stage or
dispatch abstraction is needed.

| Function changed in this slice | Paths | Coverage | CRAP | Classification |
| --- | --- | --- | --- | --- |
| `isSearchCancelled` | 5 | 100% | 5.0 | Unknown identity. |
| `throwIfSearchCancelled` | 2 | 100% | 2.0 | Unknown identity. |
| `executeOutgoingStep` | 5 | 99.6% | 5.0 | Unknown identity. |
| `executeIncomingStep` | 8 | 99.7% | 8.0 | Unknown identity. |
| `SearchPipeline.search` | 5 | 100% | 5.0 | Unknown identity. |
| `SearchPipeline.searchDocument` | 5 | 100% | 5.0 | Unknown identity. |

Each measured value meets both numeric targets. The analyzer cannot establish
declaration identity against the base, so each unknown classification stays
in the report. The two new functions are covered by direct unit cases and the
real pipeline regressions; those tests do not repair missing analyzer identity
evidence. All other unknown rows keep the reasons in the pull request, with
their paths, coverage, and score or lower bound in the unedited report.

```sh
pnpm exec node script/code-quality/ast-metrics-coverage.ts \
  --suite unit --suite integration

PATH="$PWD/ast-report/search-02-tooling/0.43.1-search02-anonymous-fix/bin:$PATH" \
  pnpm exec node script/code-quality/ast-metrics-process.ts \
  --base 063404050aaf2d8989039309afc96d0308f7b318 --allow-tool-version
```

The analyzer and patch retain their checked SEARCH-07 hashes. Rules, baseline,
and immutable records `2026-10-20-304cd24f.json` and
`2026-10-20-06340405.json` are unchanged. The base record already exists, so
no new record is needed. The pull request keeps the complete, unedited final
process report, including all sections, graphs, legends, and import evidence.
The final process runs again after this evidence update is committed.
