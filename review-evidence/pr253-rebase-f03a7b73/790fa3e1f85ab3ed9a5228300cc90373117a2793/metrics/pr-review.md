## Review tier

Tier: `T2 Need architect`
Local eligibility: `eligible`
Architecture: T2: 1 public module added; declarations changed in 3 public modules; 2 registry views added, 5 registry views edited
Candidate: 790fa3e1f85ab3ed9a5228300cc90373117a2793
Merge base: f03a7b73b2c27dc26477d5378a3356f28744a367

Architecture facts:
- architecture.public_module_added: src/accounts/organizations/removal-operation-store.ts
- architecture.declarations_changed: src/accounts/organizations/change-records.ts (+2 -2 lines)
- architecture.declarations_changed: src/accounts/organizations/organization-administration.ts (+6 -0 lines)
- architecture.declarations_changed: src/accounts/organizations/organization-directory.ts (+3 -2 lines)
- architecture.registry_view_changed: architecture/components.md: 2 views added, 5 views edited

src/accounts/organizations/change-records.ts (+2 -2 lines):

```diff
diff --git a/docs/api-surface/src/accounts/organizations/change-records.d.ts b/docs/api-surface/src/accounts/organizations/change-records.d.ts
index 9688b8a9..8a8f6563 100644
--- a/docs/api-surface/src/accounts/organizations/change-records.d.ts
+++ b/docs/api-surface/src/accounts/organizations/change-records.d.ts
@@ -1,6 +1,6 @@
 import type { AuthenticatedUser } from '../identity/access-context.ts';
 export type ChangeResult = 'applied' | 'unchanged' | 'denied' | 'stale' | 'not-pending' | 'address-in-use' | 'unsupported';
-export type ChangeOutcome = ChangeResult | 'failed' | 'unknown';
+export type ChangeOutcome = ChangeResult | 'failed' | 'unknown' | 'last-admin' | 'busy' | 'unavailable';
 export declare class UnconfirmedChangeError extends Error {
     constructor(cause: unknown);
 }
@@ -40,6 +40,6 @@ export declare class ChangeRecording {
     constructor(records: ChangeRecorder, clock: () => Date);
     run(entry: ChangeEntry, check: () => Promise<ChangeResult | DirectoryChange>): Promise<ChangeResult>;
     private recordingFailure;
-    private keep;
+    record(entry: ChangeEntry, outcome: ChangeOutcome): void;
 }
 export {};
```

src/accounts/organizations/organization-administration.ts (+6 -0 lines):

```diff
diff --git a/docs/api-surface/src/accounts/organizations/organization-administration.d.ts b/docs/api-surface/src/accounts/organizations/organization-administration.d.ts
index 2caf2796..0928c317 100644
--- a/docs/api-surface/src/accounts/organizations/organization-administration.d.ts
+++ b/docs/api-surface/src/accounts/organizations/organization-administration.d.ts
@@ -3,6 +3,8 @@ import type { Billing, BillingState } from '../billing/billing.ts';
 import { type InvitationOverview, type MemberOverview } from './administration-overviews.ts';
 import { type ChangeRecorder, type ChangeResult } from './change-records.ts';
 import type { OrganizationDirectory } from './organization-directory.ts';
+import type { MemberRemovalRequest, RemovalOperationStore, RemovalResult } from './removal-operation-store.ts';
+export type { MemberRemovalRequest, RemovalResult } from './removal-operation-store.ts';
 export interface Actor {
     readonly user: AuthenticatedUser;
 }
@@ -26,12 +28,16 @@ export interface OrganizationAdministrationOptions {
     readonly records: ChangeRecorder;
     readonly billing: Billing;
     readonly clock?: () => Date;
+    readonly removalStore?: RemovalOperationStore;
 }
 export declare class OrganizationAdministration {
     private readonly directory;
     private readonly changes;
     private readonly billing;
+    private readonly removals;
     constructor(options: OrganizationAdministrationOptions);
+    removeMember(actor: Actor, request: MemberRemovalRequest): Promise<RemovalResult>;
+    close(): Promise<void>;
     listOrganizations(user: AuthenticatedUser): Promise<readonly AuthorizedOrganization[]>;
     authorizeSelection(user: AuthenticatedUser, organizationId: string): Promise<AuthorizedOrganization | undefined>;
     memberOverview(actor: Actor, organizationId: string): Promise<MemberOverview | AdministrationRefusal>;
```

src/accounts/organizations/organization-directory.ts (+3 -2 lines):

```diff
diff --git a/docs/api-surface/src/accounts/organizations/organization-directory.d.ts b/docs/api-surface/src/accounts/organizations/organization-directory.d.ts
index d1f5e593..614af3d0 100644
--- a/docs/api-surface/src/accounts/organizations/organization-directory.d.ts
+++ b/docs/api-surface/src/accounts/organizations/organization-directory.d.ts
@@ -35,6 +35,7 @@ export interface MemberPageRequest {
     readonly organizationId: string;
     readonly statuses: readonly MembershipStatus[];
     readonly cursor?: string;
+    readonly signal?: AbortSignal;
 }
 export interface InvitationPageRequest {
     readonly organizationId: string;
@@ -57,9 +58,9 @@ export interface MembershipDeletionResult {
     readonly outcome: 'applied' | 'unsupported';
 }
 export interface OrganizationDirectory {
-    membershipsOf(user: AuthenticatedUser): Promise<readonly OrganizationMembership[]>;
+    membershipsOf(user: AuthenticatedUser, signal?: AbortSignal): Promise<readonly OrganizationMembership[]>;
     memberPage(request: MemberPageRequest): Promise<Page<OrganizationMember>>;
-    member(membershipId: string): Promise<OrganizationMember | undefined>;
+    member(membershipId: string, signal?: AbortSignal): Promise<OrganizationMember | undefined>;
     deleteMembership(membershipId: string): Promise<MembershipDeletionResult>;
     invitationPage(request: InvitationPageRequest): Promise<Page<OrganizationInvitation>>;
     invitation(invitationId: string): Promise<OrganizationInvitation | undefined>;
```

Reasons:
- T2 Need architect architecture.public_module_added: src/accounts/organizations/removal-operation-store.ts
- T2 Need architect architecture.declarations_changed: src/accounts/organizations/change-records.ts (+2 -2 lines)
- T2 Need architect architecture.declarations_changed: src/accounts/organizations/organization-administration.ts (+6 -0 lines)
- T2 Need architect architecture.declarations_changed: src/accounts/organizations/organization-directory.ts (+3 -2 lines)
- T2 Need architect architecture.registry_view_changed: architecture/components.md: 2 views added, 5 views edited
- T2 Need architect impact.deployment: S2.5-01b adds organization-owned removal admission, current authority and exact target checks, last-active-Admin protection, and conditional completion. The existing private SQL adapter implements a new public RemovalOperationStore on the same bounded pool, with one pending operation per organization and retained terminal receipts. Uncertain effects remain held without replay. A 30-second owner lifetime and ten-page bound guard dispatch; optional neutral read signals stop further WorkOS read substeps while in-flight calls retain their existing five-second timeout. App supplies and closes the removal owner before shared SQL. Public request/result/store and directory stop contracts are snapshot-visible; invitation results and unrelated callers stay compatible. Organizations and audit-logs gain responsibilities and shared storage/recovery guarantees change, but the component set, source dependency pairs, C4 container topology, provider selection, and runtime configuration remain. Updated registry views describe the new runtime call separately from the existing opposite type dependency. No browser removal route, customer removal export, MFA, or live migration is added. The policy change registers the new public module and extends the existing PostgreSQL gate without weakening checks.
- T2 Need architect impact.component: S2.5-01b adds organization-owned removal admission, current authority and exact target checks, last-active-Admin protection, and conditional completion. The existing private SQL adapter implements a new public RemovalOperationStore on the same bounded pool, with one pending operation per organization and retained terminal receipts. Uncertain effects remain held without replay. A 30-second owner lifetime and ten-page bound guard dispatch; optional neutral read signals stop further WorkOS read substeps while in-flight calls retain their existing five-second timeout. App supplies and closes the removal owner before shared SQL. Public request/result/store and directory stop contracts are snapshot-visible; invitation results and unrelated callers stay compatible. Organizations and audit-logs gain responsibilities and shared storage/recovery guarantees change, but the component set, source dependency pairs, C4 container topology, provider selection, and runtime configuration remain. Updated registry views describe the new runtime call separately from the existing opposite type dependency. No browser removal route, customer removal export, MFA, or live migration is added. The policy change registers the new public module and extends the existing PostgreSQL gate without weakening checks.
- T2 Need architect impact.internalInterface: S2.5-01b adds organization-owned removal admission, current authority and exact target checks, last-active-Admin protection, and conditional completion. The existing private SQL adapter implements a new public RemovalOperationStore on the same bounded pool, with one pending operation per organization and retained terminal receipts. Uncertain effects remain held without replay. A 30-second owner lifetime and ten-page bound guard dispatch; optional neutral read signals stop further WorkOS read substeps while in-flight calls retain their existing five-second timeout. App supplies and closes the removal owner before shared SQL. Public request/result/store and directory stop contracts are snapshot-visible; invitation results and unrelated callers stay compatible. Organizations and audit-logs gain responsibilities and shared storage/recovery guarantees change, but the component set, source dependency pairs, C4 container topology, provider selection, and runtime configuration remain. Updated registry views describe the new runtime call separately from the existing opposite type dependency. No browser removal route, customer removal export, MFA, or live migration is added. The policy change registers the new public module and extends the existing PostgreSQL gate without weakening checks.
- T1 Team review protected_paths.policy: docs/implementation/pr-review-rules.yaml
- T1 Team review read_paths: .code-quality-exceptions.yaml
- T1 Team review read_paths: docs/implementation/test-gate-policy.md
- T1 Team review ratchet.exceptions: src/accounts/organizations/membership-removal-checks.ts covered by "One rule file keeps current actor authority, exact target facts, all grant support, complete bounded member pages, and the last-Admin decision together. Its largest function has nine paths, covered by refusal, pagination, duplicate, and target-change cases. Per-guard files would hide the order that prevents a stale User-to-Admin transition from bypassing the last-Admin check." until 2026-12-24
- T1 Team review ratchet.exceptions: src/accounts/organizations/membership-removal-lifetime.ts covered by "One small lifetime owns the total deadline, admission uncertainty, read stop signal, guarded continuations, and one public result. Its largest function has four paths. Tests cover the exact deadline, accumulated phase time, close, late replies, and signal propagation. Splitting timer, stop, or result state into another owner would obscure release-once and no-late-dispatch guarantees." until 2026-12-24
- T1 Team review ratchet.exceptions: src/accounts/organizations/membership-removal.ts covered by "One removal owner keeps authorization, durable admission, current checks, single dispatch, and conditional terminal receipts in one ordered flow. Its largest function has nine paths. Focused cases cover ambiguous admission, provider uncertainty, completion mismatch, and exact receipt matching. Further splitting would spread the no-replay and completion authority rules without reducing their decisions." until 2026-12-24
- T1 Team review impact.sensitiveBehavior: S2.5-01b adds organization-owned removal admission, current authority and exact target checks, last-active-Admin protection, and conditional completion. The existing private SQL adapter implements a new public RemovalOperationStore on the same bounded pool, with one pending operation per organization and retained terminal receipts. Uncertain effects remain held without replay. A 30-second owner lifetime and ten-page bound guard dispatch; optional neutral read signals stop further WorkOS read substeps while in-flight calls retain their existing five-second timeout. App supplies and closes the removal owner before shared SQL. Public request/result/store and directory stop contracts are snapshot-visible; invitation results and unrelated callers stay compatible. Organizations and audit-logs gain responsibilities and shared storage/recovery guarantees change, but the component set, source dependency pairs, C4 container topology, provider selection, and runtime configuration remain. Updated registry views describe the new runtime call separately from the existing opposite type dependency. No browser removal route, customer removal export, MFA, or live migration is added. The policy change registers the new public module and extends the existing PostgreSQL gate without weakening checks.
- T1 Team review impact.policy: S2.5-01b adds organization-owned removal admission, current authority and exact target checks, last-active-Admin protection, and conditional completion. The existing private SQL adapter implements a new public RemovalOperationStore on the same bounded pool, with one pending operation per organization and retained terminal receipts. Uncertain effects remain held without replay. A 30-second owner lifetime and ten-page bound guard dispatch; optional neutral read signals stop further WorkOS read substeps while in-flight calls retain their existing five-second timeout. App supplies and closes the removal owner before shared SQL. Public request/result/store and directory stop contracts are snapshot-visible; invitation results and unrelated callers stay compatible. Organizations and audit-logs gain responsibilities and shared storage/recovery guarantees change, but the component set, source dependency pairs, C4 container topology, provider selection, and runtime configuration remain. Updated registry views describe the new runtime call separately from the existing opposite type dependency. No browser removal route, customer removal export, MFA, or live migration is added. The policy change registers the new public module and extends the existing PostgreSQL gate without weakening checks.

Evidence blockers:
- none

Questions to answer:
- protected_paths.policy: Does this change what the checks enforce, or who decides? Record the new rule and why.
- protected_paths.contracts: Does a client, a user or an operator see a different input, output, error or default? Record the promise.

Changed paths:
- M .code-quality-exceptions.yaml
- M .pr-impact.json
- M architecture/components.md
- M docs/api-surface/src/accounts/organizations/change-records.d.ts
- M docs/api-surface/src/accounts/organizations/organization-administration.d.ts
- M docs/api-surface/src/accounts/organizations/organization-directory.d.ts
- A docs/api-surface/src/accounts/organizations/removal-operation-store.d.ts
- M docs/design/organization-admin-plan.md
- M docs/implementation/admin-s2-01a-database-setup.md
- A docs/implementation/admin-s2-5-01b.md
- M docs/implementation/pr-review-rules.yaml
- M docs/implementation/test-gate-policy.md
- M docs/testing/test-list.md
- M package.json
- A sql/migrations/20261025082850_membership_removal_operations.sql
- M src/accounts/organizations/change-records.ts
- M src/accounts/organizations/directory-reads.ts
- A src/accounts/organizations/membership-removal-checks.ts
- A src/accounts/organizations/membership-removal-lifetime.ts
- A src/accounts/organizations/membership-removal.ts
- M src/accounts/organizations/organization-administration.ts
- M src/accounts/organizations/organization-directory.ts
- A src/accounts/organizations/removal-operation-store.ts
- M src/accounts/providers/workos/workos-organizations.ts
- M src/app/application.ts
- M src/app/logging-storage.ts
- M src/logs/audit/pg-destination-settings-store.ts
- A test/acceptance/auth/membership-removal-restart.runtime.ts
- A test/acceptance/auth/membership-removal.runtime.ts
- M test/acceptance/logging/audit/hosted-storage-failure.runtime.ts
- M test/integration/auth/hosted-storage-lifecycle.test.ts
- A test/integration/auth/workos-removal-lifetime.test.ts
- A test/integration/logging/audit/removal-operations.runtime.ts
- A test/support/processes/membership-removal-child.ts
- A test/support/processes/membership-removal-process.ts
- M test/support/processes/module-paths.ts
- A test/unit/auth-workos/workos-organizations-read-lifetime.test.ts
- A test/unit/logging/audit/pg-removal-operation-store.test.ts
- A test/unit/organizations/fixtures/membership-removal-fixtures.ts
- A test/unit/organizations/membership-removal-lifetime.test.ts
- A test/unit/organizations/membership-removal-outcomes.test.ts
- A test/unit/organizations/membership-removal-rules.test.ts

Line counts:
- Production: 384 (limit 400)
- Total without generated files: 2474 (limit 1500)

Tests:
- Added test cases: 61
- Removed test cases: 2
- Added skips or todos: none

MI:
- changed: src/accounts/organizations/change-records.ts: 89.22475666893104 to 89.22475666893104
- changed: src/accounts/organizations/directory-reads.ts: 77.7967514351711 to 77.68961046333192
- new: src/accounts/organizations/membership-removal-checks.ts: 56.89018621554175
- new: src/accounts/organizations/membership-removal-lifetime.ts: 73.50007134856634
- new: src/accounts/organizations/membership-removal.ts: 43.6798696390541
- changed: src/accounts/organizations/organization-administration.ts: 64.84223495737288 to 61.94996672155523
- not applicable: src/accounts/organizations/organization-directory.ts: no raw MI in the base snapshot
- not applicable: src/accounts/organizations/removal-operation-store.ts: no raw MI in the head snapshot
- changed: src/accounts/providers/workos/workos-organizations.ts: 48.11091770208057 to 47.08422952684704
- changed: src/app/application.ts: 54.75315119138496 to 54.80630680546725
- changed: src/app/logging-storage.ts: 75.93874390720484 to 75.14548165661219
- changed: src/logs/audit/pg-destination-settings-store.ts: 53.641844103270124 to 46.31569984025012

CRAP:
- src/accounts/organizations/membership-removal-checks.ts: checkRemoval: 9.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.complete: 9.0
- src/accounts/organizations/membership-removal-checks.ts: targetRefusal: 8.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.admitted: 6.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.admit: 5.0
- src/accounts/organizations/directory-reads.ts: readDirectoryPages: 4.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 4.0
- src/accounts/organizations/membership-removal-lifetime.ts: membership-removal-lifetime\RemovalLifetime.finish: 4.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.activeMembershipsOf: 4.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.memberPage: 4.0
- src/app/logging-storage.ts: openLoggingStorage: 3.1
- src/accounts/organizations/change-records.ts: change-records\ChangeRecording.record: 3.0
- src/accounts/organizations/change-records.ts: change-records\ChangeRecording.recordingFailure: 3.0
- src/accounts/organizations/membership-removal-lifetime.ts: membership-removal-lifetime\RemovalLifetime.check: 3.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.currentMembership: 3.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.membershipsOf: 3.0
- src/accounts/organizations/change-records.ts: change-records\ChangeRecording.run: 2.0
- src/accounts/organizations/directory-reads.ts: latestOfEach: 2.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 2.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 2.0
- src/accounts/organizations/membership-removal-checks.ts: adminGrants: 2.0
- src/accounts/organizations/membership-removal-lifetime.ts: membership-removal-lifetime\RemovalLifetime.stop: 2.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.close: 2.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.remove: 2.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.member: 2.0
- src/logs/audit/pg-destination-settings-store.ts: pg-destination-settings-store\PgDestinationSettingsStore.: 2.0
- src/logs/audit/pg-destination-settings-store.ts: pg-destination-settings-store\PgDestinationSettingsStore.: 2.0
- src/logs/audit/pg-destination-settings-store.ts: pg-destination-settings-store\PgDestinationSettingsStore.: 2.0
- src/logs/audit/pg-destination-settings-store.ts: pg-destination-settings-store\PgDestinationSettingsStore.admitRemoval: 2.0
- src/logs/audit/pg-destination-settings-store.ts: pg-destination-settings-store\PgDestinationSettingsStore.completeRemoval: 2.0
- src/logs/audit/pg-destination-settings-store.ts: pg-destination-settings-store\PgDestinationSettingsStore.readRemoval: 2.0
- src/accounts/organizations/directory-reads.ts: invitationsOf: 1.0
- src/accounts/organizations/directory-reads.ts: membersOf: 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: (anonymous): 1.0
- src/accounts/organizations/membership-removal-checks.ts: currentAdmin: 1.0
- src/accounts/organizations/membership-removal-checks.ts: targetFacts: 1.0
- src/accounts/organizations/membership-removal-lifetime.ts: membership-removal-lifetime\RemovalLifetime.: 1.0
- src/accounts/organizations/membership-removal-lifetime.ts: membership-removal-lifetime\RemovalLifetime.: 1.0
- src/accounts/organizations/membership-removal-lifetime.ts: membership-removal-lifetime\RemovalLifetime.: 1.0
- src/accounts/organizations/membership-removal-lifetime.ts: membership-removal-lifetime\RemovalLifetime.admitting: 1.0
- src/accounts/organizations/membership-removal-lifetime.ts: membership-removal-lifetime\RemovalLifetime.run: 1.0
- src/accounts/organizations/membership-removal-lifetime.ts: membership-removal-lifetime\RemovalLifetime.wait: 1.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.: 1.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.: 1.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.: 1.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.: 1.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.: 1.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.: 1.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.: 1.0
- src/accounts/organizations/membership-removal.ts: membership-removal\MembershipRemoval.constructor: 1.0
- src/accounts/organizations/organization-administration.ts: (anonymous): 1.0
- src/accounts/organizations/organization-administration.ts: organization-administration\OrganizationAdministration.: 1.0
- src/accounts/organizations/organization-administration.ts: organization-administration\OrganizationAdministration.close: 1.0
- src/accounts/organizations/organization-administration.ts: organization-administration\OrganizationAdministration.constructor: 1.0
- src/accounts/organizations/organization-administration.ts: organization-administration\OrganizationAdministration.removeMember: 1.0
- src/accounts/providers/workos/workos-organizations.ts: readWhileActive: 1.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.: 1.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.: 1.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.: 1.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.: 1.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.: 1.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.: 1.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.grantsOf: 1.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.memberOf: 1.0
- src/accounts/providers/workos/workos-organizations.ts: workos-organizations\WorkOSOrganizations.organizationRoles: 1.0
- src/app/application.ts: (anonymous): 1.0
- src/app/application.ts: (anonymous): 1.0
- src/app/application.ts: (anonymous): 1.0
- src/app/application.ts: (anonymous): 1.0
- src/app/application.ts: composeHostedApplication: 1.0
- src/app/logging-storage.ts: composeLoggingStorage: 1.0
- src/logs/audit/pg-destination-settings-store.ts: (anonymous): 1.0
- src/logs/audit/pg-destination-settings-store.ts: openDestinationSettingsRuntime: 1.0
- src/logs/audit/pg-destination-settings-store.ts: removalOperation: 1.0

Metrics:
- Delta: goal miss
- Review: goal miss
- CRAP: passed
- Architecture: passed
- 15 findings on unchanged files, reason unchanged by this PR

Facts to declare:
- none

Declared facts:
- public_surface.between_packages.organizations: src/accounts/organizations/removal-operation-store.ts

Surface differences:
- src/index.ts (imports changed src/app/application.ts)
- src/accounts/organizations/administration-overviews.ts (imports changed src/accounts/organizations/directory-reads.ts)
- src/accounts/organizations/administration-overviews.ts (imports changed src/accounts/organizations/organization-directory.ts)
- src/accounts/organizations/change-records.ts
- src/accounts/organizations/customer-roles.ts (imports changed src/accounts/organizations/organization-directory.ts)
- src/accounts/organizations/organization-administration.ts
- src/accounts/organizations/organization-administration.ts (imports changed src/accounts/organizations/change-records.ts)
- src/accounts/organizations/organization-administration.ts (imports changed src/accounts/organizations/directory-reads.ts)
- src/accounts/organizations/organization-administration.ts (imports changed src/accounts/organizations/organization-directory.ts)
- src/accounts/organizations/organization-administration.ts (imports changed src/accounts/organizations/membership-removal.ts)
- src/accounts/organizations/organization-administration.ts (imports changed src/accounts/organizations/removal-operation-store.ts)
- src/accounts/organizations/organization-directory.ts
- src/accounts/organizations/removal-operation-store.ts

Informational:
- 49 public modules, 3 snapshots changed, 1 added
- declaration snapshot added: src/accounts/organizations/removal-operation-store.ts
- public module touched, declarations unchanged: src/index.ts (imports changed src/app/application.ts)
- public module touched, declarations unchanged: src/accounts/organizations/administration-overviews.ts (imports changed src/accounts/organizations/directory-reads.ts)
- public module touched, declarations unchanged: src/accounts/organizations/administration-overviews.ts (imports changed src/accounts/organizations/organization-directory.ts)
- public module touched, declarations unchanged: src/accounts/organizations/customer-roles.ts (imports changed src/accounts/organizations/organization-directory.ts)
- size.total_lines_note_above: 2474 lines without generated files, above the limit of 1500
- ratchet.maintainability_index.existing_file_drop_note_at: src/logs/audit/pg-destination-settings-store.ts: 53.641844103270124 to 46.31569984025012
- ratchet.review_findings_high: src/accounts/organizations/membership-removal-lifetime.ts: Maintainability too low: got 70 (min: 85)
- ratchet.review_findings_high: src/accounts/organizations/membership-removal.ts: Maintainability too low: got 43 (min: 85)
- ratchet.review_findings_high: src/logs/audit/pg-destination-settings-store.ts: Maintainability index: 54 -> 46 (below 85 is hard to maintain)

Notes:
- Local eligibility is preliminary. The manager or Delamain session must verify current local checks, holds, and required independent human approval.

Label:
`gh pr edit <n> --repo tomer-mayara/Thermus --add-label 'T2 Need architect' --remove-label 'T1 Team review' --remove-label 'T0 Auto merge'`
