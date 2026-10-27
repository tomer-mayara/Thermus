## Validation

Candidate: `4a761fecf5ed1719959d286f104ecd3884068478`. Actual base/main and merge base: `2b3ad13b9e2e61e206479b82e91359192cae1d00`.

**Required Linux AMD64 hosted-image gate remains failed; no current runtime-image cases ran.** The local checker is mechanically eligible, but the overall candidate is blocked by that gate and required human approval.

[Full evidence](EVIDENCE_ROOT/README.md) · [all command results/counts](EVIDENCE_ROOT/review/result-count-index.json) · [execution summary](EVIDENCE_ROOT/validation/evidence-summary.json).

| Selected check | Result and exact provenance |
| --- | --- |
| `npm test` | Exit 0: 5,153 emitted tests and 49 portal tests passed; zero failed/skipped/todo in both groups. Run at `7acd90d44e90769e335c4b2f095d3791d82dc3d4` against `9a3ac1f9763b9d8927ec2d1d5cd4527982d33619`; rebound through the input comparisons below. [Log](EVIDENCE_ROOT/validation/npm-test.log) |
| Typecheck | Exit 0, including a fresh repeat at `639827bcf410d325d25bbf77582c4d0c32ff3c29`; all relevant inputs match final head. [Final log](EVIDENCE_ROOT/validation/final-typecheck.log) |
| Portal build and browser server build | Both exit 0. [Portal](EVIDENCE_ROOT/validation/portal-build.log), [server](EVIDENCE_ROOT/validation/members-browser-build.log) |
| Members browser | Exit 0: 7/7; zero failed/skipped/todo. Explicit JavaScript/width matrix, keyboard/focus, enlarged text and Audit tablet regression. [Log](EVIDENCE_ROOT/validation/members-browser.log), [screenshots](EVIDENCE_ROOT/validation/browser-evidence/) |
| Self-hosted container | Exit 0: 11/11; zero failed/skipped/todo. [Log](EVIDENCE_ROOT/validation/self-hosted-container.log) |
| Hosted offline build | Initial exit 1: 1,155/1,159 integration cases passed, four bind failures while another owned gate held loopback port 46443. Full retry exit 0: 3,319 unit + 29 portal unit + 20 remaining portal + 1,159 integration + 123 acceptance/interface + 13 renderer cases; zero failed/skipped/todo in each reported group. [Failure](EVIDENCE_ROOT/validation/hosted-offline.log), [full retry](EVIDENCE_ROOT/validation/hosted-offline-retry.log) |
| Linux AMD64 hosted image | Three gate attempts exit 1; none establishes a passing image or runtime cases. First nested build timed out; retry was interrupted (build exit 130); final build stalled in integration and the manager stopped only its verified owned child. [First](EVIDENCE_ROOT/validation/hosted-amd64-image.log), [retry](EVIDENCE_ROOT/validation/hosted-amd64-image-retry.log), [final](EVIDENCE_ROOT/validation/final-hosted-amd64-image.log), [settlement](EVIDENCE_ROOT/validation/final-build-settlement.json) |
| Verified integration coverage | Exit 0: 1,159/1,159, zero failed/skipped/todo, captured at `639827bc`; native compatibility accepted at final head. [Capture](EVIDENCE_ROOT/validation/coverage.log), [normalized coverage](EVIDENCE_ROOT/ast-report/coverage.json), [final CRAP](EVIDENCE_ROOT/ast-report/crap.json) |
| Final snapshots/API/checker | Exit 0; checker pins final head/base. API verifies all 49 snapshots. [Results](EVIDENCE_ROOT/review/result-count-index.json), [checker](EVIDENCE_ROOT/ast-report/check.json) |
| Final quality process/habit-hooks | Process exit 1 for retained Delta/Review goal misses; CRAP and Architecture pass. Habit-hooks exit 0 with two retained comment findings. Full reasons in Quality review. |

Functional reuse is a rebind, not a new execution: [original context](EVIDENCE_ROOT/validation/validation-context.json), [original inputs](EVIDENCE_ROOT/validation/source-test-inputs.json), [main/rebase comparison](EVIDENCE_ROOT/validation/final-revision-comparison.json), [input hash delta](EVIDENCE_ROOT/validation/final-input-hash-delta.json) and [639827bc→4a761fec equivalence](EVIDENCE_ROOT/validation/4a761fec-input-equivalence.json). Source/test, manifests, lockfile and build inputs are unchanged; main added probe scripts and its Knip entry, so fresh tooling/typecheck and coverage compatibility are recorded separately. Final update changes only the UI-01 document and immutable metric record. Node 24.20.0; capture compiler TypeScript 7.0.2; integration coverage uses verified identities/fingerprints. Raw V8 captures are omitted from the bundle; capture manifests and normalized verification evidence remain.

Detached metrics with head equal to base are invalid and archived under [discarded evidence](EVIDENCE_ROOT/validation/invalid-detached-ast-report/). Only stable-branch final reports at `4a761fec/2b3ad13b` support the candidate. Logs retain earlier attempts; none is relabelled as passing.

Hosted-live, PostgreSQL, Collector, search-live and separate Axiom-live are not selected by this increment's source or support consumers. The passing hosted offline run includes both renderer files; no extra renderer run is needed. No production release or fixture gate is implied.

Original feature red/green, tablet regression and focused checks remain [historical immutable evidence](https://github.com/tomer-mayara/Thermus/blob/4c4b5e15e4203548da6977fc0636334ef8fb8af4/review-evidence/ui-01/a017020ebe2448f5de6cc7d9cbb0700367fc80b1/README.md). [Prior PR bodies](EVIDENCE_ROOT/review/pr-before-263.json) preserve prior evidence and approval history; old results do not prove this candidate. Credential scan and file hashes are in the bundle index. Manager source, architecture and quality evidence review is complete for this head/base; required final gate verification and independent current-head human approval remain pending.
