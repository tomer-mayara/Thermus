# S2.5-R1 independent domain review

Decision: source and focused-test scope approved. No concrete defect found in this repair. This is agent review, not the independent human architecture approval or complete-candidate gate signoff.

Actual parent: `0530dd634fe8302b55d4a0669463ef733199cc40`.
Working HEAD during review: `1a192d743a4c71ae6faebfd00f7ae6fd4c72ea0e`.
The implementation is an uncommitted working-tree delta, so HEAD alone does not pin the reviewed source. Source SHA-256 values:

| File | SHA-256 |
| --- | --- |
| src/accounts/organizations/organization-directory.ts | 364bfdbd9d2e89fca71d2f9deac027d3fe45465e2baf9a80d8520ad6eb264f96 |
| src/accounts/organizations/membership-removal-checks.ts | 22697d95d43749739820ffd59dbf04d7c1acdf3abd748d5367455d756235154f |
| src/accounts/providers/workos/workos-organizations.ts | 48b79aef80e4803eed36fcafbec343fafdfe05ce8256c8c73740dc256b355cd5 |

## Safety projection and ownership

`OrganizationMemberFacts` contains all existing safety fields and excludes only email. Full `OrganizationMember` extends that contract. The new page uses the same explicit statuses, organization, cursor, page size and signal. The WorkOS adapter validates each listed record before role lookup, reads the current organization catalog, and uses the existing grant mapping and raw management/revision rules. It has no getUser call. Empty pages return without catalog or display work.

The returned page, item list and facts records are frozen. Grants are copied and frozen by the unchanged `grantsOfRoles`; each grant and its permission list are also frozen. No raw membership record, role-list array, or catalog array escapes through the facts result. Management is a portable string, and revision remains a hash of update time, status, all role slugs and management. Unknown evidence remains unknown. Known permissionless extra roles remain visible and unsupported for removal; absent roles and invalid catalogs fail closed.

The removal owner changes only which page operation it calls. It retains the complete ten-page scan, latest-record rule, direct target snapshot, all-field comparison, current actor check and last-Admin decision. Admission, terminal receipts, total deadline, synchronous pre-send guard, no replay, stop and unknown-hold rules are unchanged. The direct target still has one bounded display-user read; its cost does not grow with organization size.

## Direct/display snapshot timing

The extracted facts calculation now runs before getUser, including management and revision. Previously identity/status/grants were captured before getUser but management/revision were calculated afterward. For ordinary production JSON responses this has the same result: no collaborator mutates that already-returned record. For an injected mutable record this change is more coherent: all membership facts now come from one synchronous snapshot rather than mixing before/after states. A fresh later page still detects a change. I found no safety regression or need to preserve the previous mixed-time behavior. Display email lookup and its abort checks remain in place.

## Test coverage and seams

The acceptance regression exercises real OrganizationAdministration plus WorkOSOrganizations through public fake provider/store boundaries. It models 100 active memberships and 300 milliseconds per successful email read on both monotonic and timer clocks. It checks applied, one exact delete, retained Admin, one email read and the same durable operation's terminal receipt. This addresses the original N-dependent cost rather than only asserting the new method name. It uses a fake store; existing SQL/runtime gates remain necessary and are owned by the manager.

The new adapter unit cases cover every safety field, complete roles, management states, revision equality, current catalog use, empty pages, filters/cursor, wrong scope, missing/unlisted roles, failed reads and catalog failure. Pinned-client integration checks raw management evidence, exact wire query, grants/revision and absence of user requests. Existing display-page and email abort cases remain.

Removal rule/lifetime seams were moved to memberFactsPage: later Admins, failed/repeated pages, duplicates, ten/eleven pages, actor loss, changed target facts and final-page expiry. New target-difference dimensions cover ID, organization, roles and permissions. The rule test also makes display pages fail if removal calls one. Real coordinator/adapter lifetime cases now stop at actor pages, target catalog, direct target email and facts catalog. The facts adapter checks an already-aborted signal and aborts around both remote steps. No stopped continuation gains a later send.

There are two concrete OrganizationDirectory implementations in the searched source/test tree: WorkOSOrganizations and OrganizationDirectoryDouble. Both have the operation. MembershipDirectoryDouble inherits it. The remaining restart-process memberPage counter is intentional: that path calls memberOverview for a display refresh before the conflicting removal, so it must not be migrated to a facts counter.

## Simplicity and evidence limits

This is the minimum facts-only boundary proposed in review. It adds no cache, concurrency policy, timeout, recovery path or generic framework. The small projection has one owner. The two explicit page methods share meaning where needed but retain their different display work; their limited request setup duplication does not require a generic reader under DRY3.

I read `.cache/s25-r1/focused-final.log`, which reports 465 passing tests, zero failures, cancelled, skipped or todo tests. I did not rerun it or claim an independent execution. I ran no build, full suite, metric, Docker or cloud command. The manager owns fresh complete-candidate gates, public declaration snapshots, impact evidence, registry/review updates and human approval. The working tree also contains documentation/registry work by other workers and the unrelated user draft; I did not change them. Only this cache review file was written.
