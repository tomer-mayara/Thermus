# S1-03b implementation record
Current validation: this branch includes the shared [metrics repair](ast-metrics-function-repair.md) from [PR #230](https://github.com/tomer-mayara/Thermus/pull/230). The dated results below describe the earlier candidate and analyzer. Current SHA-bound checks, retained goals, and blockers are recorded in [PR #223](https://github.com/tomer-mayara/Thermus/pull/223). Earlier passes do not certify the rebased commit.

## Earlier implementation and verification record

Status: S1-03b acceptance complete; PR remains Draft because required metrics
are blocked, 22 October 2026.

## Scope

Complete [S1-03b](../design/organization-admin-plan.md#s1-03b--creation-recovery-and-eligibility)
on top of [S1-03a PR #222](https://github.com/tomer-mayara/Thermus/pull/222).
The branch starts at `0de5fb83f1a5b4aa85f577cf6013422a15051208` and targets
`codex/admin-s1-03a`. The stacked pull request is
[PR #223](https://github.com/tomer-mayara/Thermus/pull/223).

The existing production implementation meets these recovery and eligibility
requirements. This ticket changes tests, test support, and documents. It changes
no file under `src/`. No new recovery store, state flag, retry coordinator,
provider operation, database, MFA rule, or invitation feature is needed.

Production signup still needs the exact approved organization documents and
separate live cutover checks at S1-05. This request includes neither merge nor
rollout. Preserve the parent worktree and its reports.

## Acceptance and TDD outcome

The new executable acceptance cases ran against the unchanged parent source.
They passed as characterization. No missing source behavior justified a failing
feature test or a source edit. This follows the ticket's explicit rule to keep
already-correct outcomes green; no failure was manufactured.

Fourteen new hosted acceptance cases cover these outcomes:

- A lost organization response before persistence leaves no record. A confirmed
  fresh creation after restart can use the newly submitted name and create Admin.
- A saved organization without usable membership requires support. A lost
  membership response can recover only when current access is confirmed.
- Late organization and membership writes complete after the existing client
  timeout. A new application reads the saved result without replaying a grant.
- Two application instances submit different names for the same subject. The
  fake retains one organization under the shared external ID. The winning 201
  response is held while the losing conflict settles. No grant occurs before
  the winning response is released; only then does one Admin write occur.
- A failed browser selection can retry after restart and open the same
  organization without another create, acceptance write, or grant.
- A former invited User with no current access or signup marker can create.
  The old membership stays inactive.
- Active and revoked legacy User memberships survive recovery without promotion
  or changed acceptance. A different submitted name cannot rename the saved org.
- A malformed marker alone requires support, even with an active saved Admin.
  Other current workspace access remains usable through the selector.
- Current User and Admin memberships remain selectable without another creation
  form or agreement.

Existing integration cases now compare the complete retained organization and
membership values when another name or document bundle is submitted. The
existing restart case keeps signup closure, revoked first Admin, old-form replay,
and other-workspace access coverage. Cancellation, bounded admission, provider
read failure, and current-role checks remain in their existing suites.

The final focused build and run passed 94 cases: 79 signup integration cases,
14 new acceptance cases, and the retained restart case. No case failed, was
cancelled, skipped, or marked todo. A test-matrix simplification first exposed
TypeScript narrowing and literal-inference errors; those test-code errors were
fixed before the clean build. They are not evidence of missing product behavior.

## Test design and evidence limits

The acceptance cases use real hosted HTTP listeners, application composition,
WorkOS SDK calls, browser cookies, and current-membership checks. The provider
is a local HTTP fake. It retains state while fresh application instances start.
The exact-route interceptor calls the existing responder to retain its normal
persistence behavior, then delays or drops the response. It fails when the exact
route does not exist. It adds no production dependency or generic middleware.

Repeated browser setup and restart steps use the existing test-support layers
through a small signup DSL. The race and late-completion cases use explicit
promise barriers and bounded test timeouts. They add no sleep or change to the
SDK or production timeouts. Each test owns its fake and application cleanup.
The response-loss matrix separates absent records from retained records because
their retry rules differ.

The WorkOS [metadata and external-ID documentation](https://workos.com/docs/authkit/metadata),
checked on 22 October 2026, states that external IDs are unique within an
environment and at most 64 characters. It also documents the ten-pair metadata
limit. The official [SDK documentation](https://workos.com/docs/sdks/rust)
states that ordinary mutations do not receive Idempotency-Key deduplication.
The application therefore relies on retained external-ID uniqueness, not one
outbound create request or an idempotency header. Its production SDK client
already has retries disabled.

These are documented provider contracts plus application tests. The fake cannot
prove the live WorkOS service. No new live run or provider setting change is
claimed. The parent's saved-client/connected-staging mismatch and absent saved
issuer remain the recorded live-gate limit; the harness must not create fixture
resources in an unverified environment. Approved legal text, real password,
email verification, reset, and cutover checks remain S1-05.

## Architecture and contract review

The manager reviewed the three workers' changes and the independent agent's
read-only review. The agent review found no actionable issue after the final
matrix simplification. Manager review strengthened the held-winning-response
race and made malformed-marker acceptance independent of membership revocation.
This is code review evidence, not independent authorized human approval.

Context, hosted/local containers, source ownership, component responsibilities,
collaboration, runtime order, resource lifetime, and deployment were compared
with the parent. No production code or public declaration changed. All registry
views remain accurate; no registry or Mermaid edit is needed. The parent renders
remain applicable to unchanged diagrams. The complete stack's earlier public
contract changes remain reviewed in the
[S1-01](admin-s1-01.md#architecture-and-review),
[S1-02](admin-s1-02.md#architecture-and-contract-review), and
[S1-03a](admin-s1-03a.md#architecture-and-contract-review) records.

Policy questions for this increment:

- Enforcement: no policy or check is relaxed. The test interceptor changes only
  owned provider-fake responses and does not bypass application checks.
- Deployment/data/rollback: no deployment or stored production data changes.
  The runbook preserves markers, names, memberships, and acceptance facts. Link
  updates in onboarding and deletion point to the renamed recovery heading.
- Trust/admission: current identity, membership, CSRF, origin, cancellation and
  bounded work still decide each operation. Saved metadata supplies no grant.
- Observable contracts: production request and response shapes are unchanged.
  New tests verify existing eligibility, support, Continue and replay behavior.

## Complete-candidate validation

The comparison base is trusted `origin/main`, not only the stack parent. The
candidate therefore includes production changes from S1-01, S1-02 and S1-03a and
selects their full source gates, even though S1-03b itself has no source edit.
Run the ordinary suite, type checking, portal build, both container gates, hosted
offline build, habit-hooks, metrics and the review-tier checker on this complete
candidate. The live gate retains the environment limit above. Do not add a
redundant standalone `npm run check`.

| Check | Result |
| --- | --- |
| Final focused signup run | 94 passed. |
| `npm test` | 4,138 server tests and 43 portal tests passed. |
| `npm run typecheck` | Passed. |
| `npm run build:user-portal` | Passed. |
| `npm run test:container` | All 11 self-hosted cases passed. |
| `npm run build:hosted` | All selected groups passed: 2,583 server unit, 25 portal unit, 18 portal acceptance, 1,033 integration, 118 selected acceptance/interface, and 13 renderer cases. |
| `npm run test:container:hosted` | All 7 Linux AMD64 cases passed. |
| Unit and integration coverage | Passed; verified coverage of 138 source files from 633 processes. |
| Base and head snapshots | Completed with ast-metrics 0.43.1. |
| Complete metrics process and standalone CRAP | Failed on omitted native source declarations; details below. |
| Review tier | T2 Need architect; eligibility blocked by failed CRAP, unavailable Architecture, and missing CRAP rows. No undeclared fact or new cycle was found. |

The final source and test content passed the focused and ordinary suites before
commit. Manual review found no whitespace error or broken local file link. The
registry and all ten diagram blocks match the parent. The final evidence changes
add no source or test behavior. Coverage was collected after the impact
declaration was committed. Its source and input fingerprints match the final
snapshot; later prose changes do not alter those inputs.

## Quality review and blocker

The complete stack still needs production metrics against trusted `origin/main`.
The production tree is byte-for-byte unchanged from S1-03a. Its retained MI
findings and reasons remain in the [parent review](admin-s1-03a.md#metrics-review-and-blocker).
The suggested broad recovery split was considered here. It adds no required
behavior or clearer ownership: one adapter still owns confirmed creation and
read-only recovery. The new characterization supports keeping that boundary.
No source refactor is added merely to move decision paths between wrappers.

The complete habit-hooks run exits 1 with five complexity findings, one
parameter-count finding, 642 comment findings, and 23 file-size findings. The
snooze file remains empty. The parent
[retained reasons](admin-s1-03a.md#review-and-stack) still apply to unchanged
production and earlier test files. The new recovery file keeps eight related
unconfirmed-write, restart, race, and browser-selection cases together. Splitting
this file only to meet the line threshold would separate one recovery contract.
The now-touched HTTP fake already exceeded the size threshold and had five
comment findings. Its comments explain issuer setup, route precedence, aborted
body reads, and boundary behavior. The six-line exact-route interceptor belongs
with its existing response dispatch and adds no new complexity finding.

The final native review retains 14 high findings on changed production files
and two on changed test files across the complete stack. The other 48 high
findings concern unchanged files. None comes from the S1-03b increment. The
parent record gives the individual reasons, including all 25 changed production
files below MI 85. Test and support files have no MI goal.

Both the complete process and standalone CRAP command fail because
`get_file_metrics` omits source declarations in
`src/accounts/organizations/organization-administration.ts`. The process records
Delta and Review goal misses, failed CRAP, and unavailable Architecture. There
is no valid CRAP report, completed function-goal assessment, or new metrics
history record. No baseline, rule, or exception change hides this tool failure.

The candidate-bound classifier reports **T2 Need architect**, with three
blockers: failed CRAP, unavailable Architecture, and missing CRAP rows. Observable
authorization, signup, persistence, and portal contracts in the complete stack
require architecture review. The retained T1 reasons are protected policy,
deployment/data and security paths; test-gate documentation; declared dependencies
and public surfaces; production/total review size and test-count changes;
retained MI and review findings; and declared component, internal-interface,
sensitive-behavior and policy impact. The full report keeps each reason.

These are retained findings and failed evidence, not passing tool results. An
independent authorized human architect must approve the current candidate before
merge. Agent review is not that approval. The required metrics assessment must
also complete before Ready; this PR remains Draft.

## Retained evidence and merge order

Full reports and command logs are retained in this worktree at
`/Users/tomermayara/.codex/worktrees/admin-s1-03b/Thermus/ast-report/README.md`.
The bundle links the complete process and native review, base/head snapshots,
verified coverage, stamped impact declaration, and candidate-bound tier result.
These are local review artifacts, not uploaded CI results. There is no valid
`crap.json` to link or approve.

PR #222 must merge before this stacked PR. Preserve its workspace and reports.
No merge or rollout is included in this request. The live WorkOS environment
limit and the S1-05 legal and cutover checks remain as stated above.
