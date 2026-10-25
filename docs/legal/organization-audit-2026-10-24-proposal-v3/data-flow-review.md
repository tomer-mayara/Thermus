# Slice 2 proposed text: data-flow and change review

Status: source review only, 24 October 2026. This is not legal approval, a legal
opinion, production verification, or permission to publish. Source baseline:
`845cec3060b0880cd27c36047f1da57a1c3772ba`, plus the uncommitted direct-Axiom
implementation under manager review. The new configuration claims remain
subject to complete-candidate source verification. The
[S2 notice assessment](../../implementation/admin-s2-04-notice-review.md) gives the
release context. Paths below refer to that baseline or the identified source
candidate for the direct-Axiom addition.

| Claim | Source and scope |
| --- | --- |
| Defined tool-completion records omit input and content. | [Completion formatter](../../../src/interfaces/mcp/tool-completion-record.ts) emits operation, actor, organization, tool, outcome and duration. [Step records](../../../src/pipelines/execution/step-record.ts) remain defined metadata. These facts do not describe all logs. |
| Tool audit export captures input and the final public result or error. | [Audit projection](../../../src/logs/audit/audit-event-projection.ts) accepts validated fetch URL/reason or search query/reason and public result text with trusted context, outcome and duration. URLs can retain noncredential parameters and fragments. Invalid or unsupported captures can be omitted. |
| Redaction has limits; truncation affects only the audit copy. | [Capture owner](../../../src/logs/audit/audit-content.ts) recognizes selected credential fields and URL parameters; result/event byte limits are 65,536/131,072, with a marker and original/captured byte counts. Patterns cannot establish removal of every secret or personal detail. No sign-in form, cookie, Authorization-header or destination-token field exists in the [event contract](../../../src/logs/audit/audit-log.ts); free text can still repeat such information. |
| Only supported invitation and destination actions are described. | [Projection](../../../src/logs/audit/audit-event-projection.ts) allows invite/resend/revoke target email or invitation identifier and optional role; Save/Test contain action/outcome metadata, without endpoint or credential payload fields. No member removal, role change, or MFA claim is added. |
| One saved organization destination, optional Axiom dataset, and encrypted optional credential. | [SQL store](../../../src/logs/audit/pg-destination-settings-store.ts), [settings service](../../../src/logs/audit/destination-settings-service.ts), and [credential codec](../../../src/logs/audit/destination-credential-codec.ts). The current source candidate adds a saved optional Axiom dataset name, validated as 1–128 ASCII letters/digits/hyphens. [Sender validation](../../../src/logs/audit/public-audit-destination.ts) and the HTTPS request send it as `x-axiom-dataset`, including for Test. The schema stores settings, not audit history. Supabase is the selected settings provider in the [plan](../../design/organization-admin-plan.md#owner-setup-for-supabase--slice-2); actual configuration has a separate release gate. |
| Test is separate from Enable and storage proof. | [Current UI](../../../src/interfaces/web/account/logging-page.ts) and [settings service](../../../src/logs/audit/destination-settings-service.ts) use the saved revision and support disabled Test. [Test event contract](../../../src/logs/audit/audit-log.ts) includes organization/actor/time/revision. Test does not prove future delivery or durable receipt/storage. |
| Delivery is bounded and best effort. | [Collector](../../../src/logs/audit/audit-collector.ts) and [queue owner](../../../src/logs/audit/audit-collector-state.ts) hold pending events in process memory. Revision/enable checks, overload, expiry, outages and shutdown can discard work; retries can duplicate it. There is no durable queue, history or replay. |
| No settings backup or restore service in Slice 2. | The owner’s 24 October instruction moves backup, restore, retention, custody and key recovery to [Slice 4](../../design/organization-admin-plan.md#slice-4--settings-backup-and-recovery). The existing [recovery procedure](../../implementation/admin-s4-recovery.md) remains future-work reference, not an S2 prerequisite or a recovery promise. |
| Operator logs stay separate from customer export. | Existing Render 7-day accessible history and no configured stream are retained from the approved bundle's [dated readback](../organization-signup-2026-10-23/data-flow-review.md#production-readback--23-october-2026). The new text clarifies that the no-routine-export commitment refers to operator logs. It makes no new claim of physical erasure or provider residual-copy deletion. Refresh settings evidence before publication. |

## Preservation and limits

The source is the approved organization v2 bundle, not the earlier personal
bundle or a test fixture. Complete Terms and Privacy are copied with only the
changes in [changes.patch](changes.patch). The checkbox keeps its exact approved
bytes and version. Existing contact-form, marketing, sign-in, search, provider,
rights, and unrelated retention disclosures remain. The owner selected Axiom’s
`audit-log-test` dataset, confirmed that no Collector exists, and authorized the
direct-Axiom configuration. A later local production-sender canary reached the
selected Axiom dataset and the manager verified its marker in Axiom UI; see the
[S2-04 ledger](../../implementation/admin-s2-04.md#local-production-sender-to-the-selected-axiom-destination).
That observed receipt is not a deployed Admin/browser/MCP journey or approval of
these exact legal bytes. The effective date is a new
proposal and needs approval.

Terms changes are needed to remove the obsolete operator-logging statement and
to state the new optional export and destination responsibility in context.
Privacy and help alone would leave those Terms inconsistent. Existing
agreements do not automatically change; the owner must decide the required
existing-organization notice/agreement handling. This review invents no legal
basis, controller/processor allocation, DPA, new provider guarantee, new model
use, advertising use, security guarantee, backup/restore capability, or new retention period. Actual destination handling follows the selected Collector or supported OTLP service.

## Manual verification

Completed manual checks for this proposal:

- All four document hashes and byte counts match the manifest. The help
  paragraphs match the final source UI in order, with the dynamic token-presence
  prefix excluded and both alternatives recorded in provenance. Terms/Privacy
  hashes are unchanged by this refinement. Files use UTF-8,
  LF and final newlines. The checkbox equals the approved source byte-for-byte.
- Every file in the original approved package equals its baseline Git bytes.
- Applying `changes.patch` to the approved source reproduces both complete
  proposed documents and the complete static help exactly.
- All 144 relative file links in this package, the updated plan, notice
  review, database setup runbook, and rollout ledger resolve. The plan retains one continuous release-order table.
- Source review covers event fields, redaction/size claims, Test, settings and
  event lifetime. No new numerical backup retention or cadence remains in the
  proposed public text.
- Whitespace checks pass for the changed plan, notice review, and database
  setup runbook. Exact legal
  copies retain approved Markdown hard breaks; patch context retains prefixes.

No executable test is added for these document changes. Public publication/readback
and deployed in-app presentation remain unverified. Local source presentation has
been checked. The concise static help mirrors the source candidate identified by its SHA-256
in manifest provenance; the UI does not load the Markdown copy. Focused source
BDD/TDD results belong to the Axiom implementation agent and are not claimed as
this document task’s test run.

The manager records completed checks and finishes complete-candidate metrics,
Habit Hooks, registry/impact review, classification, and required human approval.
This part changes contract documents and therefore
requires at least T1 Team review under current policy; independent human approval
of the actual committed candidate and separate exact-byte legal approval remain
required. Source-only production metrics are N/A for this document-only part.
