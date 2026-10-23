# Hosted signup inspection and recovery

## Signup pages and document readers

The signup pages use the approved Thermus portal design. Sign-in and activation
remain separate steps. Page styles do not change signup eligibility, email
verification, agreement checks, or the activation safeguards. S1-03a adds the
organization name to the POST contract and uses one organization/authority agreement.
The marked organization test bundle proves application behavior only. It does not
approve legal text or open production signup; those remain separate rollout steps.

Desktop legal readers support keyboard focus and scrolling. On mobile, each
reader shows the original opening paragraph and a closed native disclosure.
Read full opens the whole document in the page. Hide closes it through the same
focused disclosure control. No reading or scrolling check controls activation.
The required agreement stays outside the disclosures and starts unchecked.

The pages render the approved Markdown with micromark and its GFM extension.
Raw HTML and dangerous link protocols remain disabled. The exact approved
source text, versions, and hashes remain unchanged. The content policy permits
only same-origin images and fonts and the page's hashed style; it permits no
script. Closed signup offers Sign in and Contact. Failed activation offers a
safe link to sign in again, reopen signup, or contact support, as appropriate.
Invalid and stale signup forms use the same brand layout. They retain the
existing refusal status and message. Method refusals retain the Allow header.
These actions do not repeat a POST or restore access.

## Tabletop specification

- Given a lost activation response, when Tomer inspects the result, then only
  reads establish the observed state; no grant is replayed.
- Given a retained personal record without active product access, when a person
  repeats signup, then the record stays and support handles the case. Other
  authorized workspaces remain usable.
- Given an activation in progress, when an operator must change its access,
  then admission is closed and in-flight work is drained before the final read
  and authorized change.
- Given an account-deletion request, when a retained signup marker is found,
  then its purpose and review date are recorded, and deleting it needs a
  separate scoped decision that explains the loss of the replay barrier.

Initial review: the prior procedures do not cover these signup states. The
steps below must satisfy these cases without a provider write during review.

## Authority and record handling

Tomer performs this procedure. Keep the case and minimum evidence in restricted
`~/.codex/operator-records`, outside Git. Record environment, subject, resource
IDs, observation times, expected document versions, outcome, next action, and
review date. Never copy keys, cookies, tokens, raw responses, or fetched content.
On October 16, 2026, the owner removed the durable backup and restore prerequisite
and chose this restricted local folder alone. No off-device backup or restore
proof is required. Retain the exact approved document/agreement bytes, versions,
and hashes there; a version or hash without the matching bytes is not enough.

This procedure permits inspection and a recovery proposal. It does not authorize
provider writes, restoration of access, record replacement, or account deletion.
Use [manual onboarding](hosted-user-onboarding.md) and
[deletion](hosted-account-deletion.md) only under their explicit scope and
approval. The [FS-01 record](fs-01.md) gives the creation proof and failure rules;
[FS-02](fs-02.md) gives the current inspection and Continue behavior.

## Deleted user in a browser session

A valid browser cookie can still name a user deleted from WorkOS. Signup reads
that current user before it inspects access and again before activation. Only a
404 from this user read requires fresh sign-in. Other provider failures remain
temporarily unavailable; a missing organization or membership does not mean that
the user was deleted.

GET signup shows the full notice and a Sign in link. POST signup returns 401
with the same notice and link, including a submission from a signed-out browser.
The link starts a new sign-in and returns to signup. Its callback replaces the
browser session. This recovery does not clear the cookie or change authentication
on other routes. It creates no organization or membership for the deleted user.
A fresh sign-in can use normal signup for its current subject. Any retained
signup marker for an earlier subject stays in place and still blocks grant
replay for that subject.

## Retained signup record

The external ID is `thermus-signup:` followed by a base64url SHA-256 of the trusted
WorkOS authority, one zero byte, and the subject. It has no email, but it remains
pseudonymous personal data. WorkOS stores the user subject in metadata. Do not
publish the marker or put it in JWT templates.

A historical v1 personal organization has no domains and exactly these nine
metadata fields:
`schema`, `subject`, `accepted_at`, `documents_version`, `terms_version`,
`terms_sha256`, `notice_version`, `notice_sha256`, and `agreement_version`.
The schema is `thermus-signup-v1`; the timestamp is server-supplied. Match the
subject, IDs, and document versions/hashes to trusted records. Match the agreement
version to its retained exact wording. Do not edit metadata to make an invalid
record pass inspection. It records initial acceptance, not later agreements.

S1-03a uses `thermus-signup-v2` for named organization creation. It retains
exactly ten fields: it replaces `accepted_at` with `authority_accepted_at`
and adds `agreement_sha256`, the SHA-256 of the canonical agreement UTF-8 bytes.
The server timestamp records acceptance of the organization/authority agreement.
This fits the [WorkOS metadata limit](https://workos.com/docs/authkit/metadata)
of ten pairs, ASCII keys up to 40 characters, and values up to 600 characters.
The adapter keeps its stricter limit of 500 ASCII characters per value.
The organization itself and the unchanged reserved external ID bind the
organization identity. The adapter checks the created and reread name; it does
not add a separate metadata update. A v1 record remains a read-only replay
barrier. It supplies neither organization consent nor an Admin upgrade.

The organization and reserved external ID prevent a later request from replaying
the initial grant. Keep them after ordinary revocation, even when the membership
is absent. Neither mutable metadata nor a successful read grants creation
authority. Signup can create at most one organization per subject/environment
while its record remains. This is not one per human or a permanent global ban.
Account deletion needs the distinct decision in the deletion runbook.

## Inspect before deciding

1. Verify the environment, actual user identity, and requested outcome. Locate
   the reserved external ID from the trusted authority and subject, not email
   or browser-supplied IDs. Use WorkOS's
   [organization read procedures](https://workos.com/docs/reference/organization)
   and [membership reads](https://workos.com/docs/reference/authkit/organization-membership).
   Follow pagination and inspect all statuses. A provider error is unknown,
   not evidence of absence or eligibility.
2. Compare the organization and signup marker with the retained exact bundle.
   Inspect effective roles and live product permission. Preserve unrelated
   memberships and roles. Use this state table for the case record:

   | Observed state | Result |
   | --- | --- |
   | Current-user read confirms the user is absent (404) | Offer fresh Sign in with the full notice; POST returns 401. Make no activation write. |
   | Valid signup marker and current active product access | Continue through the selector; no create or role update. |
   | Marker exists but is invalid, or its membership is absent, pending, inactive, or inconsistent | Support required. Keep the marker; no grant replay or repair. Continue remains available for current product access in another organization. |
   | No marker and current product access elsewhere, including Admin alone | Continue through the selector; no extra organization. |
   | No marker and no product access, with no uncertain earlier write | Normal signup may offer agreement when separately enabled; this is not an operator grant. |
   | Failed read or unresolved earlier write | State is unknown. Stop the affected recovery and escalate. Preserve evidence; make no activation write. |

3. After a timeout or lost create response, use reads of the exact known ID or
   external ID to inspect the outcome. Current absence does not prove a grant
   never occurred and was later removed. Another submission, process restart,
   conflict, or record read must not repeat membership creation, reactivate a
   membership, restore roles, rename the organization, overwrite acceptance,
   or replace the organization/marker. A later submitted name or agreement
   does not replace saved facts. Only a
   confirmed new-create winner can make the initial membership attempt.
4. If a manual recovery is needed, prepare a separate scoped decision with the
   observed state, evidence gaps, intended result, exact resources, agreement
   evidence, and impact on other access. Obtain explicit authority for any
   restoration. Establish that no grant occurred or obtain explicit authority
   to restore access; otherwise leave the activation blocked. This runbook
   supplies no automatic write recipe for a failed activation.

After confirmed new creation, the browser switch must use current membership
and select the same organization as the MCP guide. A refused or failed switch
must not replay the initial grant. A valid historical v1 record with current usable
User access can Continue without an Admin upgrade or a new agreement record. Past
invited membership alone does not bar normal creation when no current product
access or retained signup record remains. Multiple current memberships still use
the selector; recovery does not select an arbitrary organization.

The [S1-03b record](admin-s1-03b.md) gives the application recovery and eligibility
characterization and its limits. A local provider fake can exercise conflicting
creates and lost responses; it does not prove WorkOS service behavior or replace
separately scoped provider verification.

## Coordinate an activation already in progress

Before an operator changes an activation in progress, close admission through
the owner-authorized signup-off deployment, verify that all serving processes
use the closed state, and drain or stop in-flight activation requests. Coordinate
other operator and provisioning writers. Disabling signup does not cancel a
provider write already accepted. If quiescence cannot be established, stop the
conflicting change and escalate rather than claim an atomic result.

After work settles, reread the final organization, marker, and all membership
statuses. Apply only a separately approved scoped change, then read back its
result. Do not delete the marker to recover access. Revocation in one
organization is not global identity suspension. Session and Connect changes
must follow the deletion runbook's side-effect checks; browser selection does
not retarget the native client's token. Do not record token values as evidence.

## Tabletop result

Document review satisfies the four scenarios: inspection remains read-only,
retained markers block replay, conflicting writes wait for quiescence, and
account deletion requires a distinct retention/deletion decision. This is a
procedure review against FS-01/02, not a live recovery or provider purge proof.
