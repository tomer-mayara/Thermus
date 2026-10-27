# Workspace selection source and architecture review — v4

Trusted base: `a421afc056ce3e400f2779c75683ea45270b96cb` (SO-02 / PR282).
Combined source candidate: `e36e34c9304444312b52d76cc1c91aa365ccc719`.
Prior approved candidate: `feaddbdec5f9e2cc7bf8e07050a4d5e7aa5e5769`.

No actionable source or architecture blocker was found. This is independent
agent review, not human approval or a claim that current candidate gates passed.
All prior source, metric, render, test and exact-head approval records remain
preserved. Final generated-record head is not yet known.

## Source and contract proof

The complete src/ and test/ trees are identical to prior reviewed feaddbde.
All three picker production files have the same Git objects and SHA-256 hashes.
The new merge inherits SO-02 files unchanged from a421afc0; only the impact
declaration required conflict resolution. Its retained picker flags and meaning
are identical to feaddbde. The registry contains both the picker prose and the
inherited release-path prose. Source-review-provenance-v4.json records each
incremental file, exact hashes and source-tree proof.

The independent current-base read confirms:

- account-routes.ts:62 defaults omitted return_to to the normalized public base
  pathname. Safe explicit values retain their exact validated value, including
  an explicit picker return. This changes the default form output and later 303
  destination across the browser/server boundary.
- Lines 108–117 retain identity admission and the authorized list before optional
  menu resolution. Only a listed session-selected workspace triggers that read.
  Lines 154–159 bind both selected-organization fields, authority and subject,
  nonempty tenant, product:access and exact admin grant with permissions. A role
  in another workspace cannot show the privileged links.
- Lines 120–129 return the basic menu after denial/mismatch or an ordinary lookup
  error. The fixed outer failure text retains its cause; the existing reporter
  stringifies the fixed text. Cancellation propagates before reporting or page
  return. Organization-list failures retain the existing safe failure page and
  session cookie effects rather than a partial picker.
- Selection POST and switchAnswer at head lines 134–151 are byte-identical to
  actual base lines 121–138. This exact slice hashes to
  `50c3dd600af6703afd7011855a8c28b0d7b8adc4420a70ed09f7fd272d7cb1b3`.
  Origin precedes body work, then bounded form/CSRF/return validation, current
  membership authorization and one session switch. Optional access resolution
  is not added to POST. Cookie precedence and refusal outcomes remain unchanged.
- The native menu keeps Connect, Switch Workspace, Members, Audit Log in order;
  only the last two depend on current Admin. One Workspace navigation region,
  current-page marker, visible keyboard focus and a focusable skip target remain.
  Escaped anchors and forms use the public base; no script is needed to select.
  CSS and its content-derived CSP hash stay coupled in the renderer.

The existing downstream reads retain their owners and limits. Organization
listing reads active membership pages and per-organization role catalogs.
The optional selected-workspace resolver performs one filtered active membership
read for user/organization (limit 10), rejects duplicate, paged or mismatched
answers, then reads its role catalog. Its existing optional profile read supplies
no authority and tolerates failure. All retain the existing five-second per-call
timeout and zero retry. No new external integration or selection authority arises
from that new caller phase.

## Actual-base architecture and impact

All 17 Mermaid block bodies and all 51 public declaration snapshots are identical
between a421afc0 and e36e34c9. Registry-inventory-v4.json records every view's
heading, line bounds and body hash at both revisions. The picker adds six prose
lines only. No public module joins/leaves the surface, declaration changes, new
component/import edge, new cycle or deployment change is introduced by this
increment. Final checker output is still required; manual source review does not
replace its complete facts.

The impact declaration correctly sets contract=true for the changed omitted
return default and internalInterface=true for the added optional picker GET/HEAD
AccessResolver use. This keeps T2 Need architect. Each other flag remains false:

- container/external/component: the same control-plane owners, process and
  WorkOS integration remain; no component or container is added by the picker.
- deployment/crossCutting/policy: SO-02 delivery and its authority/policy are
  inherited from the actual base, not changes of this increment.
- sensitiveBehavior: identity, selection authorization, current-membership
  authority, session effects, recovery and MCP isolation keep their existing
  requirements. The optional display read cannot authorize an operation.
- dependencyRisk: no package, builtin, public boundary or dependency change.
- uncertain: the caller phase, trust bindings, outcomes and limits are understood.

SO-03 tenant composition, signed context and audit relay remain inherited.
Default hosted role selects the control plane; only explicit tenant selects the
separate tenant composition. Picker traffic does not invoke tenant, gateway,
signed-context admission or relay work. No new setting or migration is required
for the existing browser flow. This does not certify future tenant provisioning
or erase its ordered release requirements.

SO-02's build/gate/push and manual image-deploy path is also inherited. The
manager reports fresh Render API readback at 22:24 UTC: production runtime docker,
Thermus repository/main, automatic deploys off, last live commit 6e2c. This is
manager-supplied current evidence, not this reviewer's cloud read. It agrees with
README's Git-production state until SO-12 step 5. The image workflow refuses a
non-image service. An exact-commit Git release remains compatible with current
mode; no image conversion, key/configuration change or production workflow
dispatch is implied. Upstream-release-assessment-v4.md records the detailed policy.

## Comparison and render bridge

Pr-architecture-comparison-v4.md is ready for manager review as the source-head
draft. It pins e36e34c9/a421afc0 and includes inherited SO-03 and SO-02 context.
Architecture-comparison-v4.mmd is byte-identical to manager-approved v3 source,
SHA-256 `2a68a084122b65861f40cee83b04f94d9ea940c10387779d71f6fb3fea6410a1`.
Its embedded Mermaid matches exactly. Render-provenance-v4.json reuses the actual
798 by 1615 pixel v3 PNG and its hash without running a renderer again. The owner
responsibilities and runtime change are identical; no render content changed.
Prior manager inspection and approval remain in history. Manager review of the
updated pins and context is still required for this v4 draft.

L3 stays scoped to the control-plane Node container. Existing calls are neutral;
changed web behavior is amber; added optional picker GET caller use is green.
The neutral WorkOS HTTPS edge remains. Auth/switch condenses session work and the
POST-only switch. Composition, identity-owned contracts, unrelated account routes,
MCP, inherited tenant/gateway/relay and release delivery are omitted for focus and
named in the notes, not represented as new runtime components.

The strongest changed callable behavior is omitted GET return_to plus the later
selection 303 destination. L3 plus the four behavior notes answers redirect
compatibility, caller phase, authority and recovery. L4 would repeat internal
branches without resolving an additional boundary question, so it is omitted.
Do not claim that no observable callable contract changes.

## Gates, approval and limits

Fresh coverage and selected ordinary, hosted, self-hosted and browser checks are
running under the manager and isolated worker. The manager reports native AMD64
run [40595080704](https://github.com/tomer-mayara/Thermus/actions/runs/40595080704)
running on e36e34c9. No result is inferred. The fresh hosted-live 29-case run is
planned after the generated metric record commit and clean final head; it is
not yet a pass in this assessment. Current metric process/checker, habit-hooks,
retention evidence and final-head provenance still need their actual pins.

SO-02 changes script/ and .github/ bytes included by coverage input identity, and
script/ files are TypeScript and Docker check inputs. Old verified coverage is
not compatible merely because src/test match. Fresh complete selected unit and
integration capture must supply the new candidate's measured CRAP/process. Do
not alter old capture metadata or report original source runs as current runs.
The prior MI/CRAP design dispositions remain source reasoning only until fresh
reports establish their current values and provenance.

The owner explicitly approved feaddbde, as reported by the manager. Preserve that
exact approval and scope. It does not identify e36e34c9 or the future generated
record head. Current T2 human approval must cover the current head and scope.
Agent source/render review cannot provide or silently extend it.

The retained screenshot limits remain: no picker-specific 200% text or long-name
browser proof; older screenshots are not fresh captures. No-JavaScript evidence
covers the native picker, redirect URL and persisted choice, not rendering of the
JavaScript-dependent Connect page. No new tests are requested for those limits.
This reviewer ran no build, test, MCP, render, release script or production action
and changed no tracked file. The final metric-record commit will need a separate
input bridge; no final-head sign-off is claimed in advance.
