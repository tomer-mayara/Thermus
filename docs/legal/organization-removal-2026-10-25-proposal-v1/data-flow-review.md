# Ordinary membership removal proposal: source and change review

Status: source review, 25 October 2026. This is no legal opinion, owner approval,
production proof, or permission to publish. The comparison starts from current
parent `2271545702a8f1ec28c6f7dd913fec7024ecadeb` and the retained audit v3 bundle.
The manager must refresh this assessment if the complete candidate changes the
contracts. Exact proposed public bytes and prior hashes are in the
[manifest](manifest.json); the complete text delta is [changes.patch](changes.patch).

| Proposed claim | Source and limit |
| --- | --- |
| Only ordinary active supported User/Admin memberships can be removed; the current actor must be an Admin. | [Checks](../../../src/accounts/organizations/membership-removal-checks.ts) validate actor, organization, exact target, revision, management evidence, status, and every grant after admission. Current pages must agree with the direct target read. Unknown or extra roles and external/unknown management are refused. [WorkOS adapter](../../../src/accounts/providers/workos/workos-organizations.ts) accepts only explicit `directoryManaged: false` as ordinary. No new directory capability is promised. |
| The last usable active Admin is kept; pending invitations do not count. | [Checks](../../../src/accounts/organizations/membership-removal-checks.ts) count active members with Admin grants and required permissions. Pending/inactive members and invitations do not satisfy that rule. Parallel external reductions remain an operator/IdP restriction, not an atomic WorkOS transaction guarantee. |
| Exact membership deletion preserves account, other memberships, and factors; return uses a fresh invitation. | [Directory contract](../../../src/accounts/organizations/organization-directory.ts) exposes exact-ID membership deletion. [WorkOS adapter](../../../src/accounts/providers/workos/workos-organizations.ts) calls only membership deletion; it invokes no user/factor delete. Invitation acceptance grants only the invitation's role. This source scope is not a new live provider result. Live account/other-membership preservation and rejoin need the S2.5-02 proof. Existing-factor live observation is limited to already available confirmed free scope; synthetic sentinels do not prove a live factor guarantee. |
| Current access is checked again, including after self-removal. | [Current access](../../../src/accounts/providers/workos/workos-auth-provider.ts), [administration routes](../../../src/interfaces/web/account/administration-routes.ts), and [result notices](../../../src/interfaces/web/account/account-pages.ts) retain organization checks and navigation to selection/sign-in. Browser selection does not move an existing MCP token to another organization. Actual deployed session and portal/MCP behavior remains a separate gate. |
| One durable operation per organization holds unknown effects without automatic expiry. | [Owner](../../../src/accounts/organizations/membership-removal.ts), [operation contract](../../../src/accounts/organizations/removal-operation-store.ts), [SQL store](../../../src/logs/audit/pg-destination-settings-store.ts), and [migration](../../../sql/migrations/20261025082850_membership_removal_operations.sql) store exactly the fields named in Privacy. Only terminal records can be replaced by admission. This table is not an audit history. Current reads do not settle a pending operation; no lease, worker, or status API exists. |
| Unknown means possible effect; no blind retry. | [Lifetime](../../../src/accounts/organizations/membership-removal-lifetime.ts) and [owner](../../../src/accounts/organizations/membership-removal.ts) return unknown after uncertain admission/send/completion. A terminal readback must match the exact operation and outcome. A provider call already sent can outlive local stop; a current unchanged or missing membership cannot prove its future effect. [Runbook](../../implementation/admin-s2-5-02-removal-runbook.md) requires independent reconciliation and an external restore privilege hold. |
| Removal Audit fields omit form token and membership revision; export cannot undo or replay deletion. | [Checked route](../../../src/interfaces/web/account/administration-routes.ts) chooses the trusted tenant from current access, not the submitted organization. [Projection](../../../src/logs/audit/audit-event-projection.ts) exports actor, organization, exact membership ID, action, outcome, and time. [Change recording](../../../src/accounts/organizations/change-records.ts) and capture use safe sinks. The durable operation record separately stores a revision; that is not an exported event field. Missing logs prove no outcome. |
| Current portal uses Axiom or Custom with Bearer; Test saves first, including enabled state. | [Form UI](../../../src/interfaces/web/account/logging-page.ts) hides the authentication field as Bearer and shows a masked preview that can include the first four token characters. [Form parser](../../../src/interfaces/web/account/logging-form.ts) refuses other authentication values, requires an Axiom dataset for Axiom and none for Custom. [Route](../../../src/interfaces/web/account/logging-routes.ts) confirms Save before Test and records each action; unconfirmed/failed Save sends no Test. [Notices](../../../src/interfaces/web/account/logging-test-page.ts) distinguish saved settings from a Test outcome. [Service](../../../src/logs/audit/destination-settings-service.ts) matches the saved revision and token; a Test failure does not roll back that earlier Save. Core legacy storage support for no-auth settings is not a current portal control. Source hashes are in manifest provenance; deployed presentation is not claimed. |
| Password-only access has no removal MFA or paid-feature dependency. | The [removal checks](../../../src/accounts/organizations/membership-removal-checks.ts) and [owner](../../../src/accounts/organizations/membership-removal.ts) use authority and membership/store facts. They enroll, read, or delete no factor. Existing password access remains separate. This is no claim about MFA feasibility, provider entitlements, or new SSO, Directory Sync, or WorkOS Audit Logs support. |
| Removal data retention is a specific safety purpose, not indefinite audit history. | The [SQL store](../../../src/logs/audit/pg-destination-settings-store.ts) retains the current row until terminal replacement. There is no automatic cleanup/expiry. Privacy describes the actual unresolved hold and requires a reason/review date for a retained exception at closure/deletion review. The operator must not erase unresolved safety evidence to claim request completion. Owner/legal review remains required; no fixed provider purge deadline or new retention service is invented. |

## Preservation and consistency

This is a complete successor proposal to the current unapproved audit v3 bundle,
not an amendment to frozen bytes or an assertion that v3 was approved. Terms and
Privacy changes are narrow and explicit in the patch. Review revision 2 removes
the remaining no-member-removal statement in Terms section 2 and keeps the
no-role-editor and out-of-scope-contact limits. The proposed public documents
have no stale invitation-only or no-member-removal claim; retained before-text
in the patch and descriptions of the still-selected older runtime bundle remain
historical comparison evidence. The agreement remains the
exact earlier organization v2 wording and version. Existing contact, marketing,
fetch/search, provider, rights, and unrelated retention disclosures remain.

The new durable removal record makes the older Supabase-settings-only disclosure
incomplete. This proposal therefore updates the essentials, provider entry,
purpose, fields, and retention row as well as the no-removal sentence and export
metadata. It invents no DPA, legal basis, new controller/processor allocation,
provider guarantee, backup, deletion deadline, or additional paid entitlement.

Audit help is complete proposed help, reviewed against the current Axiom/Custom
form and save-before-Test route. It adds removal metadata and corrects inherited
no-authentication and Test-does-not-save wording. Both choices require Bearer;
Axiom requires a dataset and Custom does not accept one. Save and Test apply the
export switch. The masked preview can show the first four token characters.
Privacy now describes the same actual form/Test behavior. Other tool-capture,
redaction, byte-limit, bounded-memory, loss/duplicate, no-backup, and recipient
claims remain consistent with the current source contracts. This help is not a
byte-for-byte UI extraction; current source hashes are in manifest provenance.
Members help is new complete proposed copy with no claim of an existing source
mirror. Placement and exact deployed rendering need a separate owner decision
and source integration.

## Manual checks and release limits

The document worker checks byte counts/hashes, UTF-8/LF/final-newline format,
unchanged agreement and prior frozen package bytes, patch reproduction, relative
file links, and whitespace. Safe local evidence is retained under
`.cache/s25-02/docs/`. These are manual artifact checks, not executable tests of
prose, legal approval, or deployed presentation. The manager records final
candidate validation and evidence links that reviewers can access.

This document-only part changes contract documents and requires at least
T1 Team review under current policy. The complete candidate can require a higher
tier. Production metrics are N/A for this part; the manager selects all applicable
gates, Habit Hooks, architecture/registry review, and classification for the
complete candidate. Earlier S2-04 release and exact-byte owner approval,
publication, actual in-app presentation/agreement recording, current capacity,
and scoped live provider proof remain release holds until separately proved.
