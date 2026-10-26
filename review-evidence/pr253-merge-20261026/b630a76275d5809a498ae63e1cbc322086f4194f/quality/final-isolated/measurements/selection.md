# PR253 complete-candidate quality selection

Candidate: `b630a76275d5809a498ae63e1cbc322086f4194f`.
Actual parent: `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d` (#251).
Complete-candidate selection main: `8c6d204e8588a664438ba8934ab36670b802525f`.

Reviewed AGENTS, coding principles, test-gate policy, test-code layout and the
prior #253 complete-candidate selection. Current source/metric configuration
blobs are identical to the previous #253 head790fa3e1; the private PostgreSQL
runtime coordination fix is inherited from #251. That test change invalidates
old coverage. Exact source equality does not restore the old input fingerprint.

Source rule1 applies to the complete candidate against main: full ordinary
suite (unit/integration/acceptance/interface/portal), typecheck and portal build.
Applicable additional gates are public declaration verification, hosted-live,
self-hosted container, hosted image/LinuxAMD64 container, logging PostgreSQL,
and logging Collector. Shared module-path and fake-provider runtime consumers
require that union. No fetch/search/cleaner/renderer source changed, so no
extra standalone renderer command is selected; fresh hosted nested proof
covers its selected image. Do not add npm run check or duplicate hosted build.

This worker owns quality only in the isolated named checkout. Manager explicitly
authorizes one fresh combined unit/integration/acceptance coverage capture; all
three complete groups are already selected by source rule1. This avoids the
previously insufficient unit-only callback coverage. Run frozen pnpm install,
Habit against pinned main, snapshots/process/CRAP and the tier checker against
the actual parent. All live and container gates run elsewhere. No Docker or
WorkOS live command is authorized in this isolated checkout.

Pinned Node24.20.0; Lightpanda uses the existing absolute primary checkout
binary. Read only AXIOM_API_KEY/AXOIM_ENDPOINT_URL through Nodeutil.parseEnv
into the capture child; dataset system-log-test. Never log credentials.

Keep actual checkout provenance and each failure/retry. Native comparison needs
a named branch. The parent is not yet on origin/main, so record any exact
trend-history limitation. Stop for any generated tracked metrics record; do not
commit or change source. R1 remains a later-stack hold until #257. User directly
attests independent architect approval of the full stack; do not invent a
GitHub review or reviewer identity. Manager owns overall merge eligibility.
