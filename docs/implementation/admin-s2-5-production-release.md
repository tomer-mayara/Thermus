# Slice 2.5 production release checkpoint

Status on **26 October 2026**: the complete Slice 2.5 stack is merged. Production
removal release is still pending. This checkpoint supersedes older pending-stack,
approval and earlier S2-04 release statements in the
[implementation history](admin-s2-5-02.md) and
[removal runbook](admin-s2-5-02-removal-runbook.md). It preserves their procedures,
test provenance and dated limits.

## Accepted work and current deployment

PRs [#251](https://github.com/tomer-mayara/Thermus/pull/251),
[#253](https://github.com/tomer-mayara/Thermus/pull/253),
[#254](https://github.com/tomer-mayara/Thermus/pull/254),
[#255](https://github.com/tomer-mayara/Thermus/pull/255) and
[#257](https://github.com/tomer-mayara/Thermus/pull/257) are merged into main
`9f07c04bba0813358274212b21316165dc3e308b`. Its tree matches the tested final R1
candidate. The user confirmed architect approval of the original complete stack
and waived the separate identity-recording requirement. The latest
user instruction explicitly authorizes merge and deployment work. Those items
are closed for that stack; they do not approve a later changed source candidate
or new legal bytes. [PR #257 Validation](https://github.com/tomer-mayara/Thermus/pull/257#issuecomment-6403840671)
and [Quality review](https://github.com/tomer-mayara/Thermus/pull/257#issuecomment-6403840871)
retain candidate checks and reconciliation.

Render still runs commit `8c6d204e8588a664438ba8934ab36670b802525f`, deployment
`dep-dbfcrtajnfac73ekqqs0`. Automatic deployment is off (`autoDeploy: no`). The
merged removal candidate has not been deployed. Keep intermediate source and
settings changes from starting an unintended deployment.

## Earlier S2-04 release is complete

The approved internal Thermus AI S2-04 rollout completed on 24 October in
America/Denver, at `2026-10-25T02:58:27.680Z`. Its
[immutable final facts](https://github.com/tomer-mayara/Thermus/blob/b6f6f65c5884510e028a32470fe6904fdb060e09/ast-report/s2-04-rollout/postmerge/release-complete.json)
confirm actual restart persistence, accepted/received Test, exact MCP and Admin
receipts, current authority, System-log separation and approved notices. The
[owner approval](https://github.com/tomer-mayara/Thermus/blob/a7284b0c4dc02a8c7cd7958cfdc4a11ce4adee89/ast-report/s2-04-rollout/approvals/owner-approval.json)
covers Audit v3, the existing internal organization's notice disposition and the
scoped nonexpiring Axiom token. The maintained
[PR #248 Validation](https://github.com/tomer-mayara/Thermus/pull/248#issuecomment-6390817756)
and [Quality review](https://github.com/tomer-mayara/Thermus/pull/248#issuecomment-6390817906)
record the completed rollout and its explicit limits. Do not reopen those gates
from the dated preparation ledger.

Audit v3 Terms, Privacy and help were approved; complete Terms/Privacy were
published. The current published marketing revision is
[`654eebabb6465967edf8d4b0388708e6421f0691`](https://github.com/tomer-mayara/Thermus-Marketing/commit/654eebabb6465967edf8d4b0388708e6421f0691).
Earlier agreement evidence remains intact. The owner-accepted native invitation
limits and deferred mailbox/password-reset/consumer checks retain their recorded
dispositions. Slice 2 still has no settings backup; future Slice 4 owns recovery.

## Current release holds

| Item | Observed state and remaining work |
| --- | --- |
| New notices and help | The owner [approved](../legal/organization-removal-2026-10-26-proposal-v1/owner-approval.json) the exact [26 October successor package](../legal/organization-removal-2026-10-26-proposal-v1/README.md), effective 26 October, with unchanged checkbox and preserved existing acceptance. Manifest SHA-256 is `7528832b4e2baf055d4be35ec2d12fe3d00a9681d0a7684dc5f246e830c4071e`. The five complete documents and manifest remain unchanged. |
| Runtime and help integration | In progress. The successor frozen runtime bundle and complete expandable help pass focused acceptance and byte-contract tests. Old bundles and acceptance behavior remain intact. Complete the candidate's selected checks and review before publication and deployment. |
| Removal storage | Applied once as Supabase migration `20261026160554_membership_removal_operations`, from reviewed source SHA-256 `22d1f83dffff16f302868fec7192f142007f1c4741a441320d357123fcaaec55`. Readback confirms the exact columns, constraints, trusted-server policies, restricted privileges and forced RLS. Operation count was zero. The public Data API rejects the private schema; the production runtime factory reads the table using the existing restricted role and verified-CA configuration. Security advisors report no findings. |
| Capacity and privacy preflight | Supabase is healthy on Free. The dashboard reports 25.06 MB against 500 MB, and current-cycle egress below 1% of 5 GB. These rounded, delayed figures support a small bounded canary, not broad capacity. After migration, the new table's private-schema Data API probe with a valid publishable key returned HTTP 406 / `PGRST106`, with no data returned. |
| Current Audit delivery | The expired saved credential was replaced at `2026-10-26T15:42:45Z` with the existing approved nonexpiring, dataset-scoped ingest token. Fresh deployed Test and MCP receipts passed as described below. This narrow repair is closed; the earlier failed Test remains recorded. |
| Deployment and removal proof | Pending reviewed integration and final checks. Deploy the exact final candidate, then retain bounded deployed removal, receipt, current-access and safe audit evidence. Do not mark Slice 2.5 released or Done until these gates close. |

## Current Audit credential repair

The deployed Test at `2026-10-26T15:33:37.585Z` failed. A secret-safe comparison
through actual SQL with verified client TLS confirmed that the saved credential
matched the expired Temp token. At 15:42:45 UTC, a protected compare-and-set
restored the existing approved nonexpiring token. Readback confirmed new revision
`7b16bcfd-e430-401e-8ec2-2e86a81c6c42` with all other settings unchanged. No new
credential, source change or deployment was needed.

The fresh portal Test at 15:43 UTC was accepted. Axiom received the synthetic
event for that exact revision, plus Save/unchanged and Test/tested administration
events. The [Test receipt query](https://app.axiom.co/thermus-ai-spao/query?resultView=results&qid=uVyWiRY8YfE-tniuce&relative=1)
retains those results. A subsequent production MCP fetch succeeded with a
1,341-byte client result; its
[Audit receipt query](https://app.axiom.co/thermus-ai-spao/query?resultView=results&qid=FKqriuAeubW-tniuek&relative=1)
confirmed 1,341 untruncated bytes and the correct actor. These bounded results
close the credential-repair check. They do not prove the new membership-removal
journey or continued delivery under all conditions. The new notice package now
has owner approval and the removal migration is applied. No removal deployment
has occurred yet.

Fresh operational readbacks and protected credential-comparison evidence remain
in the restricted release evidence. They contain no authorization to publish
secrets or replace acceptance records. The linked immutable reports above are
public review artifacts; local evidence paths are not presented as GitHub links.

For unknown removal outcomes, retain the operation row and follow the
[runbook's containment and restore controls](admin-s2-5-02-removal-runbook.md#contain-an-unknown-operation).
Current membership reads or missing audit events cannot settle an uncertain
provider effect. A deployment or rollback must not erase a hold.
