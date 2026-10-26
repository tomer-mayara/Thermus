# Current isolated metric review

Candidate `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d`; actual base `8c6d204e8588a664438ba8934ab36670b802525f`. Actual checkout: `/Users/tomermayara/.codex/worktrees/slice-25-stack-merge/Thermus`.

Fresh verified unit coverage measures 152 source files. All 17 required functions (9 new, 8 changed) pass: highest new CRAP 4, highest changed 7. The full JSON records each of the 60 function rows; one unchanged cleanup callback remains unmeasured. No CRAP exception or new-file MI exception is used.

The final process completes all four stages: Delta and Review retain assessed goal misses; CRAP and Architecture pass. Standalone snapshots and CRAP pass. Raw reports remain unchanged.

- src/accounts/organizations/organization-directory.ts: Type/interface contract with zero runtime paths and no raw MI. Unmeasured MI is explicit N/A, not an absent required function assessment.
- src/accounts/providers/workos/workos-organizations.ts: Keep WorkOS wire interpretation, current role mapping, management evidence, revision calculation and exact-ID deletion in one adapter. The slice adds short reader/mapping/deletion functions with at most four paths. Splitting existing invitation/member operations solely for file MI would add interfaces and expand the rebase. This also explains the 5.3725-point MI drop and native high finding.
- src/app/hosted-workos-application.ts: Keep override precedence, one provider authority/client, resource ownership and ordered cleanup in the composition root. This increment binds the raw membership reader; production path count stays 25. A lifecycle refactor would introduce unrelated risk.

Current native review has exactly two high findings, both on changed committed files:

- src/accounts/providers/workos/workos-organizations.ts: Maintainability index: 53 -> 48 (below 85 is hard to maintain). Keep WorkOS wire interpretation, current role mapping, management evidence, revision calculation and exact-ID deletion in one adapter. The slice adds short reader/mapping/deletion functions with at most four paths. Splitting existing invitation/member operations solely for file MI would add interfaces and expand the rebase. This also explains the 5.3725-point MI drop and native high finding.
- test/integration/auth/workos-connection.test.ts: Maintainability index: 41 -> 35 (below 85 is hard to maintain). Keep independent real-client request, timeout, response-body and deletion-outcome cases with the scoped wire fixture. The increment checks one DELETE for success, documented refusal, lost reply and five-second abort. Abstracting these observations would obscure the transport contract. Tests have no production MI goal.

The prior 72 ignored helper/archive findings are absent from this clean checkout; they were not fixed in production. Keep the CSS import/global graph limit and estimated base-CRAP limit. The existing base history record remains unchanged. Habit is separately fresh in c617 and its reported file blobs match this candidate. No container or live gate ran in this checkout.
