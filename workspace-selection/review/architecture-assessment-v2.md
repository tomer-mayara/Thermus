# Workspace selection architecture review — draft 2

Status: committed source implementation reviewed; no actionable source or
architecture blocker found. Required-gate and final metrics evidence are
still pending. This is independent agent review, not human architect approval.

Base: `77477864d8238b9141e9619b6bcbb6b0aa7fb11b`.
Current red-spec head: `b97215a9875ab04792550d0b57340d1b535faf96`.
Implementation head: `16c8e174f503f79c5011fe9ac7e157578ff49d74`. The reviewed working-tree file hashes
match this committed candidate; source-review-provenance-v2.json retains both
scopes. A later metrics-document-only head requires an explicit input bridge.

## Scope and tier

The reviewed increment corrects the picker default return and adds the same
role-aware native menu to its server-rendered header. The web owner keeps the
route and page behavior. Organizations keeps selection eligibility. WorkOS keeps
browser sessions and current membership/grant reads. No owner or L2 container is
added, removed, or moved.

The optional GET/HEAD picker call to the supplied AccessResolver is a new
runtime use between web and workos inside the hosted Node container. The existing
source edge and callable contract already permit access resolution. The new caller
and phase change runtime collaboration: `classification.internalInterface=true`.
Also set `classification.contract=true`: bare picker GET changes the emitted
return_to default and the successful selection 303 destination across the browser
and server boundary. Explicit safe paths and the POST input shape stay compatible.
Both flags require **T2 Need architect** under the base playbook. A current-candidate independent authorized human architect
must approve before merge. The checker remains necessary and may report additional
facts or blockers. This review cannot supply human approval.

No listed public source module or declaration snapshot changes. All 50 tracked
snapshot files remain byte-identical to the base. AuthorizedOrganization,
AccessResolver, BrowserSession, ReturnDestinations and selection inputs are unchanged.
The private web renderer input adds product and optional admin display data; this
is not a new between-component callable contract. The final checker still must
verify the complete public-surface inventory. Adding role data
to AuthorizedOrganization would change its public snapshot and trigger fact d.
Changing account-form.ts would also select its protected security path.

## Architecture comparison

The standalone source is `architecture-comparison-v2.mmd`. It is a supplementary
C4 Level 3 comparison derived from source and prose, scoped to one hosted Node
container. The browser is an L2 peer and WorkOS is an external system. Arrows are
runtime calls through supplied roles, not source imports. Amber marks changed web
behavior; green marks the added GET picker use. Existing session, directory and
provider calls remain neutral. App composition, identity-owned contracts, unrelated
account operations, MCP, billing, logs and storage are omitted for focus.
The neutral `Auth / switch` label condenses existing session authentication and
the POST-only session switch; it does not mean that GET switches a workspace.

1. **Default return, at web:** before, bare GET organizations emits forms whose
   return_to is the picker itself. After, it emits the normalized public base path.
   Explicit validated return_to values keep their existing destination, including
   an explicitly requested picker. URL validation remains at ReturnDestinations.
2. **Menu, at web:** before, the picker has a brand and Back link without the shared
   menu. After, native links use Connect, Switch Workspace, Members, Audit Log;
   Switch Workspace is current. Only a current allowed selected-workspace context
   with the exact nonempty Admin grant may show the last two links.
3. **Optional display lookup, at web/workos:** before, picker GET lists eligible
   organizations from the session identity without access resolution. After a successful list, it
   resolves current access only when the session-selected organization is offered,
   solely for display. The allowed context must match the session authority,
   subject, selected organization and context user selection, with a nonempty
   tenant, product:access, and exact admin grant with nonempty permissions.
   Denial or an unavailable role lookup must leave the selector usable and omit
   privileged links. Cancellation must propagate. A failed organization list keeps
   the existing request-failed behavior and cookie effects; it is not converted to
   a successful partial list. The optional helper checks abort after resolve and before reporting an error.
   It reports fixed Error text with the original cause attached and returns false;
   request cancellation propagates without a page or report.
4. **Selection authority, unchanged:** POST still checks method, exact Origin,
   bounded form/CSRF/return path, current eligible membership, then one session
   switch. Successful switching returns 303 with session cookies before switch
   cookies. Refusal, sign-out and unknown failure keep their existing outcomes.
   An optional GET display lookup must not gate POST against the old selection.
   Other browser sessions and existing MCP-token organizations remain unchanged.

The new runtime use does not add a new remote API or authority. WorkOS resolution
reads the selected active membership and its role catalog after local authority
and selected-ID validation. Production composition also supplies userManagement,
so successful resolution then attempts a display profile read; that profile is
not used for menu authority. Profile failure is ignored by the existing provider.
The selected-membership request filters user_id, organization_id and active status,
with limit 10; it rejects duplicate, paged or mismatched responses. The pre-existing
list reads all active membership pages and each organization role catalog.
Provider calls retain zero retries and the existing per-call timeout. The existing external HTTPS edge is retained; its new picker context is
identified on the green internal arrow rather than falsely drawing a new provider.

## Registry and L4

The pinned base registry has 16 Mermaid blocks; see registry-inventory-v2.json.
All 16 block bodies remain identical in the reviewed candidate. The registry
adds six prose lines for optional display lookup, recovery, and the default return.
Check Context, hosted containers, hosted authentication components, collaboration
overview, default sign-in landing, member-read prose, ownership and resource
ownership. Existing diagrams already show web using supplied session/access and
organization roles; they may remain accurate without adding a new view. Registry
prose and authentication-design prose now identify the optional picker access
lookup and preserve identity-only eligibility and recovery. Recheck all block hashes
after any further change. Do not edit a diagram solely to record review.

The strongest changed callable behavior is GET /organizations with an omitted
return_to: its emitted form value changes, and a successful subsequent selection
returns 303 to Connect rather than the picker. No new public callable is added and all
public declaration signatures remain unchanged. The concrete review questions are
whether safe explicit destinations remain compatible and whether the optional
lookup changes selection authority or recovery. The L3 runtime context and four
before/after notes answer those questions. L4 is omitted because a function-level
view would repeat the route branches without explaining an additional boundary,
authority, order or recovery rule. Do not claim that no observable callable
contract changed.

## Required verification

The complete source candidate selects npm test, typecheck, portal build, hosted
build, hosted Linux AMD64 image, self-hosted container, selected browser runtime,
habit-hooks and complete source metrics. The new WorkOS organization-read use
selects hosted-live when staging settings are available; an unavailable setting
is recorded as an omitted gate, not passed. Do not inherit PR277's presentation-only
hosted-live N/A. PostgreSQL and Collector are not selected by this focused change.

The reviewed acceptance and browser cases follow bare picker GET through native selection POST, 303 and Connect;
the previous browser helper stopped on reaching the picker. They cover root/custom
public paths, one/multiple workspaces, current roles that differ across workspaces,
denial/outage/cancellation, exact safe explicit return_to, forged/duplicate returns,
no-script keyboard use, skip-link focus, narrow wrapping and unmodified protected
POST checks. Existing selection tests retain cookie ordering and session/MCP
isolation. Prior security assertions are preserved; the adjusted refusal test
uses an explicit existing /team/portal destination because its page spy does not
implement the actual Connect root.

Evidence limits: the new picker browser cases use short fixture names at normal
text size. They do not establish picker-specific long-name or 200% text browser
layout. Existing other-page 200% text results are not relabelled as picker proof.
No-JavaScript checks establish the native picker POST, Connect URL and persisted
selection; they do not claim that JavaScript-dependent Connect content renders
without scripts. Independent review inspected picker-admin-off-320.png and
picker-admin-on-1280.png: compact navigation, active underline, visible keyboard
focus and form layout are readable. No new test for these retained limits is
requested by manager review.

No metrics are called passed by this review yet. Root plans fresh complete unit
and integration coverage because the changed route behavior is exercised by
integration tests and both suites are already selected by the source scope.
Final metrics, public-surface checker and all gate evidence require the committed
implementation head and compatible input provenance.

## Manager review and finalization

The unchanged comparison source matches actual implementation and parses and renders with cached mermaid-cli 12.0.0 and cached
Chromium 136. The PNG is 798px wide and was inspected without zoom. Labels remain
readable, the container title clears its incoming arrow, and the new lookup arrow
has no crossing through a component or unrelated label. Initial render attempts
used the older unsupported `-w` CLI option and an outer label that crossed the
container edge; the current source uses `--size` and places the new label inside.
All label backgrounds remain neutral. The renderer is available; no dependency
or repository tool change is needed.

Manager inspected the v1 drawing at native 798px width and accepted its owners,
boundary, arrows and labels without a diagram fix. Manager and independent source
review agree there is no actionable source blocker. v2 retains the same Mermaid
bytes and rendered PNG; render provenance explicitly records that reuse.

Pending: final metrics/gates/checker evidence,
current-candidate human architect approval and any later change review. Preserve
v1 as the anticipated design record and this v2 as actual implementation review.

## Classification flag reasons

| Flag | Value | Reason |
| --- | --- | --- |
| container | false | Same browser and hosted Node containers and responsibilities. |
| external | false | Same WorkOS integration, SDK operations and credential/configuration; new caller phase is recorded under internalInterface. |
| contract | true | Bare picker GET changes the emitted return_to default and resulting successful selection 303 destination; explicit safe values remain compatible. |
| deployment | false | No runtime placement, isolation, resource or deployment/recovery guarantee changes. |
| crossCutting | false | No new trust boundary or authentication/resilience pattern; current provider and request cancellation are reused. |
| component | false | Same web, organizations and workos owners and responsibilities. |
| internalInterface | true | Picker GET/HEAD newly invokes the supplied AccessResolver for optional selected-workspace display. |
| sensitiveBehavior | false | No admission, authorization, CSRF, membership eligibility, session mutation, cookie ordering or MCP isolation changes. Optional lookup denial/error keeps recovery available. |
| dependencyRisk | false | No library, builtin, dependency configuration or external credential change. |
| policy | false | No quality, development, approval or legal policy changes. |
| uncertain | false | Source, call phases, failure behavior, unchanged authority and observable compatibility change are identified; pending validation is recorded separately. |

## Source evidence at the reviewed candidate

- account-routes.ts:62 changes only the ReturnDestinations fallback argument.
- account-routes.ts:108-129 owns optional lookup admission, denial/outage behavior,
  abort propagation and safe reporting; :154-159 binds the current context.
- account-routes.ts:134-150 preserves POST validation, current selection authority,
  switch and response behavior byte-for-byte apart from line movement.
- organization-selection-page.ts:7-13 adds private rendering inputs; :35-38 renders
  escaped base-aware native menu destinations and focusable main.
- organization-selection-style.ts owns inline CSS; its content-derived CSP hash
  remains at the page owner and no inline handler/script is added.
- workos-provider-organizations.test.ts:157-170 records the added selected-member
  and role read after the existing list; selection remote requests stay unchanged.
- account-routes-workspace-navigation.test.ts covers allowed Admin, User, case and
  substring variants, missing product/role permissions, mismatched identity/org,
  empty tenant, revoked/absent selection, outage and abort without reporting.
- hosted-workspace-selection.test.ts covers root/custom public bases, choosing
  selected/other workspace, role-specific nav and safe explicit Members/picker
  destinations through the hosted HTTP application with the real pinned SDK fake.


## Exact comparison and review status

The reviewed source/test/doc hashes match committed head `16c8e174f503f79c5011fe9ac7e157578ff49d74`.
The selection POST and switchAnswer bodies are byte-identical to the base; their
shared content hash and snapshot tree hashes are in source-review-provenance-v2.json.
All 50 tracked declaration files share the same base/head Git tree object.
This does not replace the final emitter/checker verification.

Source and architecture agent review: signed off, no actionable findings. Manager
source/diagram review: accepted without a source or diagram fix. Required current-head
independent human architect approval is pending and is not supplied by either review.
No metric pass, full test pass, or completed hosted-live gate is inferred here.

Pinned code evidence:

- [Base route](https://github.com/tomer-mayara/Thermus/blob/77477864d8238b9141e9619b6bcbb6b0aa7fb11b/src/interfaces/web/account/account-routes.ts#L107)
- [After picker and lookup](https://github.com/tomer-mayara/Thermus/blob/16c8e174f503f79c5011fe9ac7e157578ff49d74/src/interfaces/web/account/account-routes.ts#L108)
- [After current-context rule](https://github.com/tomer-mayara/Thermus/blob/16c8e174f503f79c5011fe9ac7e157578ff49d74/src/interfaces/web/account/account-routes.ts#L154)
- [Unchanged POST](https://github.com/tomer-mayara/Thermus/blob/16c8e174f503f79c5011fe9ac7e157578ff49d74/src/interfaces/web/account/account-routes.ts#L134)
- [After page](https://github.com/tomer-mayara/Thermus/blob/16c8e174f503f79c5011fe9ac7e157578ff49d74/src/interfaces/web/account/organization-selection-page.ts#L22)
- [After exact provider request assertions](https://github.com/tomer-mayara/Thermus/blob/16c8e174f503f79c5011fe9ac7e157578ff49d74/test/integration/auth/workos-provider-organizations.test.ts#L157)
- [Base registry](https://github.com/tomer-mayara/Thermus/blob/77477864d8238b9141e9619b6bcbb6b0aa7fb11b/architecture/components.md#L190)
- [After registry](https://github.com/tomer-mayara/Thermus/blob/16c8e174f503f79c5011fe9ac7e157578ff49d74/architecture/components.md#L190)
