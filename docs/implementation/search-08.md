# SEARCH-08: Keep malformed errors inside the safe search boundary

Date: 2026-10-20.
Status: implementation and local test/build verification complete; quality review in progress.

This record covers [SEARCH-08](search-pipeline-plan.md#search-08-keep-malformed-errors-inside-the-safe-search-boundary)
in pull request 202. Main was fetched before this slice and remains
`063404050aaf2d8989039309afc96d0308f7b318`, the comparison base. SEARCH-09
remains open, so the pull request stays Draft.
The manager reviewed and signed off the implementation worker's source and
tests before the broader checks.

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

These test runs had zero failures, cancellations, skips, or todo cases.
Commands use pnpm with the pinned Node 24.20.0 runtime. The ordinary suite
uses the same temporary Axiom test launcher as SEARCH-07. It loads the
existing test key and endpoint and fixes the dataset to `system-log-test`.
No secret was copied into this worktree or printed.

Gate logs use `/tmp/thermus-search08-` with `ordinary.log`, `typecheck.log`,
`test-build.log`, `portal-build.log`, and `renderer.log`. The remaining results and quality
exceptions will be recorded after verification.
