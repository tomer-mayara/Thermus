# Live c9 core removal canary and exact cleanup

**Release completion remains false.** The deployed core removal checks passed
and the owned fixtures were cleaned up, but the removed User's post-expiry
portal recovery returned 500. [PR 261](https://github.com/tomer-mayara/Thermus/pull/261)
must supply the recovery fix and actual deployed verification before closeout.
The manager reviewed this projection against the actual observations and
authorized its evidence publication. Recovery remains open and release
completion remains false.

Production runs commit `c9da79e63406e71dd15032d4ab9dfb85f2766918`, whose source
tree exactly matches approved head `2c7b8763025660d3fe3902af7a8433d2741fcb82`.
The manager verified the exact Render deployment live since
**2026-10-26T17:39:22.748353Z**. Its provider identifier stays private.

## Core canary

[Core canary facts](live-core-canary.json) condense the real fixture run: two
organizations, three users and five memberships. Actual browser confirmations
returned User removal 200, self-Admin removal 200, and last-Admin protection 409.
Opening and cancelling User/self removal made no removal POST; each confirmed
action had one POST. The exact removed memberships read back 404 while accounts
and retained memberships remained. The remaining Admin stayed usable.

The same unexpired Target MCP tokens changed from actual server/discover 200 to
403 within 51.764 seconds for User and 64.124 seconds for self-Admin. Fresh
Retained tokens returned 200. These are real OAuth/callback probes, not test
doubles, expiry-as-removal evidence, or tokens derived from browser selection.
The manager used actual browser UI and checked the 390×844 narrow layout.
Private screenshots, names, emails, IDs and session material are not published.

## Audit receipt source

[Audit receipt projection](audit-receipts.json) comes from the actual Axiom query
and three displayed JSON events, independently matched to the private fixture
and durable receipt identities. The actual query URL and raw visible JSON remain
private; this report does not substitute a predicted producer event for receiver
proof. Visible `organization.changed` / `remove-member` events were:

- User applied: 2026-10-26T17:50:47.077Z.
- Self-Admin applied: 2026-10-26T17:52:34.107Z.
- Last Admin: 2026-10-26T18:00:30.975Z, Audit outcome `last-admin`; the durable
  operation outcome is `no-effect`.

Tenant, actor authority/identity and target membership matched exactly. No secret
fields appeared. Actor display names and provider IDs are omitted here.
Fixture Audit setup and disable used the existing product Pg settings API with
exact CAS/readback. This is **not new UI Save/Test setup proof**. Earlier actual
Audit UI Save/Test evidence remains separate and is not replaced by this fixture.

## Cleanup and recovery limit

[Cleanup facts](cleanup.json) record exact owned-resource deletion and readback,
closed fixture contexts, no unknown operation, and cleared fixture credentials.
The destination was disabled by product API first. The manager then used the
owner-only exact disabled-row CAS delete and verified settings absence. Runtime
DELETE privilege was not added. The final last-Admin no-effect safety row remains
and matches the captured receipt; no operation row was deleted. Two applied UI
removals plus final organization/user cleanup account for the five original
memberships; this does not claim five direct membership DELETE calls.

The run's helper phase `complete` describes its canary/cleanup lifecycle. It does
not establish release completion. [Recovery defect](recovery-defect.json)
records actual 500 responses on `/session` and `/organizations` after the removed
User's session expired. Fresh sign-in reached Retained. That workaround does not
make the automatic recovery path correct. Core denial and cleanup passed;
PR 261 recovery correction and live proof remain required.

[Source manifest](source-manifest.json) identifies only the approved run evidence
sources by basename, byte count and hash. Their private originals are retained,
not copied. [Safe artifact manifest](artifact-manifest.json) and
[scan record](secret-scan.json) bind this reviewed projection. The production credential
file and `.env` were never opened. No source, browser, provider or production
mutation was performed by this evidence preparation task.
