# UI-04 — Compact pending invitations

Scope: [UI-04](../design/organization-admin-plan.md#ui-04--compact-pending-invitations)
of the Refined tabs plan. This candidate starts from UI-03 PR #266 at
`12d1a3c5b7cab197fa828ef89b7f650f918a7ea2`. UI-02 PR #264 remains a sibling
and is not included. This record claims no merge or deployment.

## Intended behavior

Members shows Pending invitations with the complete pending count in a native
disclosure. An empty group starts closed; a nonempty group starts open. Rows
keep their role, absolute UTC expiry and currently allowed protected Resend and
Revoke forms. A later page failure remains the existing error with no partial
list or misleading zero. Add no counter storage, provider rule or new action.

Keep section order, approved help text, and UI-03's invitation task. Verify
keyboard use, narrow reflow, long values and text resize with JavaScript on and
off. The member-row presentation remains the separate UI-02 candidate.

## Validation plan

Start with a failing browser BDD case for the counted zero/nonzero disclosure,
then focused failing integration tests. Preserve already passing lifecycle and
complete-read characterization. Add a failing geometry check only for a real
layout gap, make it pass with the smallest markup/CSS change, and refactor.

Trace affected tests and helpers to their selected groups. Run complete
candidate checks, metrics, habit-hooks and policy review before Ready. The
parent's required WorkOS staging proof was blocked by an invitation-email
quota; current evidence must retain or resolve that limit without a waiver.
