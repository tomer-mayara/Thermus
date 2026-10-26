# Membership removal notices: current source review

Status: **source review and unapproved proposal, 26 October 2026**. This is no
legal opinion, owner approval, production proof or permission to publish. Source
review is pinned to commit `9f07c04bba0813358274212b21316165dc3e308b`, tree
`777542744c4cedf71e32c0cb38d88771df128f5f`. The [manifest](manifest.json)
records the relevant source-file hashes and all complete proposed document hashes.
Refresh this review if a later candidate changes these behaviors.

## Claims and source limits

| Proposed claim | Source and limit |
| --- | --- |
| Removal is limited to supported ordinary active User/Admin memberships and a current authorized Admin. | [Removal checks](../../../src/accounts/organizations/membership-removal-checks.ts) verify current actor and target, revision, management evidence, status and every grant. The [WorkOS adapter](../../../src/accounts/providers/workos/workos-organizations.ts) requires explicit ordinary-management evidence. Unknown or external management and unsupported grants are refused. No Directory Sync capability is added. |
| Another usable active Admin must remain; pending invitations do not count. | [Checks](../../../src/accounts/organizations/membership-removal-checks.ts) read complete safety facts and count active Admins with the required grants. R1 uses `memberFactsPage` for that scan and retains the direct-target read. Parallel external reductions remain an operator/IdP restriction, not an atomic WorkOS transaction guarantee. |
| Only the selected membership is deleted. Account, other memberships and existing factors remain. Rejoin uses a fresh invitation. | The [WorkOS adapter](../../../src/accounts/providers/workos/workos-organizations.ts) calls exact-ID membership deletion, not user or factor deletion. Invitation acceptance uses the new invitation's role. This source scope does not establish new live provider proof or live factor observation. |
| The next checked portal or MCP request uses current membership; self-removal can need sign-in or another workspace. | [WorkOS access](../../../src/accounts/providers/workos/workos-auth-provider.ts), [administration routes](../../../src/interfaces/web/account/administration-routes.ts) and [result notices](../../../src/interfaces/web/account/account-pages.ts) preserve current-access checks and navigation. Browser workspace selection does not move an existing MCP token to another organization. Deployed behavior remains a separate gate. |
| One durable current operation per organization prevents overlapping or repeated uncertain removals. | The [coordinator](../../../src/accounts/organizations/membership-removal.ts), [operation contract](../../../src/accounts/organizations/removal-operation-store.ts), [SQL store](../../../src/logs/audit/pg-destination-settings-store.ts) and [migration](../../../sql/migrations/20261025082850_membership_removal_operations.sql) own the fields named in Privacy. Only a terminal record can be replaced by admission. There is no automatic expiry, history, status API or background reconciliation worker. |
| An unconfirmed removal can have taken effect. A refresh cannot settle it or make replay safe. | [Removal lifetime](../../../src/accounts/organizations/membership-removal-lifetime.ts) and the [coordinator](../../../src/accounts/organizations/membership-removal.ts) preserve unknown results after uncertain admission, send or completion. A sent provider request can outlive local stop. The [runbook](../../implementation/admin-s2-5-02-removal-runbook.md) requires independent reconciliation, sender containment and an external restore hold. |
| Removal export omits form tokens and membership revisions. Export failure cannot undo or replay deletion. | [Checked routes](../../../src/interfaces/web/account/administration-routes.ts) use current trusted access. [Audit projection](../../../src/logs/audit/audit-event-projection.ts) selects actor, organization, exact target membership ID, action, outcome and time. The separate safety row contains a revision; the exported event does not. Missing logs prove no removal outcome. |
| Supported audit and synthetic Test events can include an optional actor display name, alongside stable identifiers. | [Request context](../../../src/accounts/identity/access-context.ts) keeps validated optional display data. [WorkOS access](../../../src/accounts/providers/workos/workos-auth-provider.ts) obtains available profile names; [MCP capture](../../../src/interfaces/mcp/fetch-tool-server.ts), [route capture](../../../src/interfaces/web/account/logging-routes.ts) and [projection](../../../src/logs/audit/audit-event-projection.ts) carry the trusted actor. [Name handling](../../../src/logs/audit/audit-content.ts) trims, bounds and pattern-redacts names and omits missing or invalid values. [OTLP encoding](../../../src/logs/audit/otlp-audit-encoding.ts) adds `actor.name` when valid, without replacing `actor.authority` or `actor.subject`. [Test service](../../../src/logs/audit/destination-settings-service.ts) carries the same optional name for the synthetic Test. There is no claim that names identify unique people or are always present. |
| The current portal offers Axiom or Custom and requires Bearer authentication. It can show a masked token prefix. | The [page](../../../src/interfaces/web/account/logging-page.ts) uses a hidden Bearer field. The [parser](../../../src/interfaces/web/account/logging-form.ts) refuses another authentication choice, requires 1–128 ASCII letters, digits or hyphens for an Axiom dataset, and accepts no nonempty Axiom dataset for Custom. The [service](../../../src/logs/audit/destination-settings-service.ts) preserves a blank token only for the same endpoint and exposes the first four token characters only when the saved token is longer than four characters. The current portal has no no-authentication or token-removal control. Legacy core storage support does not make one a portal feature. |
| Save and Test apply all submitted settings, including export enabled state. Test runs only after confirmed Save and can run while disabled. | The [route](../../../src/interfaces/web/account/logging-routes.ts) confirms Save before Test and records the two actions separately. Failed or unconfirmed Save sends no Test. The [service](../../../src/logs/audit/destination-settings-service.ts) matches saved revision, settings and credential, sends the synthetic event, then reads the revision again. [Result notices](../../../src/interfaces/web/account/logging-test-page.ts) state that saved settings remain after a Test failure or uncertain result. An uncertain Save can finish after a later read. Test proves neither continued delivery nor durable storage. |
| Removal-record retention serves safety and receives closure/deletion review. | The [SQL store](../../../src/logs/audit/pg-destination-settings-store.ts) keeps the current record until terminal replacement. Privacy retains reason/review-date handling for a specific closure/deletion exception. No automatic expiry, fixed provider purge deadline or new retention service is promised. |

## Complete-document changes

The immediate source is the complete unapproved 25 October removal package.
Terms and Privacy move the proposed effective date to 26 October. Privacy and
both help documents add the explicit optional actor-name fact from current
source. The agreement wording, version and hash stay unchanged. The complete
[current-published-to-proposed diff](current-published-changes.patch) compares
with approved and published Audit v3 from 24 October. The retained
[historical 23 October comparison](changes.patch) and
[immediate-successor diff](successor-changes.patch) provide the earlier comparison
and the small change from the 25 October proposal. Each patch shows every changed
byte in its compared documents. Earlier bundles and approval records remain
unchanged.

The separate [Audit v3 owner approval record](https://github.com/tomer-mayara/Thermus/blob/a7284b0c4dc02a8c7cd7958cfdc4a11ce4adee89/ast-report/s2-04-rollout/approvals/owner-approval.json)
identifies bundle `s204-organization-audit-proposal-2026-10-24-v3`, manifest
`9ff7e5f5fa48bad17dcf5cde7248aa226700e2b10f3eb9da26a1de42c6f90075`,
the 24 October effective date and the actual owner response “Approve package and
internal-org disposition”. Its approval covers the complete Audit v3 Terms,
Privacy and Audit help, public and runtime publication, existing internal-org
notice handling, selected Axiom export and no Slice 2 settings backups. It
preserves earlier agreements and claims no new signup acceptance. The current
published marketing revision is
[`654eebabb6465967edf8d4b0388708e6421f0691`](https://github.com/tomer-mayara/Thermus-Marketing/commit/654eebabb6465967edf8d4b0388708e6421f0691).
Its [Terms source](https://github.com/tomer-mayara/Thermus-Marketing/blob/654eebabb6465967edf8d4b0388708e6421f0691/src/content/legal/terms.md)
and [Privacy source](https://github.com/tomer-mayara/Thermus-Marketing/blob/654eebabb6465967edf8d4b0388708e6421f0691/src/content/legal/privacy.md)
byte-match the local Audit v3 comparison files. The publication reviewer confirmed
the four current direct/slash routes, same-host redirects and complete visible
text, links and table cells on 26 October. The current production Netlify deploy
is `6add7c13c11756b0e132e1f9`, published at `2026-10-25T03:48:54.178Z` from that
marketing revision. [Marketing PR 29 Validation](https://github.com/tomer-mayara/Thermus-Marketing/pull/29#issuecomment-6393114317)
retains publication evidence; its
[Quality review](https://github.com/tomer-mayara/Thermus-Marketing/pull/29#issuecomment-6393114438)
records unchanged legal hashes. HTML presentation is compared by complete visible
text and structure, not by treating HTML as the original Markdown bytes.
Local Audit v3 Terms and Privacy match the current published comparison hashes:
19,946 bytes and
`ce5f1afb9ac2759117b722a4d819b6207f23e2ff99f15d09a5abbd9e1b32eee3`;
35,098 bytes and
`692801219c0ac19c50300cd188cfd2ca55cb7e89caaba656269e484b44d4dcc6`.
The frozen proposal's original status and manifest history are not rewritten.
This prior approval does not approve the successor removal bytes or date.

The existing Terms/Privacy removal and audit disclosures remain consistent with
the reviewed source. This includes ordinary-membership scope, current authority,
last-Admin protection, no blind retry, private current-operation records,
input/result capture limits, pattern-based redaction, best-effort delivery,
destination copies, no audit history/replay and no settings backup/restore
service. The proposal adds no DPA, new legal role or basis, provider guarantee,
backup, deletion deadline, paid entitlement or new runtime capability.

The form, parser, route and Test-notice hashes still match the 25 October
proposal's source review. The settings-service hash changed because PR #256
added optional actor-name handling to synthetic Test. The new manifest pins the
current service and the other relevant source. A source comparison establishes
none of the current provider settings, destination retention/access, free
capacity, publication or deployed presentation facts; those need the scoped
release readbacks.

## Proposed decisions and integration limit

The [README](README.md) and [approval brief](approval-brief.md) propose one date,
current public-policy destinations, existing-organization notice handling and
full expandable in-app help. These decisions remain unapproved. Existing
acceptance metadata must be preserved. Publishing a notice or using sign-in,
an invitation or the service creates no renewed agreement record. No automatic
or repeated acceptance flow is proposed. The retained Terms rule for a separately
required notice or renewed agreement remains in force.

Current composition still selects the earlier Audit v3 source module. Current
Members and Audit pages do not load these Markdown files. The proposed full help
is not a byte-for-byte extraction of current short form helpers or result
notices. Runtime/help integration and actual user-visible readback are separate
work before release. Keep current controls and honest result guidance.

## Manual validation and policy scope

Check exact UTF-8 bytes, LF/final newline, versions/hashes, unchanged agreement,
preserved prior bundles, all three complete patches, relative links and source hash
provenance. Retain the manual record under `.cache/s25-release-20261026/`.
These are artifact checks, not executable prose tests, owner approval or live
proof. No test suite is selected for this document-only package.

Changed contract documents require at least T1 Team review. Production metrics
are N/A for this document-only part. The manager selects applicable checks,
habit-hooks, architecture/registry review and the tier for the complete candidate.
Source integration will select source tests and gates. Complete-candidate code
review, exact-byte notice approval, publication, production storage/capacity and
scoped deployed proof remain distinct release requirements.
