# S2.5-01c — Members removal

Status: implemented; complete candidate checks are in progress. This change stacks on
[S2.5-01b, PR #253](https://github.com/tomer-mayara/Thermus/pull/253).

## Scope

Add the Members removal form and safe navigation after self-removal. Use the
existing removal coordinator for every write. Check method, origin, CSRF,
selected organization, target, and revision. Keep applied, refused, busy, and
unknown results distinct. Capture customer Audit metadata only with the tenant
from current checked access. Export failure must not cause a retry.

Use existing access reads, seat counts, invitations, and identity-only workspace
selection. Preserve password-only access and the existing account and factor
scope. No MFA, role changes, new status storage, or production rollout is part
of this ticket.

## Behavior

The Members page offers a native confirmation for an ordinary active membership
with only known User/Admin grants. This is a display hint from the current read,
not permission to remove the membership. Cancel reads Members again and writes
no removal intent. The confirmation sends the organization, membership ID,
revision, and CSRF token.

The checked POST calls the existing coordinator once. It shows a fixed result
without reading Members again. Applied, denied, stale, unsupported, last-Admin,
busy, unavailable, and unknown results stay distinct. The result has no replay
form. It offers current Members, identity-only workspace selection, and sign-in
back to workspace selection. Last-Admin refusal also links to invitations.

Customer Audit capture uses the tenant from the current access decision. A
submitted organization cannot choose the export destination. Removal metadata
contains the actor, organization, membership ID, action, outcome, and time. It
excludes the form token and revision. Capture is best effort and cannot change
the result or release a pending operation.

## Verification

Start with failing acceptance specifications from
[the ticket](../design/organization-admin-plan.md#s25-01c--checked-members-removal-and-self-removal).
Implement each part through focused red, green, and refactor steps. Record the
complete candidate checks and review evidence before Ready. The focused run passes
168 tests, including 29 acceptance cases and the dedicated Chromium case. The
manager inspected the narrow confirmation with loaded production logo/fonts.

The separate browser command checks keyboard open, Cancel, and confirmation at
390 × 844 pixels:

```sh
npm run build:user-portal
npm run build
node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js
```

It needs Playwright Chromium and uses a local HTTP site with provider doubles.
Set `THERMUS_BROWSER_EVIDENCE_DIR` to save the confirmation screenshot. Route
tests cannot establish keyboard focus or rendered geometry.

## Release prerequisites

S2.5-02 still owns integrated live proof, recovery drills, owner runbooks, and
release. This change does not deploy the removal table or enable a hosted
rollout. The parent PRs and current-candidate architect approval remain required.

The prepared versioned bundle in
[`workos-organization-audit-documents.ts`](../../src/accounts/providers/workos/workos-organization-audit-documents.ts)
still describes invitation-only administration and says the portal has no member
removal. Preserve its bytes, hashes, and prior review record. Before release,
prepare and approve a new version that describes member removal, preserved
account/other-membership scope, last-Admin refusal, uncertain results, and removal
Audit metadata. Update the matching user help and verify the text actually shown.
The earlier Slice 2 notice review does not cover these new disclosures.
