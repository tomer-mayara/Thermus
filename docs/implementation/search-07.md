# SEARCH-07: Refuse contradictory Brave documents

Date: 2026-10-20.
Status: implementation and local verification complete; SEARCH-08 and SEARCH-09 remain open.

This record covers [SEARCH-07](search-pipeline-plan.md#search-07-refuse-contradictory-brave-documents)
in pull request 202. The comparison base remains
`063404050aaf2d8989039309afc96d0308f7b318`. The manager reviewed and signed off
the implementation worker's source and tests. SEARCH-08 and SEARCH-09 remain
open, so the pull request stays Draft.

## Change

The old classifier could return `no_results` when the full page contained
another known results section, banner, or result marker outside the search
root. It checked only the subtree under `main#search-page`.

The provider now counts results sections and banners across the document.
It requires the sole results section to be inside the sole search root.
The strict no-results grammar still requires the banner in its supported
fallback wrapper. Before it reports absence, the provider checks known
result markers across the document too.

Generic `data-type` attributes retain their existing check inside the search
root. Extending that broad selector to the whole page would reject unrelated
footer data. Positive controls therefore include ordinary footer links and
generic data attributes for both supported results and no-results pages.

The original full page remains the returned object. Query encoding, final URL
checks, HTML size and depth bounds, cancellation, captured generic and video
card formats, and incoming cleaners stay unchanged. No new class, helper,
endpoint, public request, or production option was added.

## Test-first evidence

All commands used the pinned Node 24.20.0 runtime through pnpm.

1. Added public acceptance cases for a duplicate section, second banner,
   and Brave result card outside the main, in both server editions.
   After `npm run build`, the focused emitted acceptance command failed all
   six cases: actual text was `No search results.` instead of `Search failed`.
   No production change existed at that point.
2. Added provider cases for duplicate and misplaced sections and banners,
   six known result markers outside the main, and valid footer controls.
   After a build, the complete provider file had 86 passes and ten expected
   failures before the classifier changed.
3. Applied the narrow scope and containment correction. A build and both
   complete changed test files passed: 118 tests, zero failures.
4. Simplified the no-results helper to three parameters and one selector.
   The existing passing cases cover both selector scopes. The build and all
   118 tests passed again; no new behavior or artificial red step was needed.

The focused green command was:

```sh
pnpm exec npm run build
pnpm exec node --test dist/test/unit/search-engine/search-engine-brave-http.test.js dist/test/acceptance/mcp/search-pipeline.test.js
```

The public cases check the fixed error, one renderer launch, no incoming
stage, one correlated safe completion, and absence of private query, reason,
page, and conflicting-result text in records. Existing full-page fidelity
cases remain in the same selection. Local logs are
`/tmp/search07-acceptance-red.log`, `/tmp/search07-unit-red.log`, and
`/tmp/search07-green.log`. The final refactor logs are
`/tmp/search07-refactor-build.log` and `/tmp/search07-refactor-green.log`.

## Check selection

The cumulative candidate changes `src/`. This slice runs the full ordinary
suite, typecheck, build tests, portal build, pinned local renderer gate,
fresh unit and integration coverage, habit-hooks, and the complete metrics
process. No extra `npm run check` is selected.

The test gate policy requires complete-candidate qualification before Ready.
The self-hosted container, hosted offline build, and Linux AMD64 hosted image
gates remain outstanding for the completed SEARCH-07–09 candidate. The
SEARCH-06 runs are historical evidence for `85817282`; they are not current
passes after this production change. The pull request stays Draft meanwhile.

SEARCH-07 needs no new public Brave request. The changed live assertion and
its separate live proof belong to SEARCH-09. The original live empty-results
limit remains explicit. Hosted identity and signup live gates are not selected
because their production behavior is unchanged.

## Results

The source and test candidate is `6515fa3a`. Later document edits record
evidence only. The ordinary suite, typecheck, build tests, portal build, and
renderer gate all ran again after the helper refactor.

| Check | Result |
| --- | --- |
| Both changed test files | 118 passed, zero failures. |
| `npm test` | 5,783 backend tests in 304 suites and 41 portal tests passed; zero failures, cancellations, skips, or todo cases. |
| `npm run typecheck` | Passed. |
| `npm run test:build` | 13 passed, zero failures. |
| `npm run build:user-portal` | Passed. |
| `npm run test:mcp:renderer` | All 13 fetch and search cases passed with pinned Lightpanda 1.0.0. |
| Fresh unit and integration coverage | 4,006 backend unit, 23 portal unit, and 685 integration tests passed. Verified capture covers 133 files from 1,154 processes. |
| Habit-hooks | No lint errors; 136 findings retained with reasons below. The snooze file remains `[]`. |
| Full ast-metrics process | All four sections completed. Architecture passed; delta, review, and CRAP retain the stated exceptions. |
| Document links and `git diff --check` | Passed. |

The ordinary suite used the same temporary Axiom test launcher as SEARCH-06.
It loads only the existing test key and endpoint and fixes the dataset to
`system-log-test`. No secret was copied into this worktree or printed.
The final gate logs use `/tmp/thermus-search07-` with `ordinary-final.log`,
`typecheck-final.log`, `test-build-final.log`, `portal-build-final.log`, and
`renderer-final.log`.

## Habit-hooks review

The final complete-candidate run has two complexity findings, one function-size
finding, 120 comment lines, and 13 file-size findings. It exits 1 for these
retained findings. Its log is `/tmp/thermus-search07-habit-final.log`.

The first implementation added an unnecessary fourth parameter to
`isNoResults`. One selector can express both the document-wide known markers
and the search-root data attributes. The final helper takes three parameters;
the parameter finding is gone.

Keep the existing 135 findings for the reasons in
[SEARCH-06](search-06.md#habit-hooks-review) and
[SEARCH-05](search-05.md#habit-hooks-review). The no-results helper changed
in this slice. Its strict absence grammar still has one purpose: a partial
banner or conflicting result must never become a no-results response.

The added file-size finding is `test/acceptance/mcp/search-pipeline.test.ts`.
Keep the public tool contract, edition matrix, and new refusal cases with the
existing protocol driver. Each new case checks call count, stage outcome,
completion, and privacy together. A split at the line limit would not create
a separate test responsibility.

## Code quality review

The full process used the fixed base above and the fresh verified unit and
integration capture at `6515fa3a`. It completed all four sections. Delta,
review, and CRAP exit with retained goal exceptions; architecture passes.
This is not an all-green quality result. There was no tool failure.

There are 13 production files below the maintainability goal, 16 high review
findings, 18 medium findings, and six low findings. The unchanged files and
findings retain their direct inspections and reasons in
[SEARCH-06](search-06.md#code-quality-review). These current details supersede
the provider and changed-test scores in that historical record:

| File or function | Current assessment | Reason or result |
| --- | --- | --- |
| `src/search-engine/search-engine-brave-http.ts` | File score 34.1; 56 paths across 12 functions. | Directly inspected again. One provider owns the fixed request, bounds, destination, and supported DOM grammar. Keep these strict refusals together. The one extra path requires the sole section to be inside the sole root. |
| `SearchEngineBraveHttp.classify` | Changed; nine paths; 100% measured coverage; CRAP 9.0. | Meets the changed-function goal. Global counts and one containment check express the document rule directly. |
| `SearchEngineBraveHttp.isNoResults` | Changed; 15 paths; 100% measured coverage; CRAP 15.0. | Meets the changed-function goal. One selector keeps the two marker scopes explicit. Retain the strict absence grammar; a generic validator or extra helper would hide its accepted shape. |
| `SearchEngineBraveHttp.isWebResult` | Changed earlier in this PR; seven paths; 100% measured coverage; CRAP 7.0. | Meets the goal. SEARCH-07 leaves its body unchanged. |
| `test/acceptance/mcp/search-pipeline.test.ts` | File score 26.1; high regression reported as 55 to 26. | The same public contract owns both editions, full-page fidelity, safe failures, and private completion. The six new cases prove the externally visible fix; keep their outcomes together. |
| `test/unit/search-engine/search-engine-brave-http.test.ts` | File score 24.9; new high regression reported as 30 to 25. | The new matrices cover known containers, markers, and valid footer controls through one provider interface. Each case is independent. A split or fixture abstraction only to improve a score would add navigation. |

There are zero measured function target misses, 36 functions without a
coverage match, and 68 required functions with unknown assessment or identity.
Those unknown rows and their per-row reasons are unchanged from SEARCH-06.
The five unnamed provider callbacks retain one or three paths, unknown
identity and coverage, and lower bounds of at least one or three. Their bodies
are unchanged by this PR. Passing tests do not establish a missing analyzer
match, and no coverage data was edited or inferred.

The analyzer remains the documented `0.43.1-search02-anonymous-fix` from
[SEARCH-02](search-02.md#analyzer-completeness-correction). Its binary and
correction-patch hashes still match SEARCH-06. Rules and baseline are unchanged.
Both existing immutable metric records keep their checked hashes; no new base
record is needed.

```sh
pnpm exec node script/code-quality/ast-metrics-coverage.ts \
  --suite unit --suite integration

PATH="$PWD/ast-report/search-02-tooling/0.43.1-search02-anonymous-fix/bin:$PATH" \
  pnpm exec node script/code-quality/ast-metrics-process.ts \
  --base 063404050aaf2d8989039309afc96d0308f7b318 --allow-tool-version
```

Logs are `/tmp/thermus-search07-coverage.log`,
`/tmp/thermus-search07-metrics.log`, and
`/tmp/thermus-search07-provider-metrics.log`. After this evidence update is
committed, the process runs again on the complete candidate. The PR body gets
that final report unchanged, including all four sections, graphs, legends,
import evidence, and notices. The final process log is
`/tmp/thermus-search07-metrics-final.log`.
