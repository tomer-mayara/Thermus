# S2-04 integrated audit verification and rollout

This work follows S2-03c in [PR #244](https://github.com/tomer-mayara/Thermus/pull/244).
PRs #237–#245 were merged once as
`845cec3060b0880cd27c36047f1da57a1c3772ba`. The merged source and approved final
head `a3aef3f2` have the same complete tree. This record tracks the
[integrated verification and owner release work](../design/organization-admin-plan.md#s2-04--integrated-proof-owner-rollout-and-release).
Source implementation, controlled proof, owner setup, and release are separate
claims. The owner authorized setup and rollout; the live checks below remain
pending, so this record does not mark S2-04 done.

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
| Settings, capture, Test, and delivery | S2-01a/b, S2-02a/b, and S2-03a/b/c have linked implementation records. Integrated controlled proof and final merged-candidate gates passed. | The Axiom destination feature is in progress. No actual Collector is configured. Complete and check optional dataset storage and the `x-axiom-dataset` header, then verify the deployed current-Admin browser/MCP journey and receipt at the intended Axiom destination. A controlled receiver does not prove that destination. |
| SQL setup and verified TLS | The reviewed migration was applied to the selected project. The private table, restricted NOLOGIN role, scoped grants, and forced RLS are verified; the table has zero rows and security advisors are clean. Official-CA pooler TLS and hostname verification passed without SQL authentication. | Secure runtime password and LOGIN, actual restricted-role login, deployed official CA path and Render wiring, persistence across restart, and tenant isolation through application interfaces. |
| Recovery | The owner explicitly chose to run Slice 2 without backup. Historical local drill evidence is retained in [future Slice 4 recovery work](admin-s4-recovery.md#historical-local-procedure-validation). | No backup, cadence, retention, key-recovery, or restore proof is required for this Slice 2 release. Future recovery work remains unconfigured and unproved. |
| $0 capacity | Read-only inventory confirms the Free organization, dashboard usage, and a point-in-time database/session sample. | Realistic load headroom for database size, connections, egress, Render network use, and the selected Axiom destination. No new cost is approved. |
| Notice and help | [Slice 2 notice review](admin-s2-04-notice-review.md) identifies current data flows and disclosure differences. | Owner approval of complete changed notice/help bytes, versions and hashes, publication scope, and actual presentation verification. Historical Slice 1 approval does not cover these differences. |
| Slice 1 release | Approved organization legal package, public policies, password/provider journey, ordinary invitations, and active-role preservation evidence are recorded in [Staging release verification](admin-s1-staging-release-verification.md). The deployed S1 source is identified below. | Refresh production cutover facts and verify the runtime presentation. Record disposition of alternate-address join failure, native revoke-race error, and deferred mailbox/reset/consumer checks as listed below. |
| Complete-candidate review | The merged Slice 2 candidate passed its required gates and received final-head approval. | Complete checks, architecture/registry and quality review, classification, and any required human approval for the Axiom change and remaining rollout candidate; record actual deployment and release results. |

On 24 October 2026, the reviewed migration
`sql/migrations/20261023211956_logging_destination_settings.sql` was applied to
project `rnqktgtgrvvqptbaosth`. The table
`thermus_admin.logging_destination_settings` exists with zero rows. Runtime role
`thermus_logging` remains `NOLOGIN`; it has only private-schema `USAGE` and table
`SELECT`, `INSERT`, and `UPDATE`, with no DELETE, DDL, or unrelated grants.
Forced RLS is enabled, and the security advisors are clean. Runtime credentials
and verified Render SQL access are still pending. The trusted runtime role is
not a tenant identity: application tenant predicates and revision checks enforce
tenant isolation.

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
See `ast-report/s2-04-development/supabase-node-tls.json`. This proves TLS to
the pooler only, not project association, SQL login, permissions, persistence,
or the deployed CA path. Use the official CA for this observed endpoint; never
disable verification. The current Render readback still identifies deployed source
`bb19a9887f3e58776278e516cce9e7aa18efee5c`, deployment
`dep-dbdsf18ae00c73arqlog`, completed 23 October at 20:46:27 UTC. This supersedes
the older Staging record's point-in-time undeployed status. Deployment alone does
not prove the scoped Slice 1 cutover or resolve the specific limitations below.
Auto-deploy is off. Main is
`845cec3060b0880cd27c36047f1da57a1c3772ba`; the Slice 2/Axiom changes are not
deployed. Credentials, CA/Render wiring, Axiom setup and its settings migration,
actual destination receipt, and deployment verification remain pending.

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
before reopening. The [S1 record](admin-s1-staging-release-verification.md) and
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
identity, selected project, and nonsecret configuration presence. Keep signup
and Slice 2 rollout closed until their release holds clear. After an authorized
activation, verify health, MCP product access, Admin-only settings, disabled
Save, optional Test, Enable, eligible activity and Collector receipt. Verify
restart persistence and tenant isolation with owned fixtures. Record cleanup.
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
