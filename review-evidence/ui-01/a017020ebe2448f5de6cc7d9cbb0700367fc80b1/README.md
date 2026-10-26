# UI-01 review evidence

Candidate: [a017020ebe2448f5de6cc7d9cbb0700367fc80b1](https://github.com/tomer-mayara/Thermus/commit/a017020ebe2448f5de6cc7d9cbb0700367fc80b1).
Base/main: [57c99e2b892acea52bfc3a53aee61b5ae442bf46](https://github.com/tomer-mayara/Thermus/commit/57c99e2b892acea52bfc3a53aee61b5ae442bf46).
PR: [#263](https://github.com/tomer-mayara/Thermus/pull/263).

UI-01 adds trusted workspace context, real page navigation, a 32px shared title,
full-width Members content and a working keyboard skip link. UI-02/03/04 remain
planned. This record claims no merge, deployment or human approval.

## Current results

| Check | Result |
| --- | --- |
| Full ordinary suite | 5,129 ordinary + 49 portal tests passed. |
| Typecheck; portal build | Passed. Typecheck repeated after the final browser helper rename. |
| Members browser | 7 passed; JS on/off at 320/1280px, Audit at 800/860px, keyboard, long text, doubled text, help and Save/Test. |
| Focused Members/Audit routes and renderers | 82 passed. |
| Shared-site consumers | 25 passed. |
| Self-hosted container | 11 passed with outbound access denied. |
| Linux AMD64 hosted image | 7 runtime checks passed. |
| Fresh hosted build inside that image, with no external network | 3,301 unit + 49 portal + 1,157 integration + 119 acceptance + 13 renderer checks passed. |
| Refreshed verified unit coverage | 3,301 emitted + 29 portal unit tests passed at this candidate. |
| Habit-hooks | Passed; two reason comments retained, no snooze or suppression. |
| Final checker | T1 Team review, locally eligible, no blockers; 49 public snapshots unchanged. Human approval is still required before merge. |
| GitHub checks/statuses | None were reported for this head when inspected; no CI pass is claimed. |

[Current desktop preview](implementation/final-candidate-browser/members-normal-1280.png) ·
[Current mobile preview](implementation/final-candidate-browser/members-normal-320.png) ·
[Current browser evidence](implementation/final-candidate-browser) ·
[Manager review](validation/manager-review.md) ·
[Final checker](validation/review-check.json).

## Scope and provenance

The ordinary and image checks ran on source d35d12fc. The final candidate keeps
that production source. Later changes are documentation, the generated immutable
base metric record, and one local browser-driver binding renamed from skip to
skipLink to avoid the trusted checker's lexical skipped-test rule. That driver
has one consumer: the dedicated browser runtime. Its seven cases, typecheck and
habit-hooks ran again, and unit coverage was collected again because the global
test-input fingerprint changed. [Candidate comparison](validation/final-candidate.json)
records the exact files. No check result was promoted from an interrupted run.

[Commands and red/green history](implementation/commands.txt) retain the initial
acceptance failures, fixture mistakes, skip-focus failure, Audit tablet regression
and fixes. The initial full ordinary run at ed804ba6 was stopped after the tablet
finding; its log and reason are retained as a non-pass. The old blocked checker
at369b8be7 is retained; it is superseded by the final checker. Earlier screenshot
folders mentioned in the command history are local intermediate captures;
reviewed-browser is the prior reviewed state and final-candidate-browser is current.

## Quality reports and limits

[Full process](ast-report/process.md), [process JSON](ast-report/process.json),
[review findings](ast-report/review.md), [CRAP](ast-report/crap.json),
[base snapshot](ast-report/snapshot-base.json), [head snapshot](ast-report/snapshot.json),
[normalized coverage](ast-report/coverage.json) and capture manifests are included.
The original report bytes are unchanged. Raw V8 capture files remain local;
normalized coverage and the capture manifests retain the verified provenance.

Delta and Review complete with retained goal misses: two existing production
files remain below MI85, and test files retain one high MI finding and two low
size estimates. Reasons are in the manager review. Required changed-function
CRAP goals pass, with no exception. The global graph retains the unchanged
unresolved CSS import; it does not prove a globally complete graph. The public
snapshot emitter ignored33 diagnostics in two unlisted files under its policy;
the complete application typecheck passed.

Hosted-live, PostgreSQL, Collector and production release gates are N/A for this
presentation increment and its actual test-helper consumers. Browser tests use
built assets and real application routes/services with controlled external seams;
they do not prove production service availability. The hosted runtime gate uses
public HTTPS for its TLS proof. Its offline build runs with network disabled.

The final checksum file covers every retained file. Known configured secret
values were checked before publication; private environment files and the local
credential launcher are excluded. The evidence branch has no application change
beyond the pinned candidate. Independent agent and manager review are complete;
they do not replace T1 owner/team approval.
