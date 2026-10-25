# S2-04 internal rollout — complete

Completed on 24 October 2026 (America/Denver). This is the current release record for the existing Thermus AI organization. The owner approved the exact candidate, complete legal package, internal-organization disposition, and scoped Axiom token. Earlier preparation and Mac-lock records remain as history.

Thermus PR #248 merged approved candidate `85206b1c` as `a7411fd0`. Render deployment `dep-dbelpffb9u1s73a5l5bg` is live on that merge. Its tree matches the approved candidate. The required local checks, source review, metric dispositions and human approval remain linked in the maintained PR comments; no source changed during this rollout.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Saved settings and restart | The disabled revision and encrypted token persisted through an observed Render service restart. | [Persistence](persistence-after-restart.json) |
| Saved Test after restart | The deployed app accepted Test. Axiom received the correct saved revision, actor and organization. Test left export disabled and the revision unchanged. | [Test receipt](axiom-production-test-receipt.json) |
| Enabled MCP export | The client succeeded. Axiom received the same complete 1,341-byte result, with the selected harmless reason and correct identity. | [Receipt comparison](receipt-verification.json), [call results](mcp-canary-summary.json) |
| Admin export | One unchanged Save reached Axiom with action save and outcome unchanged. The enabled revision stayed `e822382d-cacb-46a2-9294-11f634822f42`. | [Admin receipt](axiom-production-admin-receipt.json), [final settings](enabled-settings-final.json) |
| System separation | All nine completion/pipeline records in the selected interval contained metadata. The matching operation was present; canary reason and result content were absent. | [System evidence and limits](system-log-separation.json) |
| Product health | Health returned HTTP 200 and `ok\n`. | [Health](health-final.json) |
| Automatic deployment | Render readback is autoDeploy yes, trigger commit, branch main. | [Auto-deploy](render-auto-deploy.json) |
| Notice and public copy | The complete approved public Terms/Privacy and captured runtime Privacy/help matched. Marketing PR #28 deployed the reviewed guide corrections; public homepage and copied starter matched. | [Initial public verification](../public-notices-verification.json), [runtime content](../deployed-notice-capture-verification.json), [copy publication](marketing-publication-verification.json) |

Audit export remains enabled for `audit-log-test`. Its token can ingest only to that dataset; it cannot read data or access System datasets. It is encrypted in Thermus and stored in the authorized local configuration with mode 0600. No credential value is in this record.

No new paid resource was created. The capacity proof is a small canary, not a broad load forecast. The safe actual-pool probe proves bounded acquisition and simultaneous MCP availability in an isolated local composition; it did not interrupt the shared database. See the [full proof](../real-pool-acquisition-proof.json).

The deployed UI used the existing Admin. User/forged-tenant refusals and mobile behavior remain covered by retained final-source checks; this record does not claim new production negative checks or mobile interaction. Earlier agreement records remain intact. Owner-approved S1 limitations are retained, including the deferred mailbox/password-reset/consumer-address checks.

The direct public Markdown readback was blocked: Cloudflare returned 403/error 1010 to the automated request, and Brave showed ERR_BLOCKED_BY_CLIENT for direct Markdown navigation. No protection was bypassed. The published homepage, copied starter, complete legal content, local build, and exact production Git deployment were verified. Direct Markdown access remains an evidence limit, separate from the completed Audit runtime journey.

Delivery remains best effort, with possible loss or duplicates and bounded content. Thermus has no Audit history or replay. Settings backups and recovery remain in Slice 4, as the owner requested.

The [complete release facts](release-complete.json) give exact revisions, scope and limits. The maintained PR #248 Validation and Quality review comments supersede the dated preparation ledger. No new production organization or membership change was needed.

