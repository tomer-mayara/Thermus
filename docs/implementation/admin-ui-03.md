# UI-03 — On-demand invitation form

Scope: [UI-03](../design/organization-admin-plan.md#ui-03--on-demand-invitation-form)
of the Refined tabs plan. This candidate starts from UI-01 PR #263. UI-02 is a
separate sibling and is not included in this change.

## Intended behavior

Members starts with a closed native Invite member disclosure beside the heading.
It contains the existing protected invitation form, one Send invitation action,
and a Cancel link to a fresh Members page. The existing role choices, identity
policy note, native validation and fixed server notices stay intact. The form
works without JavaScript. No trigger or form appears when no role is invitable.

The last-Admin refusal page explains how to open Invite member, select Admin,
and wait for acceptance. Its existing recovery link and route stay intact.

## Validation plan

Write and run the browser BDD acceptance case before the source change. Add
focused failing integration cases, implement the smallest markup and style
changes, and refactor with tests green. Migrate existing Invite-label consumers
without losing their role or send checks. Record actual red and green evidence.

Run the selected browser and other affected test groups, the complete ordinary
suite, typecheck, portal build, and required container gates. Review the final
candidate, documents, component registry, public declarations, habit-hooks,
metrics and review tier before Ready. This request includes no merge or deploy.
