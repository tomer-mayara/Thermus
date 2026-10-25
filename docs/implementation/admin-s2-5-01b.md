# S2.5-01b implementation record

Date: 25 October 2026. Status: implemented candidate; final review is in progress.

[PR #253](https://github.com/tomer-mayara/Thermus/pull/253) adds one owner for
membership removal. It is stacked on
[S2.5-01a, PR #251](https://github.com/tomer-mayara/Thermus/pull/251), at
`122d65bf1f035fc195792cc083732aa05c423c58`, and follows the
[approved ticket](../design/organization-admin-plan.md#s25-01b--one-removal-owner-with-durable-per-org-serialization).
S2.5-01c supplies the browser action. This candidate adds no removal route or UI,
role change, MFA, provider, paid service, or live database change.

## Behavior and ownership

`OrganizationAdministration.removeMember` takes the authenticated actor and an
organization ID, exact membership ID, and revision. It copies these inputs before
awaiting. It checks current Admin authority for the requested organization before
SQL admission; a saved selection grants no authority. Missing storage returns
unavailable. There is no in-memory substitute.

The existing `PgDestinationSettingsStore` now also implements the organizations-
owned `RemovalOperationStore`. App supplies the same concrete object and the same
`BoundedSqlRuntime` to logging and removal. One atomic admission statement creates
or replaces one row per organization. Only a terminal row can be replaced. A
pending row returns busy; another organization can proceed through the same pool.
Each statement releases its SQL client before a provider call. No SQL transaction
spans provider HTTP.

After admission, the owner rereads the actor, target, organization, revision,
status, every role, management evidence, and complete active-member pages. Only
ordinary active User/Admin targets can be removed. Unknown roles, including extra
permissionless roles, or missing management evidence refuse removal. Later
records replace duplicate membership IDs. The final target facts must match the
direct read, and the actor must still be an Admin in the page results. The
last usable active Admin cannot be removed. Pending/inactive Admins and
invitations do not count. No factor proof is needed.

A provider result of applied confirms the exact-ID deletion. Unsupported means a
proven refusal with no effect. Other replies or errors leave the effect unknown.
A known pre-send refusal can settle as no-effect; a possible send cannot. The
store completes only the same organization and operation ID, with the same
terminal outcome on repeat. An explicit mismatch stays unknown. An uncertain
completion needs a reread of that exact terminal receipt before the caller can
claim a result. An absent, pending, wrong-org, or replacement row proves nothing.

The receipt stays until a new operation replaces it. An unresolved operation has
no expiry or lease and survives a process restart. Neither current Members reads
nor an unchanged provider record authorizes replay or clears a hold. There is no
worker, queue, status API, or automatic recovery path. Independent WorkOS/operator
writes remain a runbook constraint; the SQL admission is not a global transaction.

## Time and shutdown

The total caller budget is **30,000 ms**, measured by a monotonic clock from the
first authority read through final completion/readback. The active-member scan
allows **10 pages**, each using the existing provider limit of 100. Existing
WorkOS calls retain their five-second timeout and zero retries. SQL keeps its
existing two-second operation budget and pool limits.

The owner checks its lifetime before and after every awaited step, and directly
before deletion without an intervening await. It supplies one optional stop signal
to directory reads. WorkOS checks that signal around each remote read, including
membership pagination, role lookup, and user enrichment. Expiry or close prevents
the next read substep. An already-started provider request still has its existing
per-call bound; the signal does not claim to cancel transport or undo an effect.
Other directory callers omit the signal and retain their current behavior.

The server owns removal work independently of the browser connection. Shutdown
bars new work and stops delayed continuations before closing shared SQL. Late
provider replies after expiry/close are ignored. A terminal SQL write already in
flight can still commit its own receipt after the caller receives unknown. That
write starts only after known no-send or a confirmed provider result. It cannot
settle a replacement operation. Timeout alone proves neither rollback nor remote
cancellation.

Safe `ChangeRecorder` failures cannot change the result, release a hold, or cause
replay. Invitation result types keep their current meaning. Customer removal
Audit capture belongs to S2.5-01c's checked browser boundary, which owns the trusted
tenant. A denied request's supplied organization ID must not select a Collector.
The plan includes applied/unknown sink failures and forged-org capture checks in
that ticket.

## SQL owner action before activation

Apply [the additive migration](../../sql/migrations/20261025082850_membership_removal_operations.sql)
once after the existing settings migrations, through the administrative owner's
secure session. It creates only `thermus_admin.membership_removal_operations`
and its grants/policies. Do not reapply the original migrations or reset existing
credentials. Follow [the existing owner setup](admin-s2-01a-database-setup.md).

The runtime role keeps SELECT, INSERT, and UPDATE without DELETE or DDL. RLS is
enabled and forced. PUBLIC and existing Supabase API roles receive no access to
the new table. This trusted server role is not a browser/tenant identity; the
adapter scopes every operation. Recheck effective privileges in the actual
project before rollout.

No new environment variable, API key, connection pool, or infrastructure is
needed. Existing storage configuration and its encryption key still initialize
the shared runtime. No migration runs at startup. Missing setup stops removal;
current product and MCP access remain usable. Preserve operation rows during
rollback. Unknown holds and restored-data safety require the S2.5-02 runbook and
independent evidence, not row deletion or a new lease. Settings backup remains
separate Slice 4 work.

The local scaffold command used Supabase CLI 2.122.0 but failed because its
inherited permission profile referred to a missing file. No control was changed
or bypassed. The local SQL file uses the repository's timestamped migration
format. Disposable PostgreSQL validated it; no live Supabase migration ran.

## BDD, TDD, and review evidence

The first two public acceptance cases failed on the absent removal method before
source implementation. Focused rules, lifetime, and receipt tests then drove the
owner to green. Separate SQL tests first failed on the absent operations/table,
then passed with the narrow contract and atomic statements. Three child-process
acceptance cases first failed on absent removal/close behavior, then passed after
actual SIGKILL and a fresh process against the same database.

Independent review found that a whole-directory guard still allowed later WorkOS
read substeps after stop. Six real-adapter integration cases reproduced that gap
before the optional stop contract and adapter checks were added. This correction
keeps the timeout guarantee at each provider read boundary. A final write already
in flight remains a separate, explicitly permitted uncertainty.

The controlled checks cover:

- Initial and current authority, unsafe target dimensions, full Admin counting,
  duplicate/later page facts, exact page and cumulative time limits, and shutdown.
- Atomic contention from separate SQL pools, another organization's progress on
  the same one-slot pool during paused provider work, and last-Admin refusal.
- Real process crashes after admission, during provider work, and after a positive
  provider result before final commit. A fresh process returns busy and sends no
  new deletion, even after current Members reads show unchanged provider facts.
- Uncertain writes and exact terminal readback, stale completion, replacement
  membership preservation, and throwing recorders after applied/unknown results.
- The production storage loader's same-object composition and shared close;
  unavailable admission before SQL capacity and unknown admission after dispatch.
  MCP and health remain usable during the blocked real-SQL read.

A manual SQL privilege drill used pre-existing anon/authenticated/service_role
roles, broad owner defaults, and a service_role with BYPASSRLS. API access was
denied, RLS was enabled/forced, and the runtime had only the three intended table
privileges. This is a manual check of the migration, not a test of SQL-file text.

The maintained Validation and Quality review comments on PR #253 pin the final
candidate, actual parent, complete selection against main, red/green and retry
history, metrics, architecture comparison, and required human approval. Local
PostgreSQL, controlled provider fixtures, and staging authentication checks do not
prove live removal, a deployed migration, restore safety, or release eligibility.
S2.5-01c and S2.5-02 retain those separate work items and gates.
