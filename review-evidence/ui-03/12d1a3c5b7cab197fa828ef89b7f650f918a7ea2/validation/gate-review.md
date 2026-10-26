# UI-03 gate and architecture review

Read-only review by `ui03_gate_review` on 2026-10-26. No build, test, metrics,
provider call or credential read was run. The manager authorized this evidence
file as the sole write. Source and tests are being edited by other agents.
This is a selection and architecture assessment, not a passing check report.

Comparison parent: `origin/codex/ui-01-refined-tabs`,
`a017020ebe2448f5de6cc7d9cbb0700367fc80b1`.
Branch: `codex/ui-03-invitation-disclosure`.
Observed committed head during review:
`2330b7157546a55859db1334d3e50c3333f22626`.
The manager must bind final check evidence to the complete final candidate.

## Selection

The planned source change is inside `src/interfaces/web/`. Select the full
ordinary suite, typecheck, portal build, self-hosted container, hosted offline
build and Linux AMD64 hosted image gates. Select the Members browser group
because its runtime test and shared browser driver change, and because the
ticket needs actual disclosure, native validation and keyboard proof.

The label migration also selects three dedicated groups through real test
consumers. These groups are required even though layout alone selects none of
them:

| Consumer changed for Send invitation | Selected dedicated group | Reason |
| --- | --- | --- |
| `test/acceptance/auth/hosted-live/administration-server.ts` | `npm run test:hosted-live` | `hosted.live.ts` imports the case module. Both its current Admin assertion and send helper use the literal Invite. The command runs both live files. |
| `test/acceptance/logging/audit/hosted-storage-failure.runtime.ts` | `npm run test:logging:postgres` | Its enabled-export/blocked-SQL case submits the invitation form by Invite. Use the complete existing PostgreSQL group. |
| `test/support/in-process/hosted-audit-journey-site.ts` | `npm run test:logging:collector` | The helper submits Invite. `hosted-audit-journey-probe.ts` runs it in the container started by `audit-sender-site.ts` publicJourney; `hosted-audit-journey.runtime.ts` calls publicJourney. Follow the child-process and read-only mounts, not only static imports. |

No standalone search-live proof, Axiom live interface proof or additional
renderer command is selected by invitation presentation. The selected hosted
offline build already includes both renderer runtime files as its final phase.
Do not add `npm run check` as a separate run.

## Invite label inventory

The current production submit label is in
`src/interfaces/web/account/administration-pages.ts` sendForm. Its old Invite to
workspace heading also has explicit rendering assertions. Keep the exact
approved help text and provider error messages: occurrences of the word Invite
there are not submit-label consumers.

Ordinary files with a literal submit label, expected form label, or old heading:

- `test/integration/hosted-admin/account-routes-administration-pages.test.ts`
- `test/integration/auth/hosted-administration.test.ts`
- `test/acceptance/auth/hosted-members.test.ts`
- `test/acceptance/auth/hosted-invitations.test.ts`
- `test/acceptance/auth/hosted-invitation-refusals.test.ts`
- `test/acceptance/auth/hosted-membership-access.test.ts`
- `test/acceptance/auth/hosted-admin-journey.test.ts`
- `test/acceptance/auth/hosted-workos-administration.test.ts`
- `test/acceptance/auth/hosted-workos-role-access.test.ts`
- `test/acceptance/auth/hosted-member-removal-scope.test.ts`
- `test/acceptance/logging/audit/administration-capture.test.ts`

Shared support consumers:

- `test/support/drivers/browser/admin-shell-browser.ts` checks the initial
  Invite button as a 48px target. A closed disclosure hides Send invitation;
  migrate the initial target to the visible Invite member summary, and measure
  the submit after opening. Its real consumer is
  `test/acceptance/auth/hosted-member-removal-browser.runtime.ts`.
- `test/support/in-process/hosted-audit-snapshot-site.ts` invite uses Invite.
  Its callers are `test/integration/auth/hosted-audit-snapshot-lifecycle.test.ts`,
  `test/acceptance/logging/audit/hosted-snapshot-composition.test.ts` and
  `test/acceptance/logging/audit/hosted-customer-export.test.ts`; the last also
  reaches it through `test/support/in-process/hosted-audit-export-site.ts`.
  These are ordinary integration and acceptance groups, already in `npm test`.
- `test/support/in-process/hosted-audit-journey-site.ts` has the separate
  Collector runtime path described above.

The hosted-live case module uses HTTP form parsing and protected submission;
its existing invitation state, role, duplicate, refusal, recording and safe-log
checks must remain. Browser opening is established by the real Members browser
acceptance, not inferred from the HTTP form parser.

Run each changed ordinary test locally before commit after a clean backend
build. Run each selected changed dedicated test with its existing group command.
Preserve send/role/authority outcomes while migrating selectors. No test is
added for documents, this review file or launcher code.

## Commands and prerequisites

Select pinned Node 24.20.0 before direct npm/node commands. The repository pins
pnpm 12.10.1. Install dependencies with `pnpm install --frozen-lockfile` if
needed; `pnpm exec node --version` must report `v24.20.0`.

Ordinary:

```sh
node .cache/ui02/with-test-env.cjs npm test
npm run typecheck
npm run build:user-portal
```

The ignored UI-02 environment wrapper accepts arbitrary command/arguments,
inherits the current working directory, obtains the two Axiom test settings
from the existing main checkout `.env.local`, sets only the allowed test dataset
and the absolute pinned renderer path. It does not log credentials. The UI-01
copy has the same structure. The manager has also prepared a UI-03 wrapper;
use a reviewed equivalent if preferred. Do not publish these wrappers or
credential files. Ordinary tests need Axiom ingest access, public network access
and pinned Lightpanda 1.0.0, including its public-site smoke case.

Browser:

```sh
npm run build:user-portal
npm run build
THERMUS_BROWSER_EVIDENCE_DIR=.cache/ui03/validation/screenshots node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js
```

Needs Playwright Chromium and real built portal assets. Check explicit
JavaScript on/off and 320px/1280px settings. Keep existing shell/Audit regressions
as well as new invitation interactions. No live credentials are needed.

Collector and SQL:

```sh
npm run test:logging:collector
npm run test:logging:postgres
```

Both commands clean-build and run their whole existing dedicated group in
sequence. Both need Docker Engine and OpenSSL. Collector uses isolated internal
networks, native DNS and verified TLS; pinned image pulls need network or cache.
SQL starts disposable PostgreSQL 17 with test TLS and a scoped runtime role.
Neither needs live provider, Supabase or Axiom credentials. The SQL command
selects seven runtime files; Collector selects its integration sender and hosted
journey runtime files. Do not replace these with ordinary acceptance globs.

Containers and hosted offline build:

```sh
npm run test:container
LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda" npm run build:hosted
npm run test:container:hosted
```

Self-hosted needs Docker Engine, Buildx and Compose. The gate retains outbound
network denial and its trusted rules fixture. Hosted offline needs absolute
pinned Lightpanda, Git and OpenSSL in PATH, loopback and free port 46443; it
needs no public network or live credential. The hosted image gate builds and
runs `linux/amd64` explicitly; an ARM64-only or build-only result is insufficient.
It needs Buildx, native/emulated AMD64 runtime and HTTPS egress to example.com.
Its nested `Dockerfile.hosted` build runs the complete offline gate under
`RUN --network=none`. The manager may retain that nested execution as offline
gate evidence when the logs and final candidate inputs prove the run, as UI-02
did; do not claim a separate local execution that did not run. No Axiom or
WorkOS credentials belong in either container gate.

Run builds, metrics source comparisons and image builds in sequence in this
checkout. UI-02 retained an invalid image attempt that captured the parent while
a metrics comparison temporarily changed the checkout. Its later valid rerun
does not validate UI-03. Preserve final candidate/source hashes for new runs.

Hosted live:

```sh
LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda" node <reviewed-task-staging-wrapper> npm run test:hosted-live
```

The documented owner wrapper is
`/Users/tomermayara/.config/thermus/with-workos-staging.cjs`. It uses macOS
Keychain, enforces `sk_test_`, and supplies the three required WorkOS settings
only to its child. Its origin allowlist is stale: it permits only the prior
3-headed-monkey repository identity and rejects the canonical tomer-mayara URL.
No other active staging wrapper was found. Retained c617 gate harnesses call
that same file and pin other candidates; do not run them for UI-03.

The manager verified both repository identities resolve the UI-01 parent and
will use an ignored task copy with only the exact canonical origin added to the
allowlist. Preserve all Keychain/staging checks. Do not change Git origin,
print the key, change provider settings or copy key bytes to evidence.

The group needs the correct password-only staging profile with MFA disabled
and not required, registered localhost URLs and MCP resource, role/permission
catalog, DCR/CIMD, public network, Chromium, OpenSSL, pinned Lightpanda, Docker
for the scoped removal proof, and free ports 46443 and 46480. Run once at a time;
do not overlap integration tests that bind 46443 or another live gate. The
dedicated command runs `hosted.live.js` then `hosted-removal.live.js`. Preserve
fresh-fixture ownership and cleanup evidence. If setup is unavailable, record
the required gate as deferred, not passed.

## Architecture assessment

Read the component registry, registry workflow, current Web rendering/routes,
and UI-03's required behavior. This change belongs to the existing `web` source
owner in the hosted Node server. It wraps the current protected invitation
form in native Details, changes presentation and adds recovery instructions
beside an existing link. The same trusted member/invitation overviews, allowed
roles, identity-policy facts and scope fields feed the same form and routes.
Cancel is a fresh Members GET. No new script, session state, recovery state,
provider call, read, mutation, storage, resource owner or deployment is needed.

The existing hosted authentication component view already shows web calling
organizations and the provider through supplied roles. The hosted member-read
scenario already ends with combined Members HTML after both complete authorized
reads. Native disclosure does not change those reads. The membership-removal
view and prose retain the authoritative last-Admin decision and safe recovery;
adding instructions does not grant permission or create a new recovery route.
Audit settings/delivery and default sign-in landing stay unchanged. Test-only
consumer migrations do not add runtime architecture.

Inventory: 15 Mermaid blocks, unchanged by the planned increment:

1. Context.
2. C4 containers: hosted edition.
3. C4 containers: local edition.
4. Selected C4 components: tool processing in the Node server.
5. Selected C4 components: hosted authentication in the Node server.
6. Selected C4 components: hosted membership removal in the Node server.
7. Selected C4 components: hosted Audit logs settings and delivery in the Node server.
8. Selected C4 components: system and audit logs in the Node server.
9. Selected C4 components: local authentication in the Node server.
10. Collaboration overview.
11. Scenario: MCP page fetch and renderer cancellation.
12. Scenario: hosted default sign-in landing.
13. Scenario: hosted member read.
14. Self-hosted Compose deployment.
15. Recorded hosted Render target deployment.

The source-owner mapping, Web/organizations/WorkOS responsibilities, behavior
ownership and deployment prose remain accurate. No registry edit or comparison
diagram is needed for this presentation change. No production callable contract
is added, removed or changed; omit L4. No dependency, component, public module,
declaration or security guarantee change is expected. The manager must confirm
these facts against the final diff and checker output; this planning review
does not set the final tier or establish merge eligibility. The test-gate
inventory document remains a protected policy path even if only its browser
inventory text changes; let the trusted checker determine that tier reason.
