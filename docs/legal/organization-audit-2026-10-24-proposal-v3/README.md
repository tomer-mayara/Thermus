# Proposed organization audit notice and help

Status: unapproved complete review candidate, 24 October 2026. Runtime and
public-page source changes are prepared in unmerged draft candidates for review.
Do not deploy or publish this bundle, or treat this draft as owner approval. The
owner must first confirm current provider and destination facts and approve the
complete bytes, versions, hashes, effective date, and execution scope.

Read the complete [Terms](terms.md), [Privacy Policy](privacy.md), unchanged
[agreement checkbox](agreement.txt), and proposed complete [Audit logs help](audit-help.md).
The [manifest](manifest.json) records exact UTF-8 bytes and SHA-256 review hashes.
The [diff](changes.patch) adds the complete proposed static help and shows every
Terms/Privacy change from the approved
[organization version 2 source](../organization-signup-2026-10-23/README.md).
The [data-flow review](data-flow-review.md) maps claims to source and states the
limits of this review. The old approved bundle, manifest, and approval record
remain unchanged.

## Proposed changes

This revision supersedes the earlier unapproved v2 review hashes. Its manifest
retains those superseded hash values as history; they are not approval evidence.

The proposed Terms include narrow changes as well as Privacy and help. Approved Terms section 2
says that request reasons and URL paths enter operator logs. The defined records
now omit them. Section 1 adds the Admin's audit-destination function. Section 5
states the optional input/result export permission, destination responsibility,
and loss/history limits. Section 6 names the settings provider and selected
audit destination. Fees, liability, jurisdiction, existing agreement rules, and unrelated
terms stay the same. This is no new DPA or provider contract.

Privacy updates the essentials, service scope, role description, fetch-reason
handling, and defined operator-record claims. It adds a separate audit-export
section for input/result content, identifiers, supported invitation and Save/Test
actions, recognized redaction, byte limits, Test, settings, loss, and duplicates.
It names Supabase and the selected organization audit destination and separates their
handling from operator logs. The retention table separates settings, pending
events, and destination copies. It states that Thermus provides no settings backup
or restore service. Existing restrictions
on secrets, sensitive data, and confidential information stay in force.

Help mirrors the concise static paragraphs in the final source UI: introduction,
six export-help paragraphs, connection, dataset and token helpers, and two Test
paragraphs. The Privacy Policy retains the detailed data and storage disclosures.
Placement headings separate form and Test help in this review file; controls and
the dynamic token-presence prefix are outside its scope. Both exact presence
alternatives and the source SHA-256 are recorded in manifest provenance. The UI
keeps its own source text; it does not load this Markdown file. Terms and Privacy
bytes are unchanged by this help review refinement.

The agreement checkbox is byte-for-byte unchanged and keeps its approved version.
Terms, Privacy, help, and the combined bundle use new versions. A new date or any
changed byte needs revised versions and hashes and new owner approval.

## Owner decisions before final approval

On 24 October 2026, the owner instructed: “Let's move backups to a new Slice 4 -
run slice 2 with no backup”. This draft therefore makes no backup cadence,
retention, storage, custody, or key-recovery promise. Backup and restore work
belongs to the future Slice 4. It is not a Slice 2 release prerequisite. The
proposed Privacy and help state the current absence of a settings backup/restore
service and the possible need for an Admin to re-enter settings and credentials
after loss. Pending audit events still have no archive, history, or replay.
Provider residual-copy disclosures are retained and do not promise recovery.

The owner confirmed that no Collector exists and authorized direct Axiom support
for the `audit-log-test` dataset. This revision adds a selected Collector or
supported OTLP service as recipient, including direct Axiom. An optional dataset
field accepts 1–128 ASCII letters, digits, or hyphens; the saved value becomes the
`x-axiom-dataset` routing header on Test and export, with the existing full HTTPS
logs URL and Bearer token. The dataset name is stored with destination settings,
not in the audit event payload. A web stream page is not the ingest URL. Actual
selected transport and one receipt are now proved by the local production
sender canary and manager Axiom UI check in the [S2-04 ledger](../../implementation/admin-s2-04.md#local-production-sender-to-the-selected-axiom-destination).
That is not a deployed Admin/browser/MCP journey. Full deployed proof remains a
rollout check; no support for all providers is promised.

The owner must approve the complete new Terms/Privacy/help bytes, versions,
hashes, effective date, and publication/runtime scope. Confirm current provider
and destination facts and recipient retention/access/onward sharing before
publication. The proposed date is 24 October 2026. If publication/opening is
later, revise the dates, changed versions and hashes, then seek approval again.
The existing Terms say that posting terms, signing in, or accepting an invitation
does not itself replace an existing agreement. The owner must decide any
required existing-organization notice/agreement handling. This proposal does not
claim new consent or rewrite earlier acceptance evidence.

Approval should cover these exact complete files and the manifest; public policy
publication; hosted signup presentation and agreement-version recording; visible
Audit logs help with the optional Axiom dataset field; the actual data flows and no-backup scope; and any selected
existing-organization process. Approval does not replace the remaining S1/S2
deployed verification and release checks in the rollout ledger.

## Prepared source and work after exact-byte approval

Runtime integration is prepared in unmerged [PR #248](https://github.com/tomer-mayara/Thermus/pull/248).
The earlier approved module remains unchanged. The new frozen
`workos-organization-audit-documents.ts` contains the candidate bytes, and
`hosted-workos-application.ts` selects it. Its purpose remains
`organization-creation`. Focused checks cover exact bytes, versions, rendered
signup, recorded legal identifiers, and the unchanged approved source. The
[implementation record](../../implementation/admin-s2-04-runtime-notice.md) retains
those results. The manager recorded passing final ordinary, type, portal,
Linux AMD64 image (7/7), and hosted-live (28/28) checks, with inputs unchanged
during each run. Complete-candidate metrics and required human approval remain
pending. Deployment and deployed presentation verification remain separate.

Audit logs help is hardcoded in
`src/interfaces/web/account/logging-page.ts`. The source candidate now contains
the concise text mirrored here, with its own focused specifications. Verify its
exact deployed presentation after approval. Environment variables cannot replace
either the in-app legal bundle or that help.

Matching public-page changes are prepared in draft
[Marketing PR #27](https://github.com/tomer-mayara/Thermus-Marketing/pull/27), head
`1cd32b128698b95f624f0fed15ca3c58d95a62d0`. Its Markdown copies match the proposal
exactly; local rendering and desktop/mobile checks passed. After approval, publish
and verify direct and slash policy URLs, redirects, readable presentation, and
version/hash evidence. Verify actual in-app presentation and agreement recording
as applicable to the selected rollout. Existing-organization handling remains an
owner decision. The proposed bundle has not been published or deployed.
