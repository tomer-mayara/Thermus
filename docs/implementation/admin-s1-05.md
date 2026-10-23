# S1-05 implementation record

For verification of merged source `9de610e8b75dfa041dcf18c5380ccf80feb9f797`,
see the [23 October Staging release record](admin-s1-staging-release-verification.md).
It records the live results, remaining invitation and mailbox checks, and legal
approval needed before signup opens. The sections below retain their earlier
candidate evidence; they do not state the current release status.

Pre-merge validation: all seven Slice 1 branches were rebased onto the shared
[metrics repair](ast-metrics-function-repair.md),
[PR #230](https://github.com/tomer-mayara/Thermus/pull/230), above trusted main
`53da7ac40149ed8e5bc67fa208d8701474fff284`. The dated results below describe
earlier candidates and the earlier analyzer. Current candidate pins,
SHA-bound checks, retained goals, and blockers are recorded in
[PR #229](https://github.com/tomer-mayara/Thermus/pull/229) and
[parent PR #226](https://github.com/tomer-mayara/Thermus/pull/226), with each
parent PR's evidence. Earlier passes do not certify a rebased commit. Each
candidate needs its own compatible evidence.

The repair restores complete native function inventory, exact metric/coverage source identity, and base-scoped Review. Small parent changes keep Members HTML/status/headers and test assertions intact. The owner chose to retain justified existing low-MI file goals and fix tool failures and new regressions. No threshold, baseline, or snooze was relaxed. Human architecture approval and the provider, legal, manual UI, and cutover holds remain separate from local quality validation.

The parent registry now shows the ordered Members overview calls and the local gates in callback landing. Those corrections describe existing behavior. This ticket changes no production source or registry diagram relative to its parent.

The hosted image client cancellation correction is inherited from the S1-04b
parent. S1-05 adds no further image-driver change. The dated diagnostic below
preserves the earlier failure and local probe limits; it does not certify the
current candidate.

## Client cancellation diagnostic (23 October 2026)

The first image run at `ce012a941efc6b21779362020c67f378e251f567` waited for
`cancelled`, but the renderer ended at its 15-second timeout and reported
`fetch_failed`. An unchanged S1-03b retry passed 7/7. Those logs do not show
when the client aborted or whether its pending call rejected.

A bounded local HTTP diagnostic on Node 24.20.0 reproduced a client lifetime
failure. Under forced garbage collection, the existing temporary Request pattern
lost cancellation in every trial. Passing the same signal directly to `fetch`,
or keeping the input Request alive, produced `AbortError` and an early socket
close. A follow-up observed the same split after the client received response
headers and started reading the delayed body. Full scripts, scalar timings, and
outcomes are retained locally under `ast-report/cancellation-diagnosis/`.
This proves a failure mechanism in the client pattern. It does not prove that
garbage collection caused the original image failure or that the server path
has no defect.

The image test driver now passes `{ signal }` directly to `fetch`. Its first
intentional cancellation retains the settled value as `unknown` and requires
an Error named `AbortError`; a resolved tool result now fails clearly. Renderer
settlement, the `cancelled` record, capacity recovery, SIGTERM assertions, and
the existing timeouts remain in place. This is a test-driver correction with
no production or shared-helper API change.

Validation of this changed candidate is pending. The manager will select and
run the required suites and image gate. Earlier image passes do not certify
this correction. The local diagnostic does not replace that gate or the
provider, legal, manual UI, cutover, and human-review holds.

## Earlier implementation and verification record

Status: offline journey implemented and local functional gates passed;
quality and release holds remain. 23 October 2026.

## Scope

Add the combined create, invite, and join journey from
[S1-05](../design/organization-admin-plan.md#s1-05--complete-journey-verification-and-cutover).
This PR stacks on [S1-04b PR #226](https://github.com/tomer-mayara/Thermus/pull/226),
rebased parent `9da567ad757ec16af7efe5615ae8b8bce1dcc46d`.
The trusted main is `8eeade72d366c0e3dd2486fcf2fa9d771bf03788`.

The six open implementation branches were rebased in order. Each final tree
matches its previous tree except for the current AGENTS.md. Backup branches and
previous reports remain available. Earlier results retain their original SHA;
they are not new passes of the rebased candidates.

## Acceptance specification

Given an eligible verified creator and a recipient, when the creator creates a
named workspace with the marked test agreement, invites the recipient as Admin
or User, and the recipient accepts and selects it, both can use the product and
MCP. Only Admin can use Members. The inspected server pages have no grant form
or application MFA/extra-agreement gate, and only the creator agreement is stored.
The exact creation and selection destinations are checked. The test uses the
real backend, server-rendered forms, and MCP middleware; it does not render the
static portal client. Separate portal tests and manual UI checks retain that
responsibility. The provider double stands in for authentication, native
invitation acceptance, and Connect tokens. This case cannot establish actual
password or WorkOS behavior.

The combined case passed existing source behavior after test setup and expectation
corrections. Early failures concerned the user fixture, an absent static portal
wrapper, the agreement hash, and the expected tenant format. These were not
missing source behavior. No red/green source change or new TDD cycle is claimed.
Review added the exact creator redirect and recipient name, removed unsafe
metadata casts, and narrowed the agreement claim to this test boundary.

## Required checks and completion limits

The complete candidate against main includes the unmerged source stack. Select
the ordinary suite, type checking, portal build, self-hosted container, hosted
offline/image/live gates, habit-hooks, and source metrics under the test policy.
Run build commands sequentially. The manager reviews the complete candidate.

Native invitation proof, the password-only provider profile, the approved organization
legal bundle, and scoped cutover remain release holds. Current production legal
documents still block creation. No provider setting, live membership, legal
approval, deployment, or cutover changes are part of this PR. The
[organization terms proposal](admin-s1-05-legal-proposal.md) supplies exact
replacement wording and open owner decisions. It is not an approved bundle.
The fresh metrics run reproduced the existing tool failure.
This record does not mark S1-03, S1-04, S1-05, or Slice 1 complete.

## Read-only staging verification

On 23 October 2026, the existing staging launcher supplied the matching client
and issuer and a test API key from Keychain. The verification printed only three
boolean checks; no credential was printed or copied. The connected WorkOS
readback confirmed `https://localhost:46443/login`, its `/callback`, and `/` as
the sign-out destination. The differing root `.env.local` is not a blocker when
this launcher is used. Earlier implementation records did not check that path.
After the owner reported a local-file update, another values-hidden check of
the available checkout files still found a different client and missing issuer.
The launcher remains the matching configuration; no additional key is needed.

Shared staging still has MFA Optional. The live Slice 1 profile requires Disabled.
Password and email verification are enabled; Google and SSO are also enabled.
No setting or fixture changed. The hosted live command and native invitation
matrix remain NOT RUN. Starting the live command can create or clean fixtures,
so it was not used to rediscover the known profile mismatch. The corrected
[native proof matrix](../testing/workos-invitation-proof-matrix.md) records the
verified target and remaining controlled-recipient requirements.

## Architecture and review

Compared the parent registry at `9da567ad757ec16af7efe5615ae8b8bce1dcc46d`
with this increment: all 11 Mermaid blocks are identical. No source, production
contract, dependency, resource lifetime, configuration, or deployment changes.
Context, containers, components, runtime, and deployment remain accurate. This
adds combined application evidence to the existing system, not a new capability.
No registry edit or new comparison drawing is needed for this increment.

The manager reviewed the test and documents. An independent agent reviewed the
assertions, test scope, and every registry diagram. Its findings were corrected:
exact redirect/name assertions, safe metadata checks, explicit static-portal
limits, and the staging-launcher correction. Agent review is not the required
independent human approval of the complete authorization/signup stack.

## Local validation

- Initial and final focused journey runs: 2/2 passed after a backend build.
- `npm test`: 4,180 server and 49 portal tests passed, with no failures or skips.
  The final assertion-only review edits passed in the rebuilt focused run.
- `npm run typecheck` and `npm run build:user-portal`: passed.
- Self-hosted container gate: 11/11 passed.
- Hosted offline build: 2,596 server unit, 29 portal unit, 20 portal acceptance,
  1,045 integration, 118 explicit acceptance/interface, and 13 renderer tests
  passed. The build's own required checks are included in this result.
- Linux AMD64 hosted image gate: 7/7 passed.
- Unit/integration coverage: 139 source files from 635 processes; collection
  completed. The metrics process reused this compatible report.
- Documentation links, exact proposal anchors, whitespace, and diff were checked
  manually. No executable test was added for documentation.
- Hosted live, native invitation matrix, and new manual desktop/mobile checks:
  not run. Existing portal automated cases passed; they do not close these holds.
- Remote CI: unverified. The checks connector denied access to this workspace;
  local passes do not assert a remote CI result.

The complete-candidate habit-hooks run exits 1 with six complexity, one
parameter-count, 664 comment, and 24 file-size findings. The snooze file is empty.
The new complexity finding is the combined acceptance case: keep its sequential
journey and runtime metadata guards visible together, rather than hide steps in
single-use test abstractions. Its one comment marks the provider substitution,
which matters to the evidence limit. Inherited findings retain the
[S1-04b reasons](admin-s1-04b.md#quality-review). No unsafe cast or dependency
finding remains. This is a reviewed retained-finding result, not a clean lint pass.

## Quality evidence and review tier

Fresh base and head snapshots cover 148 and 151 production files. The complete
stack retains 26 changed production files below the MI goal of 85. No added
production file is below 85. The full table is in the local
`ast-report/mi-review.md`; the design reasons remain in
[S1-04a](admin-s1-04a.md) and [S1-04b](admin-s1-04b.md#quality-review).
This increment changes no source. That fact does not waive the complete-stack
goals. No baseline or exception was changed.

The review reports 18 high findings on changed files: 15 production findings
and three test findings. Keep the owning validation, state transitions, and
route cases together for the reasons recorded in S1-04b. Test MI has no numeric
goal. The other 48 high findings concern files unchanged by the complete stack;
they remain in the full report and do not raise this candidate's tier.

The process completed Delta and Review with goal misses. CRAP failed because
the native tool omitted source declarations in
`src/accounts/organizations/organization-administration.ts`. The standalone
CRAP command reproduced this failure. Architecture could not complete without
the required CRAP evidence. Do not invent a CRAP report, waive the failure with
an exception, or create a history record for an incomplete process.

The complete candidate remains **T2 Need architect, blocked**. It inherits the
signup, authorization, and portal contract changes, protected/public surfaces,
and retained quality findings from the stack. Required CRAP/process evidence,
live/provider/legal/manual/cutover holds, and independent human architect
approval remain open. The final SHA-bound checker output, detailed reasons,
blockers, architecture comparison, and logs are retained under local
`ast-report/` and linked from the PR. The reports are local review artifacts;
they are not uploaded CI results. Keep this PR Draft.
