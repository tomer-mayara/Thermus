# Slice 2 notice and help review

Status: source review for the S2-04 development candidate, 24 October 2026.
This record identifies disclosure work for owner approval. It does not approve
legal wording, replace an approved notice, or authorize publication or rollout.

The complete organization version 2 package was approved at
`2026-10-23T19:45:23Z`. Its public policies were published and verified; see
[Staging release verification](admin-s1-staging-release-verification.md). The
[approved package](../legal/organization-signup-2026-10-23/README.md), exact bytes,
manifest, historical data-flow review, and separate approval record remain
unchanged. A fresh Render readback in the [S2-04 record](admin-s2-04.md#evidence-and-release-holds)
now identifies deployed approved main `845cec3060b0880cd27c36047f1da57a1c3772ba`;
the new direct-Axiom candidate and proposed notice are not deployed. Runtime
release/cutover still has its own holds. The Staging record describes its observation time. The old personal
bundle is a different frozen source and is not the organization approval basis.

## Current Slice 2 facts to disclose

| Topic | Candidate behavior and evidence | Difference to review before rollout |
| --- | --- | --- |
| Operator records | [Tool completion records](../../src/interfaces/mcp/tool-completion-record.ts) omit tool URL, query, reason, and result content. [Step records](../../src/pipelines/execution/step-record.ts) remain defined metadata. Other infrastructure/error output has its own behavior. | Approved Privacy sections 2 and 6 describe fetch completion records with URL origin/path and full valid reason. Update only claims proved for the changed defined records; do not promise all logs are content-free. |
| Customer tool audit events | [Audit projection](../../src/logs/audit/audit-event-projection.ts) captures validated fetch URL/reason or search query/reason and the final public result, plus trusted organization, actor, operation, outcome, duration, and time. [Capture bounds](../../src/logs/audit/audit-content.ts) limit result text to 65,536 bytes and serialized events to 131,072 bytes. | Explain optional organization-controlled input/result export, including returned content. This is distinct from internal operator logs. The full validated URL may include noncredential query fields and fragments. |
| Recognized redaction | The capture owner replaces recognized credential fields and selected URL credential parameters. It adds `[TRUNCATED]` and byte metadata when it truncates an exported result copy. | Redaction is pattern-based, with no guarantee that every secret, personal detail, or confidential value is removed. Truncation affects the exported copy, not the product result. Keep the existing restrictions on submitted sensitive data. |
| Administration | [Projection](../../src/logs/audit/audit-event-projection.ts) exports invite/resend/revoke target email or invitation ID, optional role, outcome, actor, organization, and time. Destination Save/Test events contain action/outcome metadata and no endpoint, dataset name, or credential. | Describe target identifiers and email where applicable. Add no member removal or role-change feature claim. |
| Enable, destination and Test | The Admin settings flow stores one organization destination, an optional Axiom dataset name, and an optional encrypted Bearer credential. Test sends one synthetic event for the saved revision and can run while disabled. Enable is separate. | Explain Admin control, destination responsibility, saved credentials, and that Test proves neither future delivery nor durable receipt/storage. |
| Storage and recipients | PostgreSQL stores only destination settings, revisions, enabled state and encrypted optional credentials in the private schema. Pending customer events live only in bounded process memory. OTLP export goes to the Admin's saved HTTPS Collector or supported OTLP service. Direct Axiom sends the saved dataset name as `x-axiom-dataset`, with the full logs URL and Bearer token. | Review Supabase as the settings provider and the selected organization Collector or supported OTLP service as recipient, including Axiom when selected. The owner moved settings backup, retention/custody, key recovery and restore to future Slice 4 on 24 October 2026. Slice 2 runs without settings backup/restore; loss can require Admin re-entry. Do not describe a durable Thermus audit archive or promise provider recovery. |
| Loss, retries and retention | [Collector](../../src/logs/audit/audit-collector.ts) admits bounded best-effort work, checks current saved revision before attempts, and drops work on overload, expiry, disable, stale state, outage or shutdown. Eligible retries can duplicate events. | Explain loss/duplicates and lack of replay/history. Destination retention, access and onward export follow the destination's configuration/policies. Keep Thermus operator-log retention separate; a customer stream does not establish routine operator-log export. |

The existing legal wording about Render operator logs, recipient processing, data
rights, and retention needs a complete review with these changes. Current source
alone cannot establish actual destination policy, provider contract, or a legal
basis. The owner chose the Axiom `audit-log-test` dataset, confirmed that no
Collector exists, and authorized narrow direct Axiom support. Its optional dataset
field accepts 1–128 ASCII letters/digits/hyphens and supplies the routing header;
it adds no arbitrary-header editor or universal-provider guarantee. The web stream
URL alone does not establish a compatible ingest endpoint or successful delivery.
The later local production-sender canary did reach Axiom and its marker was
verified in the Axiom UI; this is not deployed Admin/browser/MCP proof. The
[S2-04 ledger](admin-s2-04.md#local-production-sender-to-the-selected-axiom-destination)
records the time, destination, marker and remaining scope. No new DPA, legal role, retention promise,
provider guarantee, or customer agreement is inferred here.

## Owner review and remaining work

1. Apply the owner’s 24 October scope: run Slice 2 without settings backups.
   [Slice 4](../design/organization-admin-plan.md#slice-4--settings-backup-and-recovery)
   owns backup storage/custody/retention, key recovery, and restore. The [recovery procedure](admin-s4-recovery.md) is future reference, not an S2 prerequisite. Confirm actual
   current provider and direct Axiom setup and $0 headroom.
2. The complete proposed organization Terms/Privacy/help bundle is prepared from
   the approved source, with unrelated terms retained and new versions/hashes
   assigned to changed legal bytes. Unmerged runtime and Marketing draft source
   candidates are prepared for review. The approved bundle remains unchanged.
   If the effective date or publication scope changes, include it in the new
   owner decision.
3. Obtain explicit owner approval of the complete bytes, data flows, no-backup scope,
   versions/hashes and publication/runtime scope. Record separate approval
   evidence. This factual review supplies no approval.
4. Verify the approved public and in-app presentation, readable document links,
   Audit logs help, and recorded agreement versions as applicable. Retain actual
   deployed evidence. Clear Slice 1 runtime and remaining S2-04 holds before
   releasing Slice 2.


## Complete proposal for owner review

The [version 3 complete proposal](../legal/organization-audit-2026-10-24-proposal-v3/README.md)
contains complete Terms, Privacy, unchanged checkbox wording, proposed Audit logs
help, exact versions/hashes, a source diff, and a data-flow review. It implements
the owner’s no-backup Slice 2 decision and narrow direct-Axiom addition. The previous approved package is
unchanged. The proposal remains unapproved and supplies no publication or
deployment authority. The proposed Terms include narrow corrections for the
obsolete operator-log statement and optional export/destination responsibility;
Privacy and help alone would leave those claims inconsistent.
