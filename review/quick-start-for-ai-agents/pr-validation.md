## Validation

Candidate: [`8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0`](https://github.com/tomer-mayara/Thermus/commit/8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0).
Trusted main merge base: [`21458b0d18cc4f9efd3a59f6361a86f1acdc317c`](https://github.com/tomer-mayara/Thermus/commit/21458b0d18cc4f9efd3a59f6361a86f1acdc317c).
The final commit adds only `docs/metrics/2026-10-28-21458b0d.json` after source
candidate `b0ec502e8a7362bd03d82012b80362f7960c4430`. Runtime/test/build inputs
remain frozen. Final input comparisons and manager sign-off are complete.

**All selected pre-merge checks passed; the candidate was approved for Ready and merge.**
[Final manager sign-off](./manager-review.md) includes the actual
image retry outcome, source review, and frozen-input comparisons.

Selection: web source changes select the ordinary suite, typecheck, portal
build, self-hosted container, hosted offline build, and Linux AMD64 hosted image
gate. Focused content/page/copy/acceptance and existing browser cases provide
fresh exact-text/reflow evidence. All results below belong to this increment.

| Check | Result | Evidence |
| --- | --- | --- |
| Focused content/page/copy/composed acceptance | Pass: 14/14; zero failure/cancellation/skip/todo | [log](./focused.log), [notes](./validation-notes.md) |
| Quick start Chromium, JavaScript on/off | Pass: 2/2; zero failure/cancellation/skip/todo | [log](./browser.log), [390px image](./ui/quick-start-390.png) |
| `npm test` | Pass, exit 0: 5,685 Node and 60 portal tests, all pass; zero failure/cancellation/skip/todo | [JSON](./npm-test.json), [log](./npm-test.log) |
| `npm run typecheck` | Pass, exit 0 | [JSON](./typecheck.json), [log](./typecheck.log) |
| `npm run build:user-portal` | Pass, exit 0 | [JSON](./portal-build.json), [log](./portal-build.log) |
| `npm run test:container` | Pass, exit 0: 11/11; zero failure/cancellation/skip/todo | [JSON](./environment-gates/01-self-hosted-container.json), [log](./environment-gates/01-self-hosted-container.log) |
| Native `npm run build:hosted` | Pass, exit 0: 3,693 + 39 + 21 + 1,219 + 189 + 13 = 5,174 emitted tests; all pass, no failure/cancellation/skip/todo. Separate groups are not unique scenarios. | [JSON](./environment-gates/02-build-hosted.json), [log](./environment-gates/02-build-hosted.log) |
| AMD64 `npm run test:container:hosted`, attempt 1 | Fail, exit 1: outer gate 1 test, 0 pass, 1 fail; no cancellation/skip/todo. Inner build stopped before final runtime proofs. | [original JSON](./environment-gates/attempt-1/03-hosted-container.json), [failure record](./environment-gates/attempt-1/03-hosted-container-failure.md), [full build](./environment-gates/attempt-1/03-hosted-container-build-progress.log) |
| AMD64 full unchanged retry, attempt 2 | Pass, exit 0: 7/7 final image cases, zero failures/cancellations/skips/todos; all inner hosted checks also passed | [JSON](./environment-gates/03-hosted-container-attempt-2.json), [log](./environment-gates/03-hosted-container-attempt-2.log), [summary](./environment-gates/03-hosted-container-summary.md) |
| Unit + integration coverage | Pass, exit 0; verified capture, 241 files and 813 processes | [command](./coverage-command.json), [log](./coverage-command.log), [coverage](./coverage.json) |
| Final process/review/CRAP | Completed: Delta goal miss; Review/CRAP/Architecture pass. Process exit 1 is the retained unchanged MI goal miss. | [process](./process.json), [command](./process-final-command.json), [CRAP](./crap.json) |
| Habit-hooks | Pass, exit 0, no findings; snooze `[]` | [command](./habit-hooks-command.json), [log](./habit-hooks-command.log) |
| Final committed-candidate checker | T0 Auto merge; preliminary eligible, blockers `[]`; 53 public modules, zero changed snapshots | [JSON](./checker.json), [stderr](./checker.log); scope limit below |

### Image failure and authorized retry

Attempt 1 failed at `Dockerfile.hosted:52` in its unchanged offline build. The
first unit/portal groups passed 3,693 + 39 + 21. Integration reported 1,218 pass
and one failure: `workos-provider-verification.test.ts:233–236`, a refused-loopback
AuthKit JWKS request with a 100ms timeout, expected `TypeError` but returned
`JWKSTimeout`; the case elapsed about 432ms. Hosted acceptance, renderer, and
final image runtime proofs were not reached in that first attempt.

A transport-vs-timeout race under emulated/shared load is a possible explanation,
not a proven root cause. The copy change does not touch this code. The manager
read the source and authorized one full unchanged retry after heavy primary
jobs completed. No source, Dockerfile, assertion, deadline, or environment rule
was changed to bypass the failure. Original `03*` artifacts and the versioned
[attempt-1 records](./environment-gates/attempt-1/03-hosted-container.json)
are retained. Attempt 2 passed the full unchanged gate: 3,693 + 39 + 21 + 1,219
+ 189 + 13 inner checks and 7 final runtime cases. The exact refused-port case
passed in 12.433833 ms with the same 100 ms limit. This supports the timing-race
inference without proving a universal cause. There was no further retry.

### Provenance and tooling recovery

The ordinary suite started at base HEAD with the frozen source/guide overlay.
[Source freeze](./source-freeze.json) pins shared content SHA-256
`e90e4ec93542c04ef770409faa84c54a1f350e57619b8972c5688d30f2e28ab9` and guide
`0c3220c3e928bf32f996711b6fe399c0a1e4c6810ab049b7efe67512a500ea1b`.
Native gates compared 754 tracked runtime/test/build/guide inputs with `b0ec502e`;
all matched, and the isolated checkout was archived. The retained
[comparison](./environment-gates/native-provisional-candidate-comparison.json)
binds those original runs to the source candidate, not a rewritten final run
identity. The final commit differs only by the generated immutable metric
record. The manager's [final input binding](./final-input-binding.json)
now confirms all 754 frozen inputs at the final candidate. The
[initial manager review](./manager-review-initial.md) records
implementation review and the then-pending image hold. The later
[final sign-off](./manager-review.md) resolves that hold using the
[final image comparison](./environment-gates/03-hosted-container-final-comparison.json).

Coverage remains captured at `b0ec502e8a7362bd03d82012b80362f7960c4430`, with
status `verified`, suites unit + integration, Node 24.20.0, TypeScript 7.0.2,
and measurement `own-characters-1`. Source fingerprint:
`cb976e59626ce670ffc2271d65164be04bc9dff30ed404172f6e52979a1ae857`.
Input fingerprint:
`14a19dd48dcb1de251bc2acd827b5578df051af886a188d735c21bf1fe24e125`.
The final-head process accepts compatibility. Coverage was not restamped or
edited to claim another capture commit. Capture tests passed 3,693 Node unit,
39 portal unit, and 1,219 integration cases. This does not claim browser-string
programs or all client behavior are numerically covered.

The initial base-snapshot command exited 0, but its wrapper overwrote the data
path with exit metadata. The manager retained [initial metadata](./snapshot-base-command.initial.json)
and reran with distinct metadata/data paths, producing the valid
[base snapshot](./snapshot-base.json); the rerun exited 0.
See [rerun metadata](./snapshot-base-command.json) and
[log](./snapshot-base-command.log). This is tooling-data recovery,
separate from the real AMD64 test failure and authorized retry above.

Checker stderr says it ignored 33 compiler errors in two files outside
`public_surface`. Its declaration result therefore proves the listed surface,
not a universal absence of compiler diagnostics. The separate full repository
`npm run typecheck` passed. The warning is retained, not claimed resolved.

### N/A and verification limits

Hosted-live is N/A: no authentication/WorkOS behavior or live helper changes.
Whole Members browser, separate renderer/Brave, SQL, Collector, and Render
interface gates are N/A because their listed behavior and consuming files do
not change. No separate `npm run check` is added; ordinary source checks cover
its stages, while selected `build:hosted` keeps its nested checks. This is not
a self-hosted evaluation-image release or image-runtime cutover.

Fresh browser/manual evidence verifies exact title/paragraph, canonical copy
parity, the retained Markdown heading suffix, keyboard behavior, and reflow at
320px/390px/1024px. The 390px and 1024px screenshots were inspected. See
[manual checks](./manual-check.log) and
[artifact patch](./artifact/change.patch). Controlled clipboard
hooks do not prove native host permission.

The existing production browser was denied Quick start access and offered one
already-selected organization. No role, membership, credential, or selection
changed; its temporary tab was closed. Positive production Admin UI remains
unverified. Access remains unchanged. The
[access-limit record](./browser-access-limit.md) remains material.
The completed deployment verification below binds the merged SHA/deployment
ID, health, and public access readback.

Earlier report sources remain in
[pre-final report history](./history/before-final-8eb8d345/pr-validation.md).
Keep this same maintained Validation comment and retain failure/retry and final
manager history as results arrive.

### Deployment verification after merge

The eligible candidate was merged once as `b0723a0a03eb2408bd1b8aeda6646a0f7c77f8d1`. Candidate and merge trees are identical. Render deployment `dep-dbh91hmc6qcc73endk40` became **live at 2026-10-29 00:21:34 UTC** on that exact revision. Health GET/HEAD, portal/assets, signed-out guide/MCP access checks, and one authenticated page fetch passed. The bounded post-deploy error/fatal query was empty. [Deployment report](./deployment/README.md), [HTTP results](./deployment/public-after.json), [source identity](./deployment/source-identity.json).

The supplemental MCP title assertion expected a heading absent from the successful Markdown result. Inspection verified the actual page body and IANA reference; there was no repeat request or service error. The initial assertion is retained. Positive production Admin UI remains outside the available browser permissions. The separate [GitHub image run](https://github.com/tomer-mayara/Thermus/actions/runs/40793133570) could not start because GitHub reports failed account payments or a spending limit. Render's Git-backed build completed independently. No billing, role, or deployment mode changed.
