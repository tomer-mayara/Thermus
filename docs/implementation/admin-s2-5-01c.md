# S2.5-01c — Members removal

Status: implementation in progress. This change stacks on
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

## Verification

Start with failing acceptance specifications from
[the ticket](../design/organization-admin-plan.md#s25-01c--checked-members-removal-and-self-removal).
Implement each part through focused red, green, and refactor steps. Record the
complete candidate checks and review evidence before Ready.
