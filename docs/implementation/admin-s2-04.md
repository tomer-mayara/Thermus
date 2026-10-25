# S2-04 integrated audit verification and rollout

This work follows S2-03c in [PR #244](https://github.com/tomer-mayara/Thermus/pull/244).
PRs #237–#245 were merged once as
`845cec3060b0880cd27c36047f1da57a1c3772ba`. The merged source and approved final
head `a3aef3f2` have the same complete tree. This record tracks the
[integrated verification and owner release work](../design/organization-admin-plan.md#s2-04--integrated-proof-owner-rollout-and-release).
Source implementation, controlled proof, owner setup, and release are separate
claims. The owner authorized setup and rollout. Actual SQL and local Axiom proofs have
now run, but final approvals and the deployed journey remain pending; this
record does not mark S2-04 done.

This is the dated preparation record for
[PR #248](https://github.com/tomer-mayara/Thermus/pull/248). Its maintained
[Validation comment](https://github.com/tomer-mayara/Thermus/pull/248#issuecomment-6390817756)
records later checks, publication and deployment results. Its
[Quality review comment](https://github.com/tomer-mayara/Thermus/pull/248#issuecomment-6390817906)
records the final candidate, review and approval evidence. These later records
must identify their actual revisions; this preparation record is not a pass or
approval for a later candidate.

The [24 October stack review](../design/organization-admin-plan.md#slice-2-review-and-remaining-work)
found a redaction defect in inherited S2-03a: a URL credential could remove
adjacent public JSON fields or Markdown syntax. The #245 correction adds failing
acceptance and unit cases, then preserves recognized enclosing boundaries while
keeping complete query-value redaction for validated URLs and ambiguous text.
The [correction record](admin-s2-03a.md#redaction-correction) states its syntax and
performance limits. The merged candidate passed its required gates and final-head
human review. The Axiom destination change now in progress needs checks and
review for its own complete candidate; earlier passes do not cover new bytes.

The merge contains all nine stack heads, including #238 through #241. PR240
resolved the old #237/main conflicts. No separate upstream repair or rebase is
needed. Main's branch configuration has no required GitHub status checks, and
the repository has no CI workflows. The required local gates remain in force.

The public browser, MCP, and Collector journey characterizes existing behavior.
The missing export help was specified by failing acceptance and focused unit
tests before its implementation. The procedures below add no runtime behavior
or backup framework. The owner chose to run Slice 2 without backup. Proposed
backup, key-recovery, restore, and cadence work is retained as
[future Slice 4 work](admin-s4-recovery.md), not a Slice 2 release blocker.

## Logging object CR restack

The [logging object CR](logs-object-refactor-change-request.md) is implemented
in PRs #240, #241, and #244 and restacked through this candidate. System output
uses explicit sinks, settings require a sender, and held-close sender cases
characterize payload clearing and settlement. The original help, integrated
journey and owner ledger are retained. The structural CR did not change redaction;
the separate correction belongs to merge preparation. Checks and reviews for the
merged candidate are recorded separately. Neither CR completion nor the redaction
fix supplies activation or release approval.

## Verification fixture cleanup

The PR245 container gate reported ENOSPC. A read-only inventory also found
dangling anonymous PostgreSQL volumes with this fixture's TLS command in the
current verification window. These observations do not prove that the volumes
were the sole cause of the disk failure.

The disposable PostgreSQL fixture now uses `docker rm -f --volumes` at cleanup
to remove its anonymous data volume with its container. This repairs a test
resource lifetime; production architecture and storage policy do not change.
The manager reran the selected checks after the final source correction. The PR
records the results and approved head. Actual activation and release evidence
remain separate in the ledger.

## Historical development proof before the redaction repair

- The dedicated Collector gate passes all nine cases, including the integrated
  password-Admin browser journey: disabled Save, one saved Test, Enable, an
  activity-triggered snapshot load, subsequent MCP and invitation actions, and
  six expected Collector records. It checks full product results against bounded,
  redacted audit copies and content-free defined system records. WorkOS, storage,
  and tool operations are controlled; DNS, verified TLS, sender, and Collector
  receipt are real on an isolated Docker network. Inherited specifications cover
  default hosted composition and the separate failure matrices.
- The new visible help has acceptance and unit red/green evidence. Local Chromium
  checks cover protected Admin navigation, labels, keyboard and emulated touch,
  Save/Test, a blank saved-token field, safe errors, and widths 1200, 390, and
  320 pixels. The manager inspected desktop and mobile captures. This is not
  live-provider proof, a physical-device run, or a full accessibility audit.
- The precommit complete-candidate run passed 4,704 ordinary backend tests, 49
  portal tests, type checking, the portal build, 12 real PostgreSQL cases, and
  the nine Collector cases. The PR and `ast-report/s2-04-final/README.md` retain
  the final candidate SHA, selected container/build gates, quality results,
  architecture review, and remaining holds for that earlier candidate. Those
  runs used its working source before commit; their retained inputs and timing
  do not establish passes for the later redaction repair.

Development evidence is under `ast-report/s2-04-development/`; complete-candidate
results are under `ast-report/s2-04-final/`. These records do not mark the ticket
Done or supply owner, legal, human-review, or rollout approval.

## Evidence and release holds

| Obligation | Established evidence | Actual owner or release evidence still needed |
| --- | --- | --- |
| Settings, capture, Test, and delivery | Integrated controlled proof and merged-candidate gates passed. A local production sender sent a synthetic event to Axiom `audit-log-test`; Axiom UI receipt was verified. Actual restricted-role settings persistence, isolation and revision-conflict proof passed locally against Supabase. | Complete checks and approval for the direct-Axiom candidate, then verify the deployed current-Admin Save/Test/Enable and MCP/Admin export journey. The local sender canary is not a deployed Admin journey. No saved destination or audit export is enabled. |
| SQL setup and verified TLS | Original settings and additive `axiom_dataset` migrations are applied. Restricted LOGIN and real local-store proof passed through the actual pooler. Exact canaries were removed; settings rows are zero. Render now has the official CA secret file; deployment `dep-dbek395g1s2s73frt4i0` is live, startup no longer reports storage unavailable, and health is 200/ok. The signed-in current Admin read the empty saved-settings form successfully. | Prove deployed writes and the full application journey. Local reconnect persistence is not deployed restart proof. The managed pooler-to-database connection reported SSL false, so the verified TLS claim covers client to pooler. |
| Recovery | The owner explicitly chose to run Slice 2 without backup. Historical local drill evidence is retained in [future Slice 4 recovery work](admin-s4-recovery.md#historical-local-procedure-validation). | No backup, cadence, retention, key-recovery, or restore proof is required for this Slice 2 release. Future recovery work remains unconfigured and unproved. |
| $0 capacity | Existing resources meet the $0 new-infrastructure constraint for the scoped rollout. Supabase/Render inventory and the dated Axiom Personal Free readback support the small controlled canary. Axiom uses the existing `audit-log-test` dataset, with low observed load/storage and no query compute. | Keep the final deployed canary small and record its outcome. Broad production-load capacity remains unmeasured; this evidence limit creates no new paid-tier prerequisite. No upgrade, new resource, retention change, or sharing change was made. |
| Notice and help | [Slice 2 notice review](admin-s2-04-notice-review.md) identifies current data flows and disclosure differences. | Owner approval of complete changed notice/help bytes, versions and hashes, publication scope, and actual presentation verification. Historical Slice 1 approval does not cover these differences. |
| Slice 1 release | Approved organization policies and historical provider/invitation proof remain in [Staging release verification](admin-s1-staging-release-verification.md). Current Production WorkOS inventory has two active verified password accounts, one Admin and one User, with an accepted invitation. Render signup is enabled. | Verify current deployed presentation and the complete release journey; record disposition of alternate-address joining, native revoke-race error and deferred mailbox/reset/consumer checks. Enabled signup and inventory alone do not establish release approval. |
| Complete-candidate review | The merged Slice 2 candidate passed its required gates and received final-head approval. | Complete checks, architecture/registry and quality review, classification, and any required human approval for the Axiom change and remaining rollout candidate; record actual deployment and release results. |

### Actual SQL setup and local application proof — 24 October 2026

The original migration
`sql/migrations/20261023211956_logging_destination_settings.sql` and additive
`sql/migrations/20261024231921_add_logging_axiom_dataset.sql` are applied to
project `rnqktgtgrvvqptbaosth`. Runtime role `thermus_logging` now has LOGIN and
retains its restricted private-schema/table scope. It has no runtime DELETE or
DDL capability. The initial migration created this role as NOLOGIN; that earlier
state and the TLS-only preflight below are historical, not current setup limits.
The trusted role is not a tenant identity: application predicates and expected
revisions enforce tenant isolation.

At `2026-10-24T23:20:17.173Z`, the actual restricted role connected to the selected
pooler using the official Supabase Root 2021 CA, verified TLS 1.3 and the normal
Node hostname check. The client-to-pooler connection was encrypted and
authorized. The observed pooler-to-database SSL flag was false; this record does
not claim end-to-end database TLS. Evidence:
`ast-report/s2-04-rollout/runtime-login.json`.

At `2026-10-24T23:30:39.526Z`, the local production store used that real pooler
and proved persistence after reconnect, tenant-predicate isolation, tenant-bound
credential encryption/decryption, concurrent expected-revision conflict, and an
unchanged other tenant. A bounded query failure returned `unavailable` in
2,009 ms. The administrative connection removed only the two exact owned
fixture IDs; the table was verified empty afterward. Runtime DELETE and DDL
remain false. This is real SQL/application-store proof, not Render restart or
deployed Admin/browser proof. Evidence:
`ast-report/s2-04-rollout/live-store-proof.json`.

The official local CA is `ast-report/s2-04-rollout/supabase-ca.crt`, SHA-256
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
It is a public trust certificate, not a credential. The matching Render secret
file was added in the later deployment recorded below; local and runtime file
presence remain separate observations.

### Local production sender to the selected Axiom destination

At `2026-10-24T23:26:33.348Z`, the local production audit sender submitted a
synthetic event to `https://us-east-1.aws.edge.axiom.co/v1/logs` with dataset
`audit-log-test`. The sender returned `accepted`. The manager verified marker
`46468255-b32a-4b31-9abd-a1e296837a9e` in the Axiom UI. Evidence:
`ast-report/s2-04-rollout/axiom-transport-canary.json` and the observed receipt
`ast-report/s2-04-rollout/axiom-canary-receipt.png`.

This proves the selected direct-Axiom transport and one observed receipt. It
provides no deployed Admin Save/Test/Enable, MCP/Admin capture, future delivery,
or durable-storage guarantee. No customer Collector exists. No destination is
saved and no audit export is enabled after exact fixture cleanup.

### Axiom plan, usage and retention — dated readback

At `2026-10-24T23:45:06.075831+00:00`, the authenticated Axiom UI for Thermus AI
showed the Personal plan with a Free platform fee. Included capacity was
500 GB/month loading, 10 GB-hr/month query compute and 25 GB storage. For the
13 October–13 November usage period, observed loading and average storage were
each below 0.01 GB, with 0 GB-hr query compute. The account used all three of its
three allowed datasets; this rollout uses the existing `audit-log-test` dataset.
That dataset had 30-day retention and less than 1 MB total storage. Evidence:
`ast-report/s2-04-rollout/axiom-account-readback.json`.

No plan, resource, dataset, retention or sharing setting was changed. Together
with the existing Supabase and Render resources, this meets the owner’s $0
new-infrastructure constraint for the small controlled rollout canary. These
are dated observations, not a future workload forecast or a promise of broad
production-load capacity. Keep the final canary bounded and record its outcome;
the unmeasured broader workload creates no new requirement to buy a paid tier.

The earlier read-only inventory recorded this project as `ACTIVE_HEALTHY`,
`us-west-2`, PostgreSQL `17.11.0.003`, in the Free organization. Its database
sample was 10,852,019 bytes and seven sessions with `max_connections=60`. At that
time, the private objects and local runtime database/key/CA variables were
absent. The applied migration supersedes that object-absence observation; the
sample does not establish current workload headroom. Historical evidence is
`ast-report/s2-04-development/owner-readback.json`. The dashboard also showed
egress `0.00 / 5 GB`, cached egress `0.00 / 5 GB`, and project size
`26 / 500 MB`. Dashboard usage can lag by one hour; project size has a different
scope from the SQL database sample. Free-plan overages cause restrictions rather
than billed overages. These historical readings remain in
`ast-report/s2-04-development/dashboard-usage.json`; recheck actual headroom
before rollout.

The pooler TLS-only preflight at 10:06:13 UTC failed default trust with
`Supabase Root 2021 CA` in a self-signed certificate chain; see
`ast-report/s2-04-development/supabase-pooler-tls.json`. No SQL login occurred.
At 10:11:36 UTC, Node 24.20.0 verified TLS 1.3 and the exact hostname with the
official CA obtained from the project's Download certificate link. Default Node
trust refused the chain, and the same CA with a wrong hostname was refused.
See `ast-report/s2-04-development/supabase-node-tls.json`. This was a TLS-only
observation with no SQL login. The later restricted-role
proof above supersedes its unauthenticated status. Use the official CA for this
observed endpoint; never disable verification.

### Render deployment and current Production identity facts

The earlier Render readback identified source
`bb19a9887f3e58776278e516cce9e7aa18efee5c`, deployment
`dep-dbdsf18ae00c73arqlog`, completed 23 October at 20:46:27 UTC. It superseded
the older Staging record at that observation time. It is no longer the current
deployment.

On 24 October, saving the service-scoped `DATABASE_URL`,
`LOGGING_DESTINATION_ENCRYPTION_KEY`, and `DATABASE_CA_CERT_PATH` unexpectedly
triggered deployment `dep-dbejvhnb9u1s739vrqjg`, created about 23:31 UTC and live
about 23:36 UTC. The manager attempted cancellation, but the deployment finished
first. It deployed the already approved main source
`845cec3060b0880cd27c36047f1da57a1c3772ba`; it did not deploy the new direct-Axiom
candidate or the proposed notice. Auto-deploy remains off.

At about 23:37 UTC, health returned HTTP 200 and the server was listening.
Application logs identified storage as unavailable because
`/etc/secrets/supabase-ca.crt` was not readable. This is a repaired earlier
configuration failure, not an open missing-file hold.

The manager then saved the matching official CA as that Render secret file and
used Save and deploy. Deployment `dep-dbek395g1s2s73frt4i0` became live at
23:39:48 UTC, still on approved main
`845cec3060b0880cd27c36047f1da57a1c3772ba`. New startup logs no longer report
storage unavailable. At `2026-10-24T23:40:10.482326+00:00`, health was HTTP 200
with body `ok`; auto-deploy was off and enabled audit destinations were zero.
The new direct-Axiom code and proposed notice were not deployed. Evidence:
`ast-report/s2-04-rollout/render-storage-setup.json` and
`ast-report/s2-04-rollout/render-certificate.png`.

The CA setup failure is resolved. After the owner signed in as the current
Thermus AI Admin, the deployed `/logging` page returned its empty settings form,
not the storage-unavailable response. This proves one authorized deployed SQL
read. A fresh SQL count also confirmed zero saved and enabled destinations.
No Save, Test, or Enable action was taken. Deployed writes, restart persistence,
the full Admin/browser/MCP journey, and final code/notice approvals remain pending.

At the next verification, the existing Thermus MCP Debug CLI's saved refresh
could not finish safely. The CLI required login and did not replay that refresh.
Reauthentication through its existing public WorkOS application then succeeded.
Selected non-secret claims identified the current Thermus AI organization and
its existing Admin. The unchanged production MCP endpoint accepted the refreshed
login and returned the fetched `https://example.com/` content. This is a baseline
with Audit export off, not proof of exported tool content. The production web
client below and the separate public Debug CLI client have different client IDs.
Evidence: `ast-report/s2-04-rollout/mcp-login-facts.json` and
`ast-report/s2-04-rollout/mcp-baseline-after-login.txt`. No credential value is
part of these records.

Current WorkOS Production client is `client_01M4VDKC291XX3CDEFP5ZKY5KP` in
environment `environment_01M4VDKBVH3BKNY1F64VSWJ9ZD`. Thermus AI organization
`org_01M5N95EJA1AKHHERCD7971AJ7` has two active verified password accounts: one
Admin and one User. Its invitation is accepted. Current settings are signup
true, password true, email verification true, MFA off and SSO false. These
observations replace earlier empty-organization or other-client assumptions;
they do not rewrite the historical Staging evidence. Current source/code and
notice approvals and the full deployed release journey remain pending.

### Specific Slice 1 release limitations

The native proof already passed ordinary exact-address User/Admin invitations,
both active-role preservation directions, both outstanding-invitation orders,
sequential resend/revoke cases, and one measured concurrent resend case. Do not
replace those results with a broad unproved-invitation hold.

The remaining limitations are:

- Alternate corporate-address acceptance did not create target membership in the
  tested configuration, including after actual email verification. A fresh
  exact-address reinvitation restored the intended User access in the tested
  recovery. This does not repair alternate-address joining.
- One concurrent acceptance/revoke attempt produced the native generic error.
  Fresh state denied target access. Ordinary `/login` in a new browser context
  restored only unrelated authorized access. This does not repair the native
  error or prove every concurrent ordering.
- Mail delivery, password reset, and controlled consumer exact-address
  acceptance/refusal remain deferred by owner choice. API-assisted completion of
  an owned verification challenge did not prove mailbox delivery.

The owner must record whether these specific limitations and tested recovery are
acceptable for release, or require repair or further proof. Earlier deferral of
mailbox checks is not a pass. Refresh the production inventory and saved provider
settings, perform only required scoped cutover actions, and verify fresh access
before declaring release complete. The [S1 record](admin-s1-staging-release-verification.md) and
[native proof matrix](../testing/workos-invitation-proof-matrix.md) retain the
observations and cleanup evidence.

This ledger keeps unknown facts pending. Do not turn an absent secret, a read-only
provider inventory, a local drill, or a merged parent into evidence of rollout.

## Deployment and ordinary outage

Follow the [database setup runbook](admin-s2-01a-database-setup.md) in order. Use
only the selected existing Supabase project and Render service. Keep the runtime
role separate from the owner. Use verified TLS, the stable application key, and
the service-scoped variables named there. Confirm the required official CA file
before activation. Stage secrets without recording their values. Review any
secret-file action that also triggers deployment.

Before deployment, record the source and image, prior working image, service
identity, selected project, and nonsecret configuration presence. Signup is
currently enabled; that setting does not clear release holds. Keep audit export
disabled until its holds clear. After the authorized candidate and setup are
ready, verify health, MCP product access, Admin-only settings, disabled Save,
optional Test, Enable, eligible activity and the selected destination’s receipt.
Verify restart persistence and tenant isolation with owned fixtures. Record cleanup.
A rollback to a compatible prior image does not require a database rollback;
keep the private schema and key. Review compatibility before any rollback.

During a database pause, outage, reconnect, or quota failure, allow bounded
storage errors to refuse settings writes and export. MCP and admitted product
access retain current identity and membership checks. Do not pause or exhaust
the shared project as a drill, add a keepalive, restart healthy processes, or
log out every user. The owner checks project health and capacity, resolves the
cause within the existing $0 service, and verifies TLS plus scoped reads/writes
before dependent features resume. Activity refreshes settings; there is no idle
poller. Events dropped during outage or shutdown cannot be recovered from SQL.

Future backup, restore, and key-recovery procedures are in
[Slice 4 recovery work](admin-s4-recovery.md). They retain the historical local
drill and its limits. The owner chose to run Slice 2 without backup; those
procedures, storage selection, and cadence are not activation or release blockers.
Keep the deployed application key stable across deployments. If it or saved
settings are lost, do not claim recovery that has not been established.
