## Validation

Candidate: `076e661d830b969bf233522e1163c22cd1934361`.
Actual stack parent/merge base: `0530dd634fe8302b55d4a0669463ef733199cc40`.
Fresh main: `581f30cfaa32b01399422b087b0f0bdc3b800f70`; actual full-stack
main merge base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.

All selected behavioral gates passed. Selection covers the complete source
candidate against the main merge base, including inherited Slice 2.5 source;
architecture/tier comparison uses the actual parent. See the
[selection](review/test-selection.md) and [command/exit ledger](review/gate-ledger.json).
Node is 24.20.0 and pnpm is 12.10.1. The [GitHub check observation](pr-history/final-ci-observation.json)
returned no remote checks or statuses for this exact head; no CI pass is inferred. The final parent-bound checker has no local blockers; required human review and
the unmerged parent stack still block overall merge readiness.

| Selected check | Final result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Exit 0 | [Install](checks/install-1.log) |
| Public declaration generation | Exit 0 | [API surface](checks/api-surface-1.log) |
| `npm test`, final run 2 | Exit 0; 5,031 backend + 49 portal passed | [Ordinary](checks/ordinary-2.log) |
| `npm run typecheck`, final run 2 | Exit 0 | [Typecheck](checks/typecheck-2.log) |
| `npm run build:user-portal`, final run 2 | Exit 0 | [Portal](checks/portal-2.log) |
| `npm run test:logging:postgres` | Exit 0; 26/26 passed | [PostgreSQL](checks/postgres-1.log) |
| `npm run test:logging:collector` | Exit 0; 10/10 passed | [Collector](checks/collector-1.log) |
| Members browser runtime file | Exit 0; 1/1 passed; keyboard and narrow layout | [Browser](checks/browser-1.log), [390px screenshot](browser/members-remove-narrow.png) |
| `npm run test:hosted-live` | Exit 0; 29/29 passed across both live files | [WorkOS staging](checks/hosted-live-1.log) |
| `npm run test:container` | Exit 0; 11/11 passed | [Self-hosted image](checks/native-container-1.log) |
| `npm run test:container:hosted` | Exit 0; 7/7 passed on Linux AMD64 | [Hosted image](checks/hosted-container-1.log) |
| Nested `build:hosted` in the AMD64 image | Passed: backend unit 3,246; portal unit 29; portal acceptance 20; integration 1,126; explicit acceptance/interface 119; renderer 13 | [Complete offline build](checks/hosted-offline-build.log) |
| Fresh coverage, unit + integration + acceptance | Exit 0 on final commit; 3 verified captures, 172 source files, 1,327 processes. Passed 3,246 backend + 29 portal unit; 1,126 integration; 595 backend + 20 portal acceptance | [Coverage log](checks/coverage.log), [command](review/coverage-command.json), [report](metrics/coverage.json) |
| Final quality process | All four sections completed; Delta, Review and full-main CRAP retain goal misses (exit 1), Architecture passed. No tool failure. | [Process](metrics/process.md), [command results](review/metrics-command-results.json) |
| Actual-parent MI snapshots and CRAP | Exit 0; all 14 new/changed function rows have measured 100% own-character coverage; maximum CRAP 9 changed / 3 new | [Base snapshot](metrics/snapshot-base.json), [head snapshot](metrics/snapshot.json), [CRAP](metrics/crap.json) |
| Parent-bound review checker | Exit 0; T2 Need architect, preliminary local eligibility, no local blockers. Human approval remains required. | [Checker](metrics/pr-review.json), [stamped impact](metrics/impact.json) |
| Final public declarations | Exit 0; 49 snapshots checked, exactly one changed against parent | [API check](checks/api-surface-final-check.log) |

Every completed test summary above reports equal test/pass counts and zero
failures, cancellations, skipped tests and todos. The ordinary command does not
establish either dedicated image gate; those ran separately. No separate host
`build:hosted` was needed because the actual AMD64 image build supplied it.
No additional `npm run check` or unselected suite was run. The repeat ordinary
run followed the test cleanup; the instrumented rerun supplies fresh coverage.

### Candidate binding and retained history

Initial gates ran the frozen working candidate while Git HEAD still named
planning commit `1a192d743a4c71ae6faebfd00f7ae6fd4c72ea0e`. Those labels are
historical, not a claim that planning HEAD contains the repair. The
[initial input inventory](history/gated-inputs-before-test-cleanup.json) and
[final source-input comparison](history/final-candidate-binding.json) record
1,471 inputs: production, runtime/live/browser/container support, policy, build
and dependency inputs match the final candidate. The sole later test change
replaced optional/non-null access with an explicit existence assertion. Its
[19-case focused run](checks/facts-test-cleanup.log) passed; ordinary/typecheck/
portal run 2 covers the final test bytes. Fresh coverage repeated the selected
groups on the committed candidate. The final comparison records the three later
status-document changes separately; none is a behavioral gate input. Original
intermediate inventories and planning-head labels remain intact.

Coverage finished at 22:50:46 UTC on 25 October 2026, exit 0, captured commit
`076e661d830b969bf233522e1163c22cd1934361`. All three captures have status
`verified`, use Node 24.20.0 and TypeScript 7.0.2, and share the exact bound
source/build identity with measurement `own-characters-1` and completion protocol
`normal-exit-or-sealed-or-loader-1`. Retained manifests:
[unit](coverage-captures/b15e6f441abc434ddb4be488d6df34322a28535da0fc1bb762fe42826d0528ee/capture-manifest.json),
[integration](coverage-captures/a434c7a3f54f50021ce3010bc519c98c992d9ace2a0cfe2d531bc4e53ab71efc/capture-manifest.json),
[acceptance](coverage-captures/1b6a57ba6ab2de4c02b6d7e38023f68ed0c71e28a23b0b2d3d32c2d36284d6c1/capture-manifest.json).
Their fingerprints are recorded in the report. Raw V8 files are not published.
This is fresh R1 coverage; previous stack captures remain historical. Instrumented
reruns use only groups already selected by the source policy.

Acceptance-first history is retained in the [implementation record](review/implementation.md):
the first regression returned `unknown` instead of required `applied`; the new
facts contract first failed because the operation did not exist; the coordinator
first failed when display reads were refused. After implementation, the first
coordinator/lifetime run had 69 passes and one cancellation, then exit 130:
the new target-user pause also paused fixture warmup. A test pause guard fixed
that seam; [retry](checks/coordinator-green-retry.log) passed 73. Final focused
groups passed 465 and display/removal groups passed 46 (511 combined); these
overlap the full suite and are not additional unique coverage counts.

The hosted gate itself had no failed attempt. A separate attempt to retrieve
its Buildx progress with the full ref returned `no record found`; the
[short-ID retry](checks/hosted-build-progress-2.log) streamed successfully and
was copied byte-for-byte to the offline-build artifact. Both retrieval logs are
retained. Task-owned builder cleanup reclaimed 3.921 GB while the active build
continued normally; it did not change assertions or restart the gate.

### Proof and environment limits

The [live manifest](live/s25-02-mvodln1y-e282ac.jsonl) is retained unchanged with
its [source hash/binding note](live/source-binding.json). Its planning-head and
dirty-tree fields remain visible. Only this run's exact fixtures are included;
cleanup completed with an empty failure list. Ordinary management was observed
for those memberships. External/unknown management refusals remain controlled
proofs. The password-only provider profile was checked, but no live MFA factor
was available, observed, enrolled or deleted. Invitation rejoin used the
privileged WorkOS API; recipient/link semantics are outside that proof.

The 100-member/300-ms regression uses simulated clocks and a store fake. It
proves exact admission, deletion and receipt behavior; it gives no live latency
guarantee. The separate real PostgreSQL overlap/restart gates cover their SQL
durability scope. The manager inspected the browser screenshot.

Docker gates used the isolated task context. After the run, the owned VM was
deleted successfully; [cleanup](history/cleanup-after.json) confirms the six
shared container IDs and global `colima` context were preserved. Credentials
were supplied only to child processes. Publication is conditioned on the retained
exact configured-secret scan, which does not replace manual artifact review.

No search-live, separate Axiom live-interface proof, production migration,
destination smoke, restore/release drill, cutover, owner notice approval or
runtime notice publication was selected. This repair makes no production
release claim. [Initial PR/comment history](pr-history/initial.json) and
[parent evidence](https://github.com/tomer-mayara/Thermus/tree/339b5716dab08f2195c2d88330a7707b776fca52/review-evidence/s2-5-02/806ccc573c6ae09c411a47a755d6dd9316343f8f)
remain historical evidence; they do not certify the repaired head.
