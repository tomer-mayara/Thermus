# Workspace selection architecture review — draft 1

Status: anticipated implementation, not final sign-off. The source implementation
has not been reviewed at this draft. Do not publish this draft as completed evidence.

Base: `77477864d8238b9141e9619b6bcbb6b0aa7fb11b`.
Current red-spec head: `b97215a9875ab04792550d0b57340d1b535faf96`.
Final implementation head: pending.

## Scope and tier

The intended increment corrects the picker default return and adds the same
role-aware native menu to its server-rendered header. The web owner keeps the
route and page behavior. Organizations keeps selection eligibility. WorkOS keeps
browser sessions and current membership/grant reads. No owner or L2 container is
added, removed, or moved.

The anticipated optional GET picker call to the supplied AccessResolver is a new
runtime use between web and workos inside the hosted Node container. The existing
source edge and callable contract already permit access resolution. The new caller
and phase still change runtime collaboration. Conservatively set
`classification.internalInterface=true`, which requires **T2 Need architect**
under the base playbook. A current-candidate independent authorized human architect
must approve before merge. The checker remains necessary and may report additional
facts or blockers. This review cannot supply human approval.

No public declaration change is expected. Keep AuthorizedOrganization, AccessResolver,
BrowserSession, ReturnDestinations and selection inputs unchanged. Adding role data
to AuthorizedOrganization would change its public snapshot and trigger fact d.
Changing account-form.ts would also select its protected security path.

## Architecture comparison

The standalone source is `architecture-comparison-v1.mmd`. It is a supplementary
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
   organizations from the session identity without access resolution. After, it may
   resolve current access for the existing selected workspace solely for display.
   Denial or an unavailable role lookup must leave the selector usable and omit
   privileged links. Cancellation must propagate. A failed organization list keeps
   the existing request-failed behavior and cookie effects; it is not converted to
   a successful partial list. Actual reporting and cancellation order need source review.
4. **Selection authority, unchanged:** POST still checks method, exact Origin,
   bounded form/CSRF/return path, current eligible membership, then one session
   switch. Successful switching returns 303 with session cookies before switch
   cookies. Refusal, sign-out and unknown failure keep their existing outcomes.
   An optional GET display lookup must not gate POST against the old selection.
   Other browser sessions and existing MCP-token organizations remain unchanged.

The new runtime use does not add a new remote API or authority. WorkOS resolution
may read the selected active membership, its role catalog and optional display
profile. The existing external HTTPS edge is retained; its new picker context is
identified on the green internal arrow rather than falsely drawing a new provider.

## Registry and L4

The pinned base registry has 16 Mermaid blocks; see registry-inventory-v1.json.
Check Context, hosted containers, hosted authentication components, collaboration
overview, default sign-in landing, member-read prose, ownership and resource
ownership. Existing diagrams already show web using supplied session/access and
organization roles; they may remain accurate without adding a new view. Registry
prose and authentication-design prose must identify the optional picker access
lookup and preserve identity-only eligibility and recovery. Recheck all block hashes
after implementation and document changes. Do not edit a diagram solely to record review.

L4 is omitted because no production callable contract is intended to change.
The review question is the new caller context, fallback default, and optional
failure/cancellation behavior. L3 plus the four notes answer that question. If the
implementation changes a public callable contract, revisit this rationale.

## Required verification

The complete source candidate selects npm test, typecheck, portal build, hosted
build, hosted Linux AMD64 image, self-hosted container, selected browser runtime,
habit-hooks and complete source metrics. The new WorkOS organization-read use
selects hosted-live when staging settings are available; an unavailable setting
is recorded as an omitted gate, not passed. Do not inherit PR277's presentation-only
hosted-live N/A. PostgreSQL and Collector are not selected by this focused change.

Coverage must follow bare picker GET through native selection POST, 303 and Connect;
the previous browser helper stopped on reaching the picker. Cover root/custom
public paths, one/multiple workspaces, current roles that differ across workspaces,
denial/outage/cancellation, exact safe explicit return_to, forged/duplicate returns,
no-script keyboard use, skip-link focus, narrow/200% text, cookie ordering and
unmodified session/MCP isolation. Keep prior security assertions meaningful.

## Manager review and finalization

The comparison parses and renders with cached mermaid-cli 12.0.0 and cached
Chromium 136. The PNG is 798px wide and was inspected without zoom. Labels remain
readable, the container title clears its incoming arrow, and the new lookup arrow
has no crossing through a component or unrelated label. Initial render attempts
used the older unsupported `-w` CLI option and an outer label that crossed the
container edge; the current source uses `--size` and places the new label inside.
All label backgrounds remain neutral. The renderer is available; no dependency
or repository tool change is needed.

Pending: actual implementation review, final head pin, registry/code line-bound
links, final diagram/code consistency, manager feedback and any revised diagram.
Preserve this draft when revising.
