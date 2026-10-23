# S1-05 implementation record

Status: offline journey implemented; complete-candidate verification in progress,
23 October 2026.

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
approval, deployment, or cutover changes are part of this PR. The existing
metrics-tool failure remains unresolved until a valid rerun proves otherwise.
This record does not mark S1-03, S1-04, S1-05, or Slice 1 complete.

## Read-only staging verification

On 23 October 2026, the existing staging launcher supplied the matching client
and issuer and a test API key from Keychain. The verification printed only three
boolean checks; no credential was printed or copied. The connected WorkOS
readback confirmed `https://localhost:46443/login`, its `/callback`, and `/` as
the sign-out destination. The differing root `.env.local` is not a blocker when
this launcher is used. Earlier implementation records did not check that path.

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
- Type checking, portal build, container gates, and metrics: pending below.
- Manual documentation review: 491 local file links checked; none missing.

The complete-candidate habit-hooks run exits 1 with six complexity, one
parameter-count, 664 comment, and 24 file-size findings. The snooze file is empty.
The new complexity finding is the combined acceptance case: keep its sequential
journey and runtime metadata guards visible together, rather than hide steps in
single-use test abstractions. Its one comment marks the provider substitution,
which matters to the evidence limit. Inherited findings retain the
[S1-04b reasons](admin-s1-04b.md#quality-review). No unsafe cast or dependency
finding remains. This is a reviewed retained-finding result, not a clean lint pass.
