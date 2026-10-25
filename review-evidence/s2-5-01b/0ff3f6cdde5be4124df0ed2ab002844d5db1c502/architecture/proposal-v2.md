# S2.5-01b architecture proposal v2 — working draft

Base: `122d65bf1f035fc195792cc083732aa05c423c58`, the actual
`origin/codex/s2-5-01a-membership-deletion` parent. Head: uncommitted working
draft of `codex/s2-5-01b-removal-coordinator`; no final head SHA is asserted.
This proposal changes only files in `.cache/s25-01b/architecture/`.
V2 incorporates the manager's stop-propagation correction, which is being
implemented. Check the final source and refresh provenance before publication.
It is not a source review sign-off, final architecture check, or approval.

## Proposed main comparison

Use `comparison-v2.mmd` as the single authoritative L3 comparison in the PR.
It is a supplementary view derived from code and registry prose. The boundary
is the hosted Thermus Node server. PostgreSQL is the existing supporting L2
datastore and WorkOS is the existing external system. Amber boxes have changed
responsibilities or stored data; the green arrow is a new runtime collaboration.
Neutral arrows are retained relationships. No component or container was removed.

Use these four notes next to the drawing:

1. Before, WorkOS exposed exact membership deletion but organization administration
   did not call it. After, `removeMember` checks current Admin authority, admits one
   operation per organization, then rechecks the actor, exact target, revision,
   roles, management, and complete active Admin count before one deletion. The
   read limit is ten pages. There is no browser removal route in this increment.
2. The existing SQL adapter and bounded pool now implement the organizations-owned
   `RemovalOperationStore`. Admission replaces only a terminal row; an unresolved
   row returns busy without a queue or polling. SQL clients are released before
   provider calls. This serializes these application removals, not independent
   WorkOS/operator writes; their restrictions remain a runbook constraint.
3. An uncertain admission dispatches nothing. Possible provider effects keep the
   pending row. A known no-send refusal or proven provider result can write a
   terminal receipt for the same organization and operation ID. If that write is
   uncertain, only a matching terminal readback supports a completion claim;
   absence or replacement proves nothing. No replay or lease takeover is added.
4. The server owns a fixed 30-second monotonic lifetime, independent of browser
   cancellation. Its owned stop signal reaches directory reads; WorkOS checks it
   before and after each remote read so expiry bars new read subcalls and late
   pre-dispatch deletion. Already-started SDK calls keep their existing timeout;
   late provider answers are ignored. A terminal SQL write already in flight can
   still commit for its own operation after the caller returns unknown. App stops
   removals before closing the shared SQL runtime. Safe internal recording cannot
   change the result or hold; customer removal capture remains for S2.5-01c.

This preserves a distinction that a small drawing cannot show: a pending row from
unresolved provider work remains held, but an already-issued terminal SQL write
may finish late. A timeout does not roll back either remote operation. Started
directory requests may also finish after the caller budget; their continuation
cannot start another read or issue deletion. This is not a global transaction.
No MFA or new authentication policy is added.

## Owners and dependency directions

`organizations` owns removal rules, public request/result and store contracts,
the per-operation lifetime, and safe change recording. `MembershipRemoval`,
`RemovalLifetime`, and removal-check helpers are private parts of that owner,
not new C4 components. `audit-logs` owns the existing pg adapter and bounded SQL
runtime. It implements the new role by a type-only import from `organizations`.
`app` supplies the adapter and owns shutdown order. `workos` implements
the neutral directory contract with its existing timeout and no-retry behavior.
Its membership reads now check the optional stop signal around each underlying
remote read. This stops later read subcalls, not an SDK call already in flight.

The new runtime call points from `organizations` to the supplied store instance
inside `audit-logs`. The source type dependency points the other way. That owner
pair already has a permitted type edge for `ChangeOutcome`; this increment adds
use of a new public module on the same edge, not a new owner edge or runtime import.
Do not add an `organizations` source dependency on `audit-logs` to make the map
look symmetric. App's construction dependencies already exist. The comparison
omits app's unchanged WorkOS construction and the type-only arrow to avoid a
crossing through the runtime arrow; this paragraph records both.

No current web or MCP caller invokes removal. App supplies the same expanded
`OrganizationAdministration` to existing hosted routes, but those routes still
call their previous operations. The system-log recorder receives removal outcomes
through its existing safe sink. Existing invitation callers keep `run` behavior.
`ChangeOutcome` gains the bounded refusal values and `record` becomes public;
these are contract changes even though existing invitation behavior is unchanged.
The directory contract also gains optional `signal` parameters on `membershipsOf`
and `member`, and an optional signal on `MemberPageRequest`. Removal supplies its
server-owned signal. Existing browser, invitation, signup, and MCP access reads
omit it and keep their current behavior; none gains a browser cancellation path
through removal. This is a public contract change at the existing owner boundary.
No customer AuditLog removal event is added here. The SQL pool remains optional:
without it removal returns unavailable, while existing product/MCP access does
not become SQL-dependent. The local edition does not acquire this pool.

## Registry edit proposal

Retain stable IDs. Add the focused membership-removal view after hosted
authentication and before the Audit logs section. Use neutral
`registry-membership-removal-v2.mmd`; do not put comparison colors or history in
the registry. The existing large authentication view needs only a responsibility
label update. No private coordinator box or fictitious route is needed.

Five existing Mermaid blocks have small proposed updates, and one focused view
is added. The source files listed below retain all other relationships and
configuration from the current registry. The deployment label changes data scope,
not topology or a claim of live rollout.

| Existing view | Current lines | Proposed source / disposition |
| --- | --- | --- |
| Context | 30–47 | Keep: same people, system, and external parties. |
| Hosted containers | 57–80 | `registry-hosted-containers-v1.mmd`: name private admin storage and include removal intent. |
| Local containers | 89–110 | Keep: local edition has no new runtime or storage. |
| Tool processing | 140–169 | Keep: no tool pipeline change. |
| Hosted authentication | 189–213 | `registry-hosted-auth-v1.mmd`: add checked removal to the organizations responsibility. |
| Hosted Audit settings and delivery | 250–267 | `registry-audit-storage-v1.mmd`: broaden only the PostgreSQL label; the selected logging path is unchanged. |
| System and audit logs | 333–349 | Keep diagram: focused recording/export paths are unchanged. Update the omitted type-edge prose. |
| Local authentication | 535–554 | Keep: no local authentication change. |
| Collaboration overview | 582–610 | `registry-collaboration-v1.mmd`: new account-to-runtime removal call; broaden SQL and datastore labels. |
| MCP page fetch and renderer cancellation | 649–701 | Keep: no pipeline or renderer behavior change. |
| Hosted default sign-in landing | 720–766 | Keep: no signup or sign-in behavior change. |
| Hosted member read | 787–847 | Keep sequence: GET is unchanged. Correct adjacent deletion-use prose. |
| Deployment | 908–942 | `registry-deployment-v1.mmd`: private settings/removal intent label; preserve selected target and unverified rollout limit. |

### Focused view introduction and behavior prose

Proposed heading: **Selected C4 components: hosted membership removal in the Node
server**.

Proposed introduction:

> Scope: one hosted Node server container. Organizations owns the checked removal
> operation and its lifetime. App supplies the existing SQL adapter through the
> organizations-owned RemovalOperationStore role. Thick arrows show composition;
> solid arrows show runtime calls. The adapter's source type dependency points
> from audit-logs to organizations and is omitted from this runtime view.
> PostgreSQL is an existing supporting L2 container. No browser route invokes this
> operation yet; S2.5-01c adds that caller.

Proposed prose after the focused view (link the named source files):

> OrganizationAdministration owns one removal coordinator. It checks current Admin
> authority before admission. PgDestinationSettingsStore admits at most one pending
> operation per organization in a short atomic statement, using the existing
> BoundedSqlRuntime. A conflicting pending row returns busy. Each statement releases
> its client before provider HTTP; no transaction spans those calls. A terminal
> receipt stays until the next operation replaces it. The pending row has no lease.
>
> After admission, organizations rereads the actor, target, roles, management and
> revision, and all active-member pages within the fixed ten-page limit. It refuses
> stale, unsupported, incomplete, or last-Admin removal before calling the existing
> exact-ID WorkOS deletion boundary once. These are current reads, not a remote
> transaction; independent provider/operator writes remain a runbook constraint.
>
> Unknown admission dispatches nothing. A possible provider effect keeps the pending
> row. Confirmed no-send or provider settlement can complete only the matching
> organization and operation ID. An uncertain completion requires a matching
> terminal readback before the caller can claim the proven result; missing or
> replaced rows do not prove completion. No status polling, replay, worker, or lease
> takeover is added.
>
> The server owns a fixed 30-second monotonic budget. It checks the lifetime before
> and after each awaited step. It supplies an owned stop signal to directory
> reads. WorkOS checks that signal before and after each remote read, so expiry
> and close prevent later read subcalls and pre-dispatch deletion. They do not
> cancel an SDK request or roll back a SQL write already in flight. Late provider answers cannot start completion;
> an already-started terminal write may still settle its own row. Removal recording
> uses the existing safe internal recorder; customer removal capture is not wired.

### Other exact prose changes to apply

- Container/source mapping, current lines 122 and 128: include removal intent in
  `audit-logs` hosted work. Rename the mapping row to “Optional hosted admin
  datastore”; retain audit-logs SQL ownership and app runtime ownership.
- Hosted authentication prose, after current line 222: state that removal can
  supply an optional server-owned stop signal to directory reads; WorkOS checks
  it around every remote read. Existing callers omit it and keep their behavior.
- After the Audit storage diagram, current line 269: state that the runtime's
  adapter also implements the organizations-owned removal store on the same pool;
  destination settings and export continue to use their existing contracts.
- System/audit log introduction, current line 326: replace “a type-only
  ChangeOutcome dependency” with “type-only ChangeOutcome and RemovalOperationStore
  dependencies”; both point to organizations. No new log event is implied.
- Collaboration prose, current lines 624–629: add that organizations calls the
  same adapter for removal intent and terminal receipts; distinguish this new
  runtime call from the opposite type-only source dependency. Do not imply that
  identity or billing themselves call the store.
- Member-read prose, current lines 873–875: replace “No browser route or
  administration method calls this deletion boundary. It supplies no admission,
  current-authority, or last-Admin check.” with “The checked administration removal
  operation calls this boundary after durable admission and current safety checks.
  The provider boundary itself supplies no admission, current-authority, or
  last-Admin check. No browser removal route calls the operation yet.”
- Deployment prose, current lines 951–952: describe the existing optional external
  PostgreSQL datastore as storing destination settings and removal intent. The
  new migration still needs deployment verification; do not claim the live project
  already has the removal table.
- Ownership table, current line 983: add removal coordination, last-Admin checks,
  and removal-store/request/result contracts to organizations. Helpers stay private.
- Ownership table, current line 998: add that the private pg adapter stores removal
  intent and terminal receipts through the organizations-owned contract on its
  existing bounded runtime. Keep destination/event responsibilities unchanged.
- Resource ownership, current lines 1062–1076: name the shared hosted SQL runtime.
  Missing/failed storage blocks removal without blocking product/MCP access. Hosted
  close starts MCP cleanup concurrently with the administration/storage chain;
  it stops removal first, then closes snapshots, collector and SQL through existing
  storage cleanup. Pending removal rows and terminal receipts persist across close;
  Audit queues remain memory-only. Already-started terminal writes can commit late.
- Soft-spot paragraph, current lines 1084–1090: keep the invitation ChangeRecording
  behavior and add that removal uses its safe record sink after its own durable
  coordination. The sink does not own admission, settlement, or retry.

## L4 decision

The strongest changed production contract is
`OrganizationAdministration.removeMember(actor, {organizationId, membershipId,
revision})`, with bounded string results and no browser cancellation signal.
Its new `RemovalOperationStore` collaborator exposes admission, exact-operation
completion, and terminal readback. The concrete review question is whether an
uncertain result can lead to deletion without durable admission, repeat deletion,
or a false completion claim after a different operation takes the row. A second
contract question is whether stopped removal can still start another remote read
inside a directory method. The optional read signal and the WorkOS checks in
note 4 answer that question at the provider owner.

Omit an L4 diagram for this increment. The focused L3 owners plus notes 1–4
show the authority owner, phase order, matching receipt rule, stopping outcomes,
and lifetime boundary needed to answer those questions. A separate private-class
diagram would duplicate these rules and could imply that phase helpers are
independent components. The public declaration diff should accompany the main
comparison. If final source changes introduce a new callable recovery path or
new caller, reassess this choice before publication.

## Provenance and remaining review

The v1 inventory remains the pre-correction working-source record; do not cite
its source hashes as validation of the pending stop-propagation fix. All 13
current registry Mermaid blocks are inventoried, with line bounds and
SHA-256 hashes, in `inventory-v1.json`. That file also pins hashes of the working
source inputs. The registry SHA-256 is
`a043ab7147414ff9389291508bfc6941297907f3a8971b52d76eb27f55e9a725`.
The parent registry was read at the exact parent through GitHub:
[parent registry](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/architecture/components.md),
blob `c81e665f179683c6c0775365dfd1d3057844a255`.
Relevant parent code was also read at that revision:
[administration](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/src/accounts/organizations/organization-administration.ts#L35-L83),
[composition](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/src/app/application.ts#L149-L184),
and [SQL adapter](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/src/logs/audit/pg-destination-settings-store.ts#L1-L59).

Expected incremental facts: new organizations public module, changed existing
public declarations, and registry view changes. No component addition, container
addition, new source owner edge, MFA policy, or new provider is proposed.
The final checker decides the exact fact list; T2 requires an independent
authorized human architect's approval of the current candidate.

Draft Mermaid sources have not been rendered or visually approved. The manager
must parse/render each changed source and inspect at about 800 pixels, preserve
the embedded source byte-for-byte, record later fixes in v3 if needed, and recheck the
committed candidate/base before publication. Final head links, complete candidate
tests, metric evidence, declaration diffs, checker facts, and review status are
not supplied by this working-draft proposal.
