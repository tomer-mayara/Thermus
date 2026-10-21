# SEARCH-09: Align proof strength and current documentation

Date: 2026-10-20 (America/Denver).
Status: implemented and locally verified; owner review and merge pending.

This record covers [SEARCH-09](search-pipeline-plan.md#search-09-align-proof-strength-and-current-documentation)
in [PR 202](https://github.com/tomer-mayara/Thermus/pull/202).
Main was fetched before this slice and remains
`063404050aaf2d8989039309afc96d0308f7b318`, the comparison base.
SEARCH-07 and SEARCH-08 retain their dated verification records.

## Change and proof ownership

Existing protected-pipeline cases now count engine calls for incoming
malformed and withholding outcomes, including no-results. Existing public
withholding cases count renderer launches in both editions. These assertions
strengthen proof of unchanged behavior; they are not new production fixes.

The live result assertion now requires a useful external Lightpanda result
link with description text in the same paragraph or the immediately following
paragraph. It does not cross another result or a section boundary. Link title
text alone is not a description. Controlled positive and negative cases
exercise the same assertion that the live gate uses. Markdown structure can
show this association; it cannot establish that every result on every unseen
page is complete or semantically correct.

The edition-by-era matrix checks public behavior and destination strings.
Captured-page integration, the video regression, and local renderer cases
check actual Markdown links and result fidelity through real cleaners. The
separate live gate proves access for its dated call. A local fixture pass does
not prove public access. Live empty-results behavior remains unverified.

The runtime guide now names the completed AMD64 rendering evidence from
RHD-03 and SEARCH-06. Their results remain tied to those candidates. This
record owns the final gates for the completed SEARCH-07–09 candidate.

## Test-first evidence

The worker first moved the existing independent title and paragraph checks
into the shared test assertion without changing their behavior. A controlled
case supplied a result without a description plus an unrelated footer
paragraph. The old assertion accepted it. The new specification failed with
`Missing expected exception`: two positive controls passed and the negative
case failed. No public request or production change was used to create this
red result.

```sh
pnpm exec npm run build
pnpm exec node --test dist/test/unit/test-support/search-results.test.js
```

Logs: `/tmp/search09-red-build.log` and `/tmp/search09-red.log`.
The call-count assertions verify existing behavior; no artificial production
failure is claimed for them.

Manager review found another ambiguous case: two result links in one
paragraph with a description for only the other result. Its controlled test
failed against the first fix: eight controls passed and one failed. The
assertion now requires exactly one link in the candidate title paragraph or
heading. The manager reviewed and signed off this change, the call counters,
and all nine controls. Logs: `/tmp/search09-ambiguous-red-build.log` and
`/tmp/search09-ambiguous-red.log`.

The final focused build passed, and all 137 selected tests passed with zero
failures, cancellations, skips, or todo cases:

```sh
pnpm exec npm run build
pnpm exec node --test dist/test/unit/test-support/search-results.test.js \
  dist/test/integration/search-pipeline/protected-search.test.js \
  dist/test/acceptance/mcp/search-pipeline.test.js
```

Logs: `/tmp/search09-ambiguous-green-build.log` and
`/tmp/search09-ambiguous-green.log`. No production file changes in this slice.

## Dated live MCP proof

The changed live proof passed on its one public request at
`2026-10-21T01:22:51.006Z` (2026-10-20 in America/Denver). It used the pinned
Lightpanda 1.0.0 executable on macOS ARM64, with checked SHA-256
`955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d`.

```sh
LIGHTPANDA_BIN=/Users/tomermayara/git/Thermus/.cache/lightpanda/1.0.0/lightpanda \
  pnpm exec npm run test:mcp:search:live
```

The command exited 0: one test passed, with zero failures, cancellations,
skips, or todo cases. The real self-hosted composition used a local Better
Auth account and access token, the Brave HTTP adapter, renderer, classifier,
cleaners, and MCP client. There was no provider double, endpoint mapping,
retry, or change to network policy.

Query: `Lightpanda browser`. One successful Markdown item held 27,132
characters and passed the stronger result/description assertion. Both stages
were allowed. One completion had status `success` and operation ID
`fbf625f4-ee04-4d32-aebf-3958129bd544`; both stages used that ID. Records
contained no query, reason, page, or URL, and no renderer error was recorded.

The [saved live result](search-09-live-result.json) retains the result and
correlated records. The command log is `/tmp/thermus-search09-live.log`.
This proves only this dated call. It does not guarantee later access, ranking,
complete results on every page, or a live empty-results response.

## Complete-candidate check selection

The complete pull request changes `src/`, although SEARCH-09 changes only
tests and documents. Select `npm test`, `npm run typecheck`,
`npm run test:build`, `npm run build:user-portal`,
`npm run test:mcp:renderer`, `npm run test:container`,
`npm run build:hosted`, and the Linux AMD64
`npm run test:container:hosted` gate. The changed live assertion also selects
one separate `npm run test:mcp:search:live` run. Do not retry a failed public
request until it happens to pass. Do not add another `npm run check`.

Hosted identity, organization operations, signup creation, and SDK retries
are unchanged, so their dedicated live gates are not selected. Their offline
contracts remain in the ordinary suite. Both complete unit parts and the
integration suite are selected, so fresh coverage may include both groups.
Run habit-hooks and the full ast-metrics process with the same base. Keep
the snooze file empty and preserve immutable metric records.

## Results

The source and test candidate is `f7516391`; later edits record evidence only.
The current results follow. All selected test and build gates passed.
Quality exceptions remain as recorded below. Owner review and merge remain
pending.

| Check | Result |
| --- | --- |
| Changed focused tests | 137 passed. |
| Final `npm test` | 5,824 backend tests in 304 suites and 41 portal tests passed on the unchanged repeat. |
| `npm run typecheck` | Passed. |
| `npm run test:build` | 13 passed. |
| `npm run build:user-portal` | Passed. |
| `npm run test:mcp:renderer` | All 13 fetch and search cases passed. |
| `npm run test:container` | All 13 cases passed without outbound access; 107.92 seconds. |
| `npm run build:hosted` | Passed: 4,029 backend unit, 23 portal unit, 13 build, 18 portal acceptance, 703 integration, 194 selected acceptance/interface, and 13 renderer tests. |
| Linux AMD64 `npm run test:container:hosted` | All 9 tests passed; 1,774.40 seconds. The final image passed runtime checks, and the deliberately failing copied build produced no runtime image. |
| Separate live Brave proof | One test passed on its single request, as recorded above. |
| Fresh unit and integration coverage | 4,029 backend unit, 23 portal unit, and 703 integration tests passed. Verified capture covers 134 files from 1,158 processes. |

These selected commands passed, with no cancellations, skips, or todo cases.
The image gate's copied negative build had one deliberate unit-test failure;
its refusal to produce an image is the required passing outcome. The positive
AMD64 build passed the same seven test phases as the hosted offline build.
Commands use pnpm with the pinned Node 24.20.0 runtime. The ordinary suite
uses the existing temporary Axiom test launcher, which loads the test key
and endpoint from the main checkout and fixes the dataset to
`system-log-test`. No secret was copied into this worktree or printed.

Gate logs use `/tmp/thermus-search09-` with `ordinary-retry.log`,
`typecheck.log`, `test-build.log`, `portal-build.log`, `renderer.log`,
`container.log`, `hosted-build.log`, `hosted-image.log`, and `coverage.log`.
The positive and negative AMD64 build logs are
`/tmp/thermus-search09-hosted-buildx.log` and
`/tmp/thermus-search09-hosted-negative-buildx.log`. The coverage capture
passed on its first attempt with fixed source, test, configuration, and build
inputs. No coverage data was edited.

The first ordinary run exited 1: 5,823 of 5,824 backend tests passed, with
one failure and no cancellations, skips, or todo cases. The existing OAuth
CLI case for pending browser cancellation reported authorization timeout
instead of cancellation. Its 150 ms timeout starts before store, metadata,
and listener preparation; the fixture sends cancellation only when browser
opening starts. This can race under load, but the retained output does not
establish which step consumed the timeout. SEARCH-09 changes none of that
path. All 15 tests in its file passed in isolation without edits. Logs:
`/tmp/thermus-search09-ordinary.log` and
`/tmp/thermus-search09-oauth-focused.log`. The failed run is not a gate pass.

## Quality review

The manager reviewed the worker's changes and the complete candidate's
quality findings. No production file changes in SEARCH-09. The production
scores and reasons retained from SEARCH-05 through SEARCH-08 still apply.
The new assertion and its controls share one test responsibility; no new
production abstraction is needed.

Habit-hooks reports no lint errors and the same 136 retained findings:
two complexity findings, one function-size finding, 120 comment lines, and
13 file-size findings. The snooze file remains `[]`. The call counters stay
in the existing scenarios, so one case proves the outcome and the absence
of repeated provider work. Earlier reasons remain in
[SEARCH-05](search-05.md#habit-hooks-review),
[SEARCH-06](search-06.md), and [SEARCH-08](search-08.md).
The pull request retains the full reasons for the complete candidate.

```sh
habit-hooks --branch 063404050aaf2d8989039309afc96d0308f7b318 --no-snooze

pnpm exec node script/code-quality/ast-metrics-coverage.ts \
  --suite unit --suite integration

PATH="$PWD/ast-report/search-02-tooling/0.43.1-search02-anonymous-fix/bin:$PATH" \
  pnpm exec node script/code-quality/ast-metrics-process.ts \
  --base 063404050aaf2d8989039309afc96d0308f7b318 --allow-tool-version
```

The complete process finished delta, review, CRAP, and architecture. It
reused verified compatible unit and integration coverage from `f7516391`.
Architecture passed. Delta, review, and CRAP retained the stated goal
exceptions, so the command exited 1. This is not an all-green quality result.
Logs: `/tmp/thermus-search09-habit-final.log` and
`/tmp/thermus-search09-metrics-final.log`.

All 14 changed production files retain scores below 85. They have the direct
file inspections and reasons recorded in the earlier tickets. The review
has 16 high, 18 medium, and seven low findings. The CRAP section has zero
measured target misses, 36 functions without a coverage match, and 67
required functions with unknown assessment or identity. Unknown values and
lower bounds are not passes. The full pull request description records
these exceptions and each reason. No tool failure is treated as an exception.

The analyzer is the local `0.43.1-search02-anonymous-fix` documented in
[SEARCH-02](search-02.md#analyzer-completeness-correction). Its checked SHA-256
is `f834fbf0587bbfff3e25da094965d2d4c0faabe49247dec30dcc74a8a13ad115`.
The correction patch has checked SHA-256
`a75412fe6c1cf3b22f8bdcdc5c55677f2abb3f4a7a07b48c2ed58b5ff502c0e6`.
The installed analyzer, rules, and baseline are unchanged.

The existing immutable records keep their checked SHA-256 values:

- `docs/metrics/2026-10-20-304cd24f.json`:
  `7191f52971a5a16eef92b641b29e75bc0a28d3861e617fa99fd95eeef8985ab4`.
- `docs/metrics/2026-10-20-06340405.json`:
  `9ee8da37d03127e9943a5f2672503258e6ef4657a5ef9a03d708fdad868836c3`.

The base record already exists; no new record is needed. The pull request
includes the final process report without changes: all four sections,
graphs, legends, import evidence, and notices. Owner review and merge remain
pending under [AGENTS.md](../../AGENTS.md#pull-requests).
