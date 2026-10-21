# SEARCH-07: Refuse contradictory Brave documents

Date: 2026-10-20.
Status: implementation and local test/build verification complete; quality review in progress.

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

| Check | Result |
| --- | --- |
| Both changed test files | 118 passed, zero failures. |
| `npm test` | 5,783 backend tests in 304 suites and 41 portal tests passed; zero failures, cancellations, skips, or todo cases. |
| `npm run typecheck` | Passed. |
| `npm run test:build` | 13 passed, zero failures. |
| `npm run build:user-portal` | Passed. |
| `npm run test:mcp:renderer` | All 13 fetch and search cases passed with pinned Lightpanda 1.0.0. |
| Habit-hooks | No lint errors; 136 findings retained with reasons below. The snooze file remains `[]`. |
| Document links and `git diff --check` | Passed. |

The ordinary suite used the same temporary Axiom test launcher as SEARCH-06.
It loads only the existing test key and endpoint and fixes the dataset to
`system-log-test`. No secret was copied into this worktree or printed.
The current gate logs use `/tmp/thermus-search07-` with `ordinary.log`,
`typecheck.log`, `test-build.log`, `portal-build.log`, and `renderer.log` for
the first implementation. After the helper refactor, all five checks ran
again; the final logs add `-final` before `.log`.

Fresh coverage and current quality results will be recorded after they finish.

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
