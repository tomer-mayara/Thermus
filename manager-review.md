# Manager review for PR #213

Candidate: `d5b4a051c589b55338cad9b6b002817b99fa22e3`.
Base: `9127545cb49b63ab9fab9d0952190d5bb2a87021`.

## Reviewed behavior

The classifier accepts a direct, nonblank inline question only when the card also has its standard nonblank title and destination. The existing full-page cleaning runs before result projection. Projection keeps safe question text and links; separate answers and vote widgets stay out. The strict page-origin, no-results, cancellation, and size checks remain in place. The equivalent loops keep the exact child-order and no-results checks and allow the metrics tool to identify the functions correctly.

The acceptance regression checks all 20 captured results in both editions. Unit and integration cases cover missing fields, misplaced questions, answers without a question, hidden text, ads, unsafe links, and encoded controls. The original focused failures and green verification are retained in the check evidence.

The current full-suite run found a shared sign-in limiter in the self-hosted search acceptance setup. The two search cases now use the existing real-provider issuedGrants fixture before starting the server and connect through the MCP SDK with those tokens. The scenario starts with an authorized user, so browser authorization is setup, not its asserted outcome. Both protocol eras and every discovery, result, renderer, and completion assertion remain. The focused file failed before this change and passed all eight cases after it. No production authentication code, limiter, retry, delay, or assertion changed. The manager reviewed and signed off this fix.

## Retained habit-hooks findings

The complete-candidate run exits 1 with eight reported smells. Each is reviewed below under the AGENTS.md rule that permits a recorded retention reason. The snooze file is still `[]`.

- `search-engine-brave-http.ts:92`, high complexity: the existing strict no-results classifier must check the exact provider structure, child order, and fixed labels. The loops preserve these checks and make function identity measurable. Splitting the single structural predicate during this parsing fix would add scope and risk. Focused rejection cases cover missing, extra, and reordered content; final CRAP evidence is recorded separately.
- `self-hosted-fetch-tool.test.ts:28`, comment: keep the distinction between the configured executable path and the process double. This explains why the offline case starts no real renderer.
- `self-hosted-fetch-tool.test.ts:41`, comment: keep the reason for the two host-specific ad targets. The case proves that rules use the final host, not just that one element disappears.
- `self-hosted-fetch-tool.test.ts:201`, comment: keep the reason for setting a ban without the disable command. This preserves an active session so the case tests access resolution independently of session deletion.
- `search-pipeline.test.ts`, oversized: retain the public search acceptance matrix and its shared scenario setup together. The added captured-page requirement exercises the same public operation and ownership.
- `self-hosted-fetch-tool.test.ts`, oversized: retain the existing production composition and authorization cases. This fix changes only the setup of two search cases and adds no lines to the file.
- `brave-http-result-cleanup.test.ts`, oversized: retain the focused result projection cases together. They check the same public cleanup interface, field copying, and unsafe-content behavior.
- `search-engine-brave-http.test.ts`, oversized: retain the provider classifier's positive and negative grammar cases together. The added cases cover the same interface and failure contract.

## Architecture and documentation

The manager reviewed the architecture agent's declaration against both changed production modules, the composition in `src/app/fetch-tool.ts`, and the component registry. Context, containers, components, runtime, and deployment views remain accurate. Public types, component owners, dependencies, sanitation order, cancellation, and resource ownership stay the same. No diagram changed; Mermaid validation is N/A. No lasting architecture decision is introduced.

The affected reference now describes the supported direct inline question and the tests that prove it. Its input schema, output envelope, error vocabulary, and safe organic result guarantee stay the same. It changes no enforcement or approval rule. Fixture metadata identifies the complete provider capture and separates local capture evidence from hosted success. Links in the changed reference resolve.

This manager review is not independent human approval. T1 Team review must cover the final candidate SHA before merge. The user requested review and no merge.

## Capture fidelity and whitespace

The complete-candidate `git diff --check origin/main...HEAD` reports three trailing-whitespace lines in `brave-results-inline-qa.html` (52, 76, and 77). Keep these bytes: this fixture is the complete unchanged provider capture, not authored markup. Its measured size is 396,040 bytes and SHA256 is `aef6be672fff0cc94f93555c1fb97bbb8793394738d7eadceda36a3e07ba4a5f`, which match the committed metadata. Do not reformat or trim it. No other whitespace warning was reported.

## Final metrics assessment

The final process completed all four stages. Delta and Review report goal misses; CRAP and Architecture pass. There is no failed or unavailable stage. The separate CRAP command exits 0. The final review-tier check reports T1 Team review, local eligibility eligible, and no evidence blockers.

Retain both high findings on changed production files:

- `brave-result-document.ts`: file MI is 42.599754 to 42.592124, below 85 before and after the change. The change adds one supported description selector without adding decision paths (30 before and after). Keep projection and safe field copying together for this focused correction; a broader class split would add unrelated scope. The changed `resultRow` has 97.7% coverage and CRAP 5.0.
- `search-engine-brave-http.ts`: file MI is 34.064802 to 33.048996, below 85 before and after the change. Keep the supported-card and strict no-results grammar together. Explicit loops preserve behavior and let the metrics tool identify the changed functions. The file retains 56 decision paths. `classify` moves from 9 to 10 paths and `isNoResults` from 15 to 21 because their loops now include decisions that were in callbacks. These two medium findings and the file-complexity finding are retained for that reason.

All four changed functions satisfy CRAP < 30: `isNoResults` 21.0 at 99.4% coverage, `classify` 10.0 at 100%, `isWebResult` 7.0 at 100%, and `resultRow` 5.0 at 97.7%. There is no added function and no required unknown assessment or identity. The general report's suggested target of 15 for `isNoResults` is not a missed added-function goal. No new metric exception is required. Sixty high findings are on unchanged files and are unchanged by this PR. The rules and baseline were not altered.

The full architecture report retains its limits: the same unresolved `main.ts` to `style.css` import is present at base and head; component edge/cycle changes are therefore withheld by that report. No import changes exist in this candidate, and the complete static review check found no forbidden edge, new or enlarged cycle, or undeclared fact. Broader unknown coverage identities remain in the full report. They do not concern the four required changed functions. Base CRAP uses head-derived estimates, not measured base coverage.

Coverage collection passed 2,714 backend unit and 23 portal unit tests with no failure or skipped test. It used the source and tests at `4cb6bd0a`. The only later candidate commit adds the immutable metrics history of base `9127545c`. Git object identities confirm that `src`, `test`, `script`, `package.json`, `pnpm-lock.yaml`, and `Dockerfile.hosted` match the validated candidate exactly. The final process verified and reused that compatible coverage; snapshots, CRAP, process, review, impact, and tier output name final head `d5b4a051c589b55338cad9b6b002817b99fa22e3`.

All selected executable checks and builds passed after the documented recoveries. The manager signs off the complete candidate for Ready and independent human review. Human approval and merge remain pending. Auto-merge is disabled. Colima remains running because six other containers were active after the gate removed all of its own resources.
