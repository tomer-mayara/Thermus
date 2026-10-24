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
now identifies a deployed S1 candidate; runtime release/cutover still has its own
holds. The Staging record describes its observation time. The old personal
bundle is a different frozen source and is not the organization approval basis.

## Current Slice 2 facts to disclose

| Topic | Candidate behavior and evidence | Difference to review before rollout |
| --- | --- | --- |
| Operator records | [Tool completion records](../../src/interfaces/mcp/tool-completion-record.ts) omit tool URL, query, reason, and result content. [Step records](../../src/pipelines/execution/step-record.ts) remain defined metadata. Other infrastructure/error output has its own behavior. | Approved Privacy sections 2 and 6 describe fetch completion records with URL origin/path and full valid reason. Update only claims proved for the changed defined records; do not promise all logs are content-free. |
| Customer tool audit events | [Audit projection](../../src/logs/audit/audit-event-projection.ts) captures validated fetch URL/reason or search query/reason and the final public result, plus trusted organization, actor, operation, outcome, duration, and time. [Capture bounds](../../src/logs/audit/audit-content.ts) limit result text to 65,536 bytes and serialized events to 131,072 bytes. | Explain optional organization-controlled input/result export, including returned content. This is distinct from internal operator logs. The full validated URL may include noncredential query fields and fragments. |
| Recognized redaction | The capture owner replaces recognized credential fields and selected URL credential parameters. It adds `[TRUNCATED]` and byte metadata when it truncates an exported result copy. | Redaction is pattern-based, with no guarantee that every secret, personal detail, or confidential value is removed. Truncation affects the exported copy, not the product result. Keep the existing restrictions on submitted sensitive data. |
| Administration | [Projection](../../src/logs/audit/audit-event-projection.ts) exports invite/resend/revoke target email or invitation ID, optional role, outcome, actor, organization, and time. Destination Save/Test events contain action/outcome metadata and no endpoint or credential. | Describe target identifiers and email where applicable. Add no member removal or role-change feature claim. |
| Enable, destination and Test | The Admin settings flow stores one organization destination and an optional encrypted Bearer credential. Test sends one synthetic event for the saved revision and can run while disabled. Enable is separate. | Explain Admin control, destination responsibility, saved credentials, and that Test proves neither future delivery nor durable receipt/storage. |
| Storage and recipients | PostgreSQL stores only destination settings, revisions, enabled state and encrypted optional credentials in the private schema. Pending customer events live only in bounded process memory. OTLP export goes to the Admin's saved HTTPS Collector. | Review Supabase as the settings provider and the selected organization Collector as recipient. Disclose the scoped encrypted backup and separate key recovery process after the owner selects actual retention and storage. Do not describe a durable Thermus audit archive. |
| Loss, retries and retention | [Collector](../../src/logs/audit/audit-collector.ts) admits bounded best-effort work, checks current saved revision before attempts, and drops work on overload, expiry, disable, stale state, outage or shutdown. Eligible retries can duplicate events. | Explain loss/duplicates and lack of replay/history. Collector retention, access and onward export follow the destination's configuration/policies. Keep Thermus operator-log retention separate; a customer stream does not establish routine operator-log export. |

The existing legal wording about Render operator logs, recipient processing, data
rights, and retention needs a complete review with these changes. Current source
alone cannot establish actual Collector policy, backup destination/retention,
provider contract, or a legal basis. No new DPA, legal role, retention promise,
provider guarantee, or customer agreement is inferred here.

## Concrete owner work still pending

1. Select backup storage, custody and retention under the
   [recovery procedure](admin-s2-04.md#choose-the-backup-owner-and-storage). Confirm
   the actual current provider and Collector setup and $0 headroom.
2. Prepare a complete proposed organization Terms/Privacy/help bundle from the
   approved source. Include the facts above in context and preserve unrelated
   terms. Assign new versions and hashes for changed bytes. Keep the approved
   bundle immutable. If the effective date or publication scope changes, include
   it in the new owner decision.
3. Obtain explicit owner approval of the complete bytes, data flows, retention,
   versions/hashes and publication/runtime scope. Record separate approval
   evidence. This factual review supplies no approval.
4. Verify the approved public and in-app presentation, readable document links,
   Audit logs help, and recorded agreement versions as applicable. Retain actual
   deployed evidence. Clear Slice 1 runtime and remaining S2-04 holds before
   releasing Slice 2.
