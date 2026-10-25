# S2-04 post-merge verification

Initial read-only review. No browser, test suite, build or deployment action was
run. The manager later authorized the isolated real-pool read-only probe recorded
at the end of this checklist.
Owner approval is recorded by the manager for Thermus candidate
`85206b1c22dab78e8379d7a10e2f2b9ac31af9c6`, Marketing candidate
`1cd32b128698b95f624f0fed15ca3c58d95a62d0`, the exact v3 legal package, existing
internal organization disposition and destination token. Merged Thermus main is
`a7411fd02aa6dd3300b334d4585f71469071b499`; Marketing main is
`a53783560778cb0e568ca26838c7af226dc41dfc`. Render deployment
`dep-dbelpffb9u1s73a5l5bg` was building at dispatch. Do not treat that as live.
The ledger's earlier pending-approval statements predate this owner decision.

## Retain the proved gates

Keep the final ordinary/type/portal, AMD64 image, hosted-live, PostgreSQL,
Collector, declarations, metrics/checker, Habit Hooks and architecture evidence.
The merged source has current-head owner review. Keep the real restricted-role
client-to-pooler TLS, actual settings persistence/reconnect/CAS/tenant isolation,
bounded query failure, local Axiom receipt and $0 resource evidence. None requires
another broad suite. Backups remain future Slice 4. No new production organization
or signup acceptance is needed for the approved internal-organization scope.

## Small deployed sequence

1. **Confirm deployment and presentation.** Wait for the named Render deployment
   to become live on the merged Thermus main SHA. Read `GET /healthz` (`ok\n`),
   current Admin product access and the actual served Audit help. Confirm public
   `/terms/` and `/privacy/` at the approved Marketing revision, signed-out
   `https://app.thermus.ai/signup` Privacy, and readable links. Record approved
   versions/hashes and visible content. Existing-user Continue records no new
   agreement; preserve earlier records and cite the approved internal-org
   disposition. Do not create a new organization to manufacture an acceptance.
2. **Save disabled and check authority.** In the existing Thermus AI Admin
   session, open `https://app.thermus.ai/logging`. Save the approved full Axiom
   OTLP HTTPS endpoint, dataset `audit-log-test`, auth Bearer and dataset-scoped
   token, with Enable unchecked. Expect POST `/logging/save` 303, then a fresh
   GET showing the saved destination/revision, token present and a blank token
   input. Record no token or ciphertext. Use the existing User session to read
   `/logging` and POST Save/Test with its own session protection: expect 403.
   With the Admin's fresh form and valid Origin/CSRF, change only the submitted
   `organization_id` to an owned other-tenant marker: expect 409 and reread the
   original row unchanged. This checks the deployed tenant boundary; the actual
   store isolation proof already covers distinct rows. No second organization,
   membership change or provider invite is needed.
3. **Prove saved settings after one controlled restart.** Before Enable, use one
   scoped same-source process replacement/redeploy for the explicit restart
   requirement. Record before/after deployment/source and keep the existing key
   and database configuration. Reread the same revision, endpoint, dataset, auth,
   disabled state and token-present flag. Run **Test saved destination once**
   after restart, with no unsaved edits and blank token. Expect the accepted Test
   notice and one actual Axiom `audit.destination.test` receipt for the saved
   revision, correct organization/actor, and `synthetic.type=destination_test`.
   Reread to confirm Test did not save, change revision or enable. This single
   Test also proves the restarted app can decrypt/use the persisted credential.
   It proves one receipt, not durable storage or future delivery. Do not restart
   merely to manufacture outage evidence.
4. **Enable and prove real MCP/Admin export.** Check Enable and Save once, keeping
   endpoint/auth/dataset and blank token. Expect 303 and an enabled saved row with
   a new revision. A disabled metadata snapshot can remain fresh for 30 seconds;
   after it expires, one harmless activity loads metadata for future activity.
   That cold trigger need not be exported. Allow its bounded read to finish,
   then use the already-authorized MCP CLI connection for one unique harmless
   marker call. Use the tool `getURLAsMarkdown` with
   `{"url":"https://example.com/","reason":"S2-04 <unique-marker>"}` at
   `https://app.thermus.ai/mcp`. Check the product result and Axiom
   `mcp.tool.completed` receipt for that marker, correct tool, organization and
   actor. Then submit one **unchanged Save** from a fresh enabled Admin form.
   It provides `audit.destination.changed`, action `save`, outcome `unchanged`,
   without an invitation, mailbox, membership or extra destination mutation.
   Check its actual Axiom receipt. Do not rerun invite/resend/revoke merely to
   reproduce the already-passed complete Collector journey.
5. **Close the record.** Record the small destination canary, exact source and
   deployment, receipt times/identifiers, refusal results, persistence and any
   cleanup. Confirm Admin settings still show the intended final enabled state
   and ordinary MCP access still works. Check that application/System output
   does not contain the unique captured marker or credential. Keep intentional
   destination configuration; remove only temporary owned fixtures, if any.
   Enable main auto-deploy after this approved rollout is verified, within the
   user's existing instruction. Record its actual readback. Retain bounded
   delivery/loss/duplicate and no-history/no-backup limits.

These are planned checks, not results. If Test or export fails, preserve the
failure and actual saved state before retry. A success page alone does not prove
Axiom receipt. No new paid resource, retention change or broad load test is needed.

## Exact interfaces and retained specifications

- `src/interfaces/web/account/logging-routes.ts:24-26,30-46,53-115`: GET
  `/logging`, POST `/logging/save`, POST `/logging/test`; current Admin checked
  before service access. Refusals are 403 for User/Origin/CSRF and 409 for a forged
  tenant or stale revision. Browser form values come from the fresh page.
- `src/interfaces/web/account/logging-form.ts:6-22`: fields `csrf_token`,
  `organization_id` (trusted tenant, not a provider selector), `expected_revision`,
  `endpoint`, optional `axiom_dataset`, `auth`, `token`, optional `enabled=on`.
- `src/interfaces/web/account/logging-page.ts:14-43`: visible help, blank saved
  token input, disabled/enable control and saved Test button.
- `test/acceptance/logging/hosted-destination-settings.test.ts:60-79,140-157`:
  User/refreshed-Admin refusal, stale revision, forged tenant and unchanged state.
  `hosted-destination-test.test.ts:9-31,116-128`: dataset Save/Test/Enable and Test
  refusals. These already passed; use their outcomes as manual references.
- `src/interfaces/mcp/fetch-tool-server.ts:25-33` and `fetch-tool-schema.ts:4-12`:
  actual tool name and required `url`/`reason`. Existing CLI registration is
  separate from the Production browser client; preserve its intended org.
- `src/logs/audit/audit-snapshots.ts:33-50` and
  `audit-snapshot-state.ts:10-13`: activity refresh, cold-event omission and
  30-second metadata freshness. No idle polling or guaranteed Enable-event
  export. The dispatch owner still rechecks current enabled/revision authority.
- `test/acceptance/logging/audit/hosted-audit-journey.runtime.ts:28-90` and
  `test/support/in-process/hosted-audit-journey-site.ts:70-113`: complete saved
  Test, enable, warm activity, MCP and Admin receipt oracle; real TLS/Collector
  with controlled WorkOS/operations/settings. Production uses actual Axiom.
- `test/acceptance/logging/audit/destination-settings.runtime.ts:9-26`:
  real PostgreSQL reopen and cross-tenant proof. Actual pooler local proof is
  `live-store-proof.json`; neither alone proves Render process replacement.

## Outage requirement: literal rule and evidence limit

`docs/implementation/admin-s2-01a-database-setup.md:108-112` says:

> Before enabling Slice 2, prove the actual pooler TLS connection and restricted
> role, source-contract persistence across restart, concurrent revision conflict,
> tenant isolation, bounded acquisition/query failure, and MCP availability during
> outage.

Lines 121-123 keep those actual proofs as rollout gates and say local PostgreSQL
acceptance does not satisfy them. The text does not require causing a production
service outage. Its selected-pooler and local production-store proof can be
controlled; it gives no authority to pause or exhaust the shared database. The
owner-approved scope explicitly excludes a shared-DB outage drill.

The actual-pooler artifact proves a query refusal in 2,009ms and reconnect,
revision and isolation behavior. It does not record a separate acquisition
failure or a simultaneous admitted MCP call against that failing pooler.
The retained final PostgreSQL gate covers source nonblocking behavior in
`hosted-storage-failure.runtime.ts:17` and `:73`: a real PostgreSQL lock blocks
settings/queue authorization while admitted MCP and health succeed; the second
case also completes Admin work, starts no destination send and bounds cleanup.
WorkOS, renderer and database fixture are controlled. The ordinary/final hosted
checks also include `hosted-snapshot-composition.test.ts:105` for successful
MCP/Admin work with no storage and discarded capture.

Thus the combined evidence is actual pooler bounded query failure plus controlled
real-PostgreSQL/source nonblocking proof, not a simultaneous live Render/Supabase
outage experiment. Preserve that limit and the owner's no-drill scope. Do not
reopen passed tests or introduce a production outage as a new release action.
If a final release record claims both actual acquisition failure and simultaneous
live MCP availability, that claim needs its own retained evidence; it cannot be
inferred from the current artifacts.

## Public copy scope: narrow follow-up, no added rollout gate

Marketing PR27 changed legal pages only. The exact broader copy still present is:
“Hosted early access does not provide customer audit-log access or export.”
It appears at `src/pages/index.astro:164`, `content/guide/index.md:11`,
`content/guide/audit-logs.md:5`, `content/guide/data-leaks.md:11`, and
`content/guide/deployment.md:23,53`. Deployment line 59 also says customers have
no access/export in this offer. `content/guide/pricing-hosting.md:20` calls it a
personal User offer with no Audit export. `public/auth.md:35` has the equivalent
claim. The complete generated guide `/thermus.md` and personalized topic copies
inherit this source; they need no independent wording owner.
`tests/free-hosted-signup.test.mjs:115-123` explicitly requires the old sentence
in built homepage and complete guide, so a copy-only change must update that
assertion with the chosen scope.

The personal public offer grants User, not Admin, and this release is the
existing internal Admin organization's controlled rollout. The qualified public
offer limit can remain true; it is not proof that no internal Admin can export.
The blanket phrase now reads more broadly than that scope and sits beside new
legal disclosures of optional Admin export. The docs do not establish a separate
technical allowlist that restricts the feature to the internal org.

Minimal follow-up: qualify these repeated claims as **the public personal
early-access offer**, and distinguish a separate controlled internal-organization
Audit rollout from general customer availability. Keep operator logs separate
from customer Audit export and retain no-history/best-effort limits. Update the
single source copies and the corresponding assertion in one narrow Marketing
follow-up. Do not change the frozen legal package, promise public availability,
require a new production signup, or block this approved internal canary on that
copy follow-up. This reviewer made no edit outside this ignored checklist.


## Safe local acquisition/MCP probe: original feasibility plan

A one-off local probe can close the precise acquisition/nonblocking gap without
changing Render, any provider configuration, shared database state, rows,
migrations or locks. Use existing compiled modules; no new build or test is
needed. Keep the output to result booleans, elapsed times and sanitized bounds.
Do not print URI, password, CA contents, tokens, raw claims or driver errors.

1. Create one local `pg.Pool` for the actual restricted Supabase role, official
   CA and normal hostname verification, with `max:1` and a unique probe
   `application_name`. Parse the URI into explicit connection components as
   production does, so URI SSL parameters cannot replace verified TLS. A
   read-only connection/preflight may establish identity/TLS, then hold the sole
   acquired client without a transaction, lock or long query. This consumes only
   one ordinary connection, not database work or a shared resource outage.
2. Pass that same pool to the public `new BoundedSqlRuntime(pool, bounds)` and
   `new PgDestinationSettingsStore(runtime)`. Set runtime `active:2`, acquisition
   1,000ms and operation 2,000ms; the underlying pool still has one held client.
   A store read on a unique synthetic tenant now waits on physical acquisition,
   not the runtime's pending queue. Record `pool.waitingCount` and that the read
   returns `unavailable` within its bounded acquisition time. Do not write a row.
   Calling `createPgSettingsRuntime({active:1})` then holding its runtime slot
   would instead exercise admission/operation timeout, so that is not this proof.
3. Compose the real hosted MCP application with **this exact store** through
   `composeWorkOSApplication` (`src/app/hosted-workos-application.ts:92`), or its
   existing pass-through `composeApplicationWithWorkOSFake`
   (`test/support/in-process/workos-site.ts:57`). Supply `loggingStorage` with
   this store and runtime cleanup. Use only a loopback `WorkOSFake` for identity,
   memberships and Connect signing, and explicit harmless `toolOperations` for
   a fixed fetch result. Production composition supplies the real MCP server,
   authorization/access resolution, Audit snapshots and store path. These local
   identity/tool controls must be named in the result; this does not prove live
   WorkOS, renderer or public network behavior again.
4. Prepare the local MCP connection before timing. Start a real-store read while
   the only client is held; once acquisition is pending, call `getURLAsMarkdown`
   through the actual MCP SDK transport into `application.handle`. Check the
   expected public result while the same store read remains unsettled, then its
   bounded `unavailable` result. Successful tool completion also schedules Audit
   metadata through that same store; it must not create a destination send.
   No saved settings or destination token is required. The exact existing model
   is `hosted-storage-failure.runtime.ts:17-71`, replacing its PostgreSQL lock
   with this process's private client hold, and its renderer double with the
   declared fixed tool operation. Do not copy the lock or fixture migration.
5. In `finally`, release the held client, allow expired acquisitions to settle,
   close MCP/application/runtime and the loopback fake, and confirm the local
   pool has ended. `BoundedSqlRuntime.execute` already destroys/releases late
   acquired clients after expiry. Keep a hard outer deadline and preserve any
   unexpected failure; do not print sensitive exception objects.

The helpers need no provider call: `WorkOSFake.start` only starts its local API
and signing keys. Its cleanup dependency is `after`; a local cleanup registry
and abort signal can replace the test runner context. The MCP SDK can be created
and connected directly. `composeWorkOSApplication` does not need
`HostedPortal.load` or a portal fixture for a direct MCP request. Existing `dist`
contains the required application, runtime and fake modules. No probe has been
created or executed by this review. This is a proposed concrete way to satisfy
the existing runbook's actual-store acquisition/MCP limit, not an extra gate.


## Actual isolated pool/MCP result

The owner-authorized probe now passed, exit 0, using
`pnpm exec node ast-report/s2-04-rollout/real-pool-acquisition-proof.mjs`.
`real-pool-acquisition-proof.json` is the complete sanitized result; the adjacent
`.mjs` is the retained one-off script, not a source test or build change.

- Actual selected Supabase pooler, restricted `thermus_logging` role, verified
  client-to-pooler TLS 1.3, official CA and default hostname verification passed.
  Schema USAGE and table SELECT/INSERT/UPDATE are true; schema CREATE and table
  DELETE are false. The one preflight SQL query was read-only. The saved
  production destination was not read or changed by a settings query.
- The local pool had max one and held its sole idle client outside the production
  SQL runtime. Actual acquisition waited; store read returned `unavailable` in
  1,004ms with acquisition bound 1,000ms and operation bound 2,000ms. Only the held
  client had been acquired, so no settings query could start. No rows,
  transaction, lock, migration, provider configuration or Render state changed.
- The same store was injected into the real hosted application/MCP composition.
  The admitted MCP tool returned its exact controlled result in 30ms while the
  actual pool acquisition was pending. Production portal health returned 200/ok
  during the same pending interval. WorkOS identity/directory/token signing used
  a loopback fake; the fetch operation returned fixed harmless text. These
  controls do not prove live WorkOS or renderer work, and this is not a deployed
  production outage. No destination sender was configured in this composition.
- Held client, MCP client, application, runtime, pool and local fake all closed.
  Final pool total/idle/waiting counts were zero. Source and complete compiled
  dist fingerprints matched the verified source-185 build before and after the
  probe; final current HEAD was 85206b1c. The broad input fingerprint differed
  at preflight and its cause is not attributed. No secret-file hash is retained
  or published. This result is a one-off source/dist-bound probe, not coverage
  reuse. The original verified coverage report was not changed.
- Two prior preflights stopped before configuration/connection: plain Node
  22.14.0 instead of pinned 24.20.0; then the broad input mismatch on Node24.
  They remain in `real-pool-acquisition-preflight-node22.json` and
  `real-pool-acquisition-preflight-inputs.json`. Neither is a database failure or
  an outage attempt. The successful probe uses exact source/dist binding with
  the manager-authorized explicit input limit.

Combined with the earlier actual-pool query failure in 2,009ms, this closes the
identified actual-store bounded acquisition/query and simultaneous isolated
production-composition MCP availability gap. It does not require a shared-DB
outage drill or repetition of passed gates. Actual Render deployed presentation,
Save/Test/Enable/receipt and saved-settings process-replacement checks remain the
separate sequence above until their outcomes are recorded by the rollout owner.
