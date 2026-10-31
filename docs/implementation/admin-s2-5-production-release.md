# Slice 2.5 production release checkpoint

Pre-deployment checkpoint on **26 October 2026**: the complete Slice 2.5 stack is
merged. The approved notices are published and the application release checks
have passed. Final candidate review, deployment and production removal proof
remain pending. The maintained [PR #260 release report](https://github.com/tomer-mayara/Thermus/pull/260)
records later deployment and verification results. This checkpoint supersedes older pending-stack,
approval and earlier S2-04 release statements in the
[implementation history](admin-s2-5-02.md) and
[removal runbook](admin-s2-5-02-removal-runbook.md). It preserves their procedures,
test provenance and dated limits.

## Update of 31 October 2026

The deployment proof of the approved removal bundle is complete. The
[PR #260 Validation comment](https://github.com/tomer-mayara/Thermus/pull/260#issuecomment-6421162914)
records the deployment of `57c99e2b`, live at 19:05:56 UTC on 26 October 2026,
with the removal, receipt, and audit proofs and the fixture cleanup. It says
"Slice 2.5 production scope is complete". The pending statements below are
dated 26 October 2026. Production has run `b0723a0a` since 29 October 2026. The
[Slice 2 release record](self-onboarding-s2-release.md) cites this proof
before the free-tier release.

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
published at marketing revision
[`654eebabb6465967edf8d4b0388708e6421f0691`](https://github.com/tomer-mayara/Thermus-Marketing/commit/654eebabb6465967edf8d4b0388708e6421f0691).
Earlier agreement evidence remains intact. The owner-accepted native invitation
limits and deferred mailbox/password-reset/consumer checks retain their recorded
dispositions. Slice 2 still has no settings backup; future Slice 4 owns recovery.

## Current release holds

| Item | Observed state and remaining work |
| --- | --- |
| New notices and help | The owner [approved](../legal/organization-removal-2026-10-26-proposal-v1/owner-approval.json) the exact [26 October successor package](../legal/organization-removal-2026-10-26-proposal-v1/README.md), effective 26 October, with unchanged checkbox and preserved existing acceptance. Manifest SHA-256 is `7528832b4e2baf055d4be35ec2d12fe3d00a9681d0a7684dc5f246e830c4071e`. The five complete documents and manifest remain unchanged. |
| Public publication | [Marketing PR #30](https://github.com/tomer-mayara/Thermus-Marketing/pull/30) merged as `9c35930d1d89d5560e331f1c8fc5bc2440c5c784`. Netlify published that commit in deployment `6adf803c912d5fe402971f61` at `2026-10-26T16:31:19.565Z`. All four Terms/Privacy URLs, complete rendered text, links, metadata and narrow/desktop layout passed [live readback](https://github.com/tomer-mayara/Thermus/blob/2db4d1044e1c922699e55cff2c8aca5c0b74f265/review-evidence/s25-production-release-20261026/marketing/publication/README.md). |
| Runtime and help integration | Implemented at `618c29a94a80c94a9e0396ed07a8b727c10febde`. The successor frozen runtime bundle and complete expandable help match all five approved documents. Old bundles and acceptance behavior remain intact. The selected checks below passed. Final current-head review remains a separate merge gate. |
| Removal storage | Applied once as Supabase migration `20261026160554_membership_removal_operations`, from reviewed source SHA-256 `22d1f83dffff16f302868fec7192f142007f1c4741a441320d357123fcaaec55`. Readback confirms the exact columns, constraints, trusted-server policies, restricted privileges and forced RLS. Operation count was zero. The public Data API rejects the private schema; the production runtime factory reads the table using the existing restricted role and verified-CA configuration. Security advisors report no findings. |
| Capacity and privacy preflight | Supabase is healthy on Free. The dashboard reports 25.06 MB against 500 MB, and current-cycle egress below 1% of 5 GB. These rounded, delayed figures support a small bounded canary, not broad capacity. After migration, the new table's private-schema Data API probe with a valid publishable key returned HTTP 406 / `PGRST106`, with no data returned. |
| Current Audit delivery | The expired saved credential was replaced at `2026-10-26T15:42:45Z` with the existing approved nonexpiring, dataset-scoped ingest token. Fresh deployed Test and MCP receipts passed as described below. This narrow repair is closed; the earlier failed Test remains recorded. |
| Deployment and removal proof | Pending final candidate approval. Deploy the exact approved candidate, then retain bounded deployed removal, receipt, current-access and safe audit evidence. Do not mark Slice 2.5 released or Done until these gates close. |

## Application checks before deployment

The complete source candidate `618c29a94a80c94a9e0396ed07a8b727c10febde`, against
main `9f07c04bba0813358274212b21316165dc3e308b`, passed the ordinary suite
(5,122 backend and 49 portal tests), typecheck, portal build, 11 native-container
tests and 7 hosted Linux AMD64 image tests. The image build ran six fresh offline
groups (3,299, 29, 20, 1,155, 119 and 13 tests) under `--network=none`. These are
separate emitted counts, not a count of unique scenarios. Focused acceptance and
byte contracts passed 155 tests; Chromium passed both Members and no-script Audit
help journeys at narrow and desktop widths. The guarded staging gate passed all
29 tests, including removal, retained workspace access and real token expiry.

The first ordinary run exposed an old assertion that mistook general approved
help for a confirmed removal result. The test now checks the result outside the
identified static help region and retains its durable-hold and no-replay checks.
The related 28 tests and final complete suite passed. No production change was
needed for that correction. The failure and retry remain in PR evidence.

Complete metrics report no new architecture fact or CRAP failure. Existing low
MI files and static review findings have recorded reasons. All 47 Habit Hooks
findings also have individual retained reasons; its exit 1 is recorded and the
snooze file remains empty. The local checker selects **T1 Team review**, with no
local blockers, for the Docker build input and notice-policy scope. This local
result does not replace independent human approval. All 15 registry views and
49 public declaration snapshots are unchanged. The generated historical base
record is retained unchanged under `docs/metrics/`.

The final documentation-only commit must retain identical source, test, package
and image inputs. Its quality provenance must be refreshed with compatible
coverage. The maintained PR report binds the final head, complete evidence,
approval and later release results; this dated checkpoint does not predict them.

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
