# Admin Quick start policy review

Date: 28 October 2026. Worker assessment of the current working tree.
Trusted merge base: `feeaad4d5f04212f033366c232180be4bd40da4c`.
Current committed HEAD: `d256c620c7dc8c6d928b9426d1819c293fcfa52c`.
Implementation changes are uncommitted at this assessment. This is planning
and review evidence, not a final checker result or a current-candidate approval.
Refresh the full candidate SHA and evidence after the manager commits it.

## Recommended tier and flags

Use **T2 Need architect**, subject to the complete-candidate checker and manager
review. Required independent human approval must name the final SHA and scope.
The owner's 28 October implementation approval sets scope; it does not approve
the final candidate. Overall merge status remains blocked until selected checks,
quality evidence, and required approval are complete.

Recommended classification:

```json
{
  "container": false,
  "external": false,
  "contract": true,
  "deployment": false,
  "crossCutting": false,
  "component": false,
  "internalInterface": true,
  "sensitiveBehavior": true,
  "dependencyRisk": false,
  "policy": false,
  "uncertain": false
}
```

- `contract`: the hosted server adds a browser-visible `quick-start` route.
  Successful new-organization creation now redirects there after checked
  selection. Later sign-ins and normal workspace choices retain Connect.
- `internalInterface`: app supplies the configured `mcpResourceUrl` to web
  through a new required member of `HostedAccountRoutesOptions`.
- `sensitiveBehavior`: the new guide requires current product and exact Admin
  access for the session's selected organization. The shared current-Admin
  check also rejects an undefined selected organization explicitly.
- Other flags are false: existing web and user-portal owners still own the
  behavior; there is no new provider, process, store, runtime dependency,
  topology, deployment relationship, trust model, or development policy.

No new component, allowed component edge, or public-surface module is needed
for the inspected source. New page modules stay within web. The changed route
options module is not a listed declaration-snapshot module; app-only route
construction is composition under the public-surface policy. The manager must
still run snapshot verification and the checker for the complete candidate.
Do not reuse the inherited SO-05 impact declaration.

Set `architecture.modelUpdated` to true for the registry prose update. List the
checked views below and the source/test evidence. No registry Mermaid block was
edited in this worker's change.

## Test and build selection

Any changed `src/` path selects these commands on the complete candidate:

```sh
npm test
npm run typecheck
npm run build:user-portal
npm run test:container
npm run build:hosted
npm run test:container:hosted
```

`npm test` includes the ordinary Node and portal groups. Do not add a separate
`npm run check`; the source validation already covers its stages. The separate
hosted offline gate necessarily contains its own `check` stage and remains
selected by the hosted portal change. The self-hosted container gate applies
to changed `src/interfaces/web/` source. The hosted image must pass on Linux
AMD64, native or emulated.

The new browser runtime has its own selected group:

```sh
npm run build:user-portal && npm run build
node --test dist/test/acceptance/auth/hosted-quick-start-browser.runtime.js
```

Run the existing Members browser runtime as the shared navigation regression:

```sh
npm run build:user-portal && npm run build
node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js
```

Its existing cases check Members/Audit shared navigation, Connect navigation,
and the organization picker. Update their expected Admin menu as needed and run
each changed dedicated test locally before commit. The source-gate rule itself
strictly names changes to removal form, confirmation, or result navigation;
it does not select this gate for every arbitrary header edit. A changed runtime
file or shared driver also selects its real consuming group independently.
Set `THERMUS_BROWSER_EVIDENCE_DIR` to retain screenshots.

Hosted authentication and signup route changes select `npm run test:hosted-live`
when staging settings are available. If unavailable, record that it did not run;
absence is not a pass. This gate also runs the retained removal live file.
It needs WorkOS staging settings, the actual pinned renderer, Playwright
Chromium, OpenSSL, Docker for disposable PostgreSQL, network, and free ports
24443 and 24480. Follow the gate guide for provider configuration and cleanup.

No separate renderer, private PostgreSQL, Collector, Render interface, or Brave
live gate is selected by the inspected change: their listed production behavior
does not change. `build:hosted` still runs its normal local renderer checks.
No release, deployment, provider-setting change, or actual destination smoke
check was requested by this implementation scope.

Install with `pnpm install --frozen-lockfile`; `pnpm exec node --version` must be
`v24.20.0`. Direct npm commands must use that runtime. Ordinary tests require
Axiom ingest credentials, absolute pinned Lightpanda 1.0.0 `LIGHTPANDA_BIN`, and
public network access. Container gates require Docker Buildx/Compose and cached
or downloadable pinned inputs. The hosted image renderer needs HTTPS egress to
example.com. The offline hosted build needs Git, OpenSSL, and loopback access.
The local browser runtime needs no live provider credentials.

## Quality and classification commands

Run on the complete committed candidate with the same comparison base:

```sh
habit-hooks --branch origin/main
pnpm exec node script/code-quality/ast-metrics-snapshot.ts --base origin/main
pnpm exec node script/code-quality/ast-metrics-snapshot.ts
pnpm exec node script/code-quality/ast-metrics-process.ts --base origin/main --collect-coverage --json ast-report/process.json
pnpm exec node script/code-quality/ast-metrics-crap.ts --base origin/main --json ast-report/crap.json
```

Reuse compatible coverage instead of `--collect-coverage` when it already
exists. Source, test, or script fixes make the previous coverage stale; a
document-only fix may reuse it. The process runs its own tool lifecycle; do not
start an ast-metrics MCP server. The patched runtime pin is
`0.43.1-thermus.1`; use the repository installer only if required. A first
complete process may add an immutable base record under `docs/metrics/`; commit
the new record. Never edit existing records or refresh the metrics baseline
unless the metrics rules change. Keep `.habit-hooks/snooze.json` equal to `[]`.

After committing the complete declaration and candidate, stamp the local impact
copy from `HEAD:.pr-impact.json` with the actual merge base and HEAD, as
`script/pr-review/README.md` specifies. Then run:

```sh
pnpm exec node script/pr-review/api-surface.ts --check
pnpm exec node script/pr-review/check.ts --base origin/main --repo tomer-mayara/Thermus --impact ast-report/impact.json --base-snapshot ast-report/snapshot-base.json --head-snapshot ast-report/snapshot.json --crap ast-report/crap.json --process ast-report/process.json --review ast-report/review.json
```

A changed listed export requires regenerated and committed declarations.
No such change was found in this inspection. Applicable metrics remain MI 85
for each changed/new production file, changed-function CRAP below 30, and
added-function CRAP at most 15. Record every required retained finding and
exception reason. Record failures, retries, skipped/todo counts, and environment
limits in Validation. Maintain the same two PR comments, Validation and Quality
review; the main description keeps tier, architecture facts, declared impact,
blockers, current linked SHA, and links to both comments. A local ignored report
is not an accessible GitHub artifact link; retain a shareable artifact or pinned
repository evidence before relying on this report in the PR.

## Registry inventory and impact

The baseline has 20 Mermaid blocks. All remain unchanged in this worker's edit:

| Baseline line | View |
| --- | --- |
|32|Context|
|75|C4 containers: hosted edition|
|117|C4 containers: local edition|
|169|Selected C4 components: tool processing in the Node server|
|223|Selected C4 components: hosted authentication in the Node server|
|300|Selected C4 components: tenant role in the hosted image|
|354|Selected C4 components: hosted membership removal in the Node server|
|458|Selected C4 components: hosted Audit logs settings and delivery in the Node server|
|550|Selected C4 components: hosted tenant registry and provisioning in the Node server|
|643|Selected C4 components: MCP gateway and audit relay in the Node server|
|708|Selected C4 components: system and audit logs in the Node server|
|948|Selected C4 components: local authentication in the Node server|
|995|Collaboration overview|
|1084|Scenario: MCP page fetch and renderer cancellation|
|1156|Scenario: hosted MCP call through the gateway|
|1216|Scenario: hosted default sign-in landing|
|1284|Scenario: hosted member read|
|1435|Scenario: tenant provisioning|
|1496|Self-hosted Compose|
|1521|Recorded hosted Render target|

Checked affected areas: hosted authentication L3, containers/source owners,
default-signin landing, hosted member-read and navigation prose, ownership,
behavior/resource ownership, and the collaboration overview. Adjacent membership
removal and Audit views still describe the same authority, calls, and storage.
Context, local/tool/tenant/gateway/logging/deployment views retain their owners,
relationships, protocols, edition choices, and lifetimes.

Web owns protected account routes, HTML, escaping, CSP, and browser form gates.
User-portal owns its browser menu. App supplies trusted configured URLs to web.
Existing organization/session collaborators supply current access and name;
the page performs no membership, destination, or agent-policy write. Registry
prose now records the creation landing, Admin-first menu, and protected guide.
Its drawings remain accurate; do not edit them merely to record review.

## L3 and L4 comparison rationale

The architect flags require a concise comparison in the main PR description
even though the registry drawings do not need edits. Use a supplementary L3
comparison derived from code/prose: one hosted Node-server container with the
existing app, web, organizations, and workos owners, with browser application
as an L2 peer. Mark the app-to-web supplied MCP URL and new browser guide
response as changed meaning. Keep existing access/session/name reads neutral.
Do not draw the page, individual fields, or methods as new components.

Keep these before/after behavior notes beside that drawing:

1. Confirmed creation selects the new organization as before; its redirect now
   opens Quick start. Later login, explicit return, and normal selection retain
   their existing destination rules. Failed selection cannot repeat a grant.
2. A guide read requires the selected session organization, matching current
   subject/authority and organization, product access, exact Admin role, and a
   current nonblank organization name. Query hints grant no authority.
3. The page uses supplied configured portal/MCP URLs and trusted organization
   text; it renders/copies a full guide without credentials or member records.
   Provider failure gives safe refusal, and cancellation stops name-read work.
4. `GET` renders; `HEAD` retains headers with an empty body; other methods give
   `405`. Clipboard success follows the actual write; failure exposes manual
   Markdown. External controls and enrollment remain outside this behavior.

Omit a separate L4 drawing: the strongest changed production callable contract
is `GET/HEAD quick-start` plus the successful-creation destination. The concrete
review question is whether selected-organization Admin authority and trusted
configuration control every displayed/copied guide. L3 plus these gate, failure,
payload, and method notes answers that question. The new required app-to-web
configuration member is a direct composition value, not another runtime flow.
No ADR is required by this change alone; the authorized decision maker may
require one. Manager review, pinned final revisions, a normal-width render of
the supplementary L3, byte-for-byte embedded Mermaid verification, and accessible
evidence remain the manager's final publication work.

## Canonical guide and document review

Manual execution of `quickStartContent` with Acme Engineering and distinct
trusted portal/MCP hosts compared its output to `guide.md` after the three
approved substitutions. Expected 4024 bytes, actual 4018 bytes. Whole-text
whitespace normalization matched. All 23 paragraphs matched in order after
wrapping normalization, and all 6 headings matched exactly. The difference is
line wrapping; no substantive copied-guide discrepancy was found. The exact
approved guide document was not edited.

Five changed documents passed local Markdown-target inspection with no missing
local target. `git diff --check` passed. Registry prose was then updated; no
source/test/tooling behavior was changed by this worker. Product tests,
containers, metrics, checker, and habit-hooks scanning were not run by this
worker. These results must not be reported as complete-candidate gate passes.
