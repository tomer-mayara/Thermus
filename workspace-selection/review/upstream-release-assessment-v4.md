# SO-02 upstream and release compatibility — v4

Reviewed prior base `f6b523967223da5ebddafdef1a508d3936cee01c`, new upstream
`a421afc056ce3e400f2779c75683ea45270b96cb`, and approved picker candidate
`feaddbdec5f9e2cc7bf8e07050a4d5e7aa5e5769`. Combined head is not yet pinned.
This assessment preserves all earlier source reviews, runs and approval history.

## Finding

No picker runtime conflict or incompatible source behavior was found in the
upstream increment. It changes release delivery, not application behavior.
Production remains a Git-backed Render service until SO-12 step 5. A direct
specific-commit deployment remains consistent with that documented current state;
the new image workflow is not a reason to migrate production for this fix.
This is an interpretation of repository policy and source, not a fresh cloud
state verification. The manager must confirm the service still uses that mode.

Fresh metric coverage is required: the conservative input identity includes the
new release scripts and changed workflow. Existing coverage cannot be relabelled
as compatible merely because runtime source and tests are equal.

## Delta and expected merge

The upstream increment changes 12 paths: five new script/release TypeScript
files, the hosted-image workflow, README, script README, the test-gate policy,
the SO-02 record, impact declaration and registry prose. It changes no src/ or
test/ file, dependency manifest, lockfile, Dockerfile, TypeScript config, metric
rule/tool, API snapshot or runtime environment setting.

The unchanged src/ and test/ trees support the reviewed picker logic and test
semantics. There is no new application import or collaboration with script/release.
However, this is not equality of all build or coverage inputs: tsconfig.json:19
includes script/, and Dockerfile.hosted:50 plus its ignore rules includes the
new scripts in the checked build context. Upstream's successful checks are
historical evidence; they are not a pass of the combined candidate.

A read-only three-tree merge preview of old base, feaddbde and a421afc0 shows
conflict markers only in .pr-impact.json (two conflict hunks). The other shared
changed path is architecture/components.md; its separate picker and release
prose merges cleanly. Upstream adds no docs/metrics record, so there is no current
immutable-record conflict in this pair. This preview is not an actual merge and
does not predict a later upstream change. The manager resolves and verifies it.

Rebuild the impact declaration for the picker increment against a421afc0. Retain
contract=true and internalInterface=true for its return default and optional GET
AccessResolver use. Do not inherit deployment/crossCutting/policy flags merely
because upstream already added the pipeline. Preserve the upstream release prose.

## Release path and stopping rules

At a421afc0, README:683–733 and test-gate-policy.md:570–583 define these paths:

- A push to main builds Dockerfile.hosted for Linux AMD64, runs its offline
  checks and the hosted image gate on that one image, then pushes by digest.
  A failed check or gate prevents the push. This is a postmerge check of the
  merged main commit, not an extra PR selection rule or an automatic deploy.
- A manual workflow dispatch with no inputs runs that build/gate/push path.
  With any deploy input, only the deploy job runs. That job requires main, a
  lowercase SHA-256 digest and a service ID. Production also requires its ID
  again as confirm_production. Request checks precede remote calls.
- The deploy script additionally checks the Thermus AI workspace, web_service,
  runtime=image, the exact image repository, and not_suspended before a write
  (deploy-hosted-image.ts:33–54,128–135). Today's documented production runtime
  is docker, so that job refuses it even with the production confirmation.
- README:725–728 explicitly retains Git production with automatic deploys off
  until SO-12 step 5 and says not to dispatch a production image deploy before
  that step. Registry prose:1300–1311 repeats that transition. The SO-02 record
  at self-onboarding-s1.md:3320–3324 records the same limitation.

Therefore the bounded picker release can use the manager's already-authorized
exact-commit Render Git deployment once the merged candidate is checked and
approved. Keep automatic deploys off. Confirm the service's current runtime and
the deployed commit by fresh readback; do not treat the dated record as proof.
Observe the new main workflow and record its actual merged-commit result and
digest separately. Do not call its push a production rollout, or a deployment
a gate pass. No migration, role switch, registry credential change, production
workflow dispatch or tenant setup follows from this navigation fix.

For a future image-backed service, the documented command shape is:
`gh workflow run hosted-image.yml --repo tomer-mayara/Thermus --ref main -f digest=sha256:<digest> -f service_id=srv-<ID>`.
Production adds `-f confirm_production=srv-db8mnqg473hc739d529g` only at the
authorized SO-12 transition. This assessment did not run a dispatch. The deploy
job accepts any extant digest in the named repository, including branch images;
the operator must bind a chosen release digest to the checked main commit.

The image deploy sends one Render write with imageUrl, never retries that write,
waits for live, verifies the deploy digest and current imagePath, then checks
public /healthz. Reads have bounded retry; health repeats only after 502, at most
six requests. A public health pass cannot verify picker roles or redirect behavior.
The repo secret has workspace-wide authority and no GitHub environment guard;
the new record calls this out. This is inherited delivery scope, not a new picker
permission or a reason to alter account roles.

## Required refresh and evidence reuse

The complete picker PR still changes src/, so test-gate-policy.md:139–161 and
265–312 retain its existing selection: npm test, npm run typecheck,
npm run build:user-portal; self-hosted container; build:hosted and Linux AMD64
hosted-image gate; hosted-live for its authentication/organization reads; and
the changed dedicated Members/picker browser group. No source renderer, SQL or
Collector behavior changed in this increment, so SO-02 does not select those
additional groups for this picker change. Preserve the prior release selection
and any independent explicit-release requirements; do not rerun check as an
extra duplicate of ordinary validation.

The new upstream policy expressly says the postmerge image run does not change
PR selection. Script/workflow changes alone add relevant type/lint/manual checks,
not source test suites. In the combined candidate, scripts are compile inputs,
so refresh type/backend build and applicable hosted builds. The already-selected
ordinary suite and source gates remain the required complete-candidate evidence.
Prior source, browser and live passes still describe unchanged runtime behavior;
retain their original pins, input bounds and failure history. A carried run must
not be reported as newly executed at the future head.

The coverage exception to a simple bridge is explicit. provenance/inputs.ts
includes non-Markdown script/ and .github/ plus root .pr-impact.json. The workflow
and five new scripts change inputsFingerprint. ast-metrics-review.md:642–680
states that conservative included changes invalidate capture even if they do not
affect executed code. Reuse requires all identities to match. Do not modify a
report, use allow-unverified, or skip coverage to bypass required CRAP assessment.
Collect fresh complete unit and integration coverage for the selected combined
candidate, then run its new-base snapshots/process/CRAP/checker. An existing
capture is usable only if its actual inputs already match the new candidate.

Refresh complete-candidate habit-hooks and its retention review, empty snooze,
impact stamp, checker/tier, all metric pins, and maintained PR reports against
actual base a421afc0. A new immutable base metric record may be generated by the
process; preserve the old f6b record unchanged. Type/lint/manual verification of
inherited release files can cite its merged evidence plus the combined checks;
there is no reason to redeploy a disposable service solely for this picker.

The owner's approval explicitly names feaddbde. Preserve it as valid approval
history for that head. A new combined head needs approval that covers that head
and scope under AGENTS.md; this read-only compatibility review cannot supply or
silently broaden human approval. T2 remains selected by the picker impact.

## Architecture and limits

All 17 Mermaid blocks are byte-identical between f6b52396 and a421afc0. All 51
public declaration snapshots are identical. The registry changes prose for an
inherited delivery relationship: GitHub Actions to GHCR and an optional image
deploy to Render. It adds no runtime component, public callable, source edge or
container change in this upstream increment. Its own deployment/crossCutting
impact remains upstream history.

The v3 picker C4 L3 source and render still explain the anticipated picker
increment; keep its real owners, optional GET use, authority and return notes.
Before publishing v4, pin the actual combined head/base, inventory all 17 views,
verify the merged source and embedded Mermaid, update provenance and obtain
manager review. A final v4 source comparison is not claimed before that head
exists. The observable default-return contract still justifies contract=true;
L3 plus notes answers the review question, so no additional L4 is needed.

No current cloud state, workflow run, GHCR artifact, deploy result or gate pass
was independently verified here. No build, test, MCP, release script or mutating
Git command was run. Only ignored review artifacts were written. Old v1–v3
evidence remains preserved. The final combined candidate and any later upstream
advance remain outside this pinned assessment.
