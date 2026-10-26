# PR #255 prospective test selection

Candidate `adf3369a953792208b5c48b8776d3bfeb89c3fb7`; actual parent `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`. This is a conditional plan from pinned Git objects, not a test result. It applies only after #254 is integrated and the complete candidate against then-current main has no changed `src/` path. Against current main `8c6d204e8588a664438ba8934ab36670b802525f`, the complete stack still changes source; the source gates take precedence. Refresh pins and selection after parent integration or any change.

## Rule and actual consumers

The trusted parent's test-gate policy lines 147–180 selects affected groups for test-only changes, dedicated groups before the ordinary folder rule, and the union of real support consumers. Lines 322–325 require an import/runtime trace rather than an all-suite fallback. The candidate changes no production source, public declarations or registry bytes relative to #254. New tests and helper seams exercise existing production behavior; they do not create it.

| Changed helper or fixture | Actual runtime consumer | Selected group |
| --- | --- | --- |
| `test/support/hosted-live/local-https-site.ts`, optional `storageEnvironment` | `hosted-removal.live.ts:76` supplies scoped disposable SQL to default production composition; `hosted.live.ts` uses the default through `LiveRun.site`; `test/integration/auth/hosted-live-site.test.ts` and its `mcp.ts` call default/custom site starts | Hosted live; integration |
| Same HTTPS site helper | `test/support/hosted-live/fetch-public-script-proof.ts:166`, called by `test/acceptance/auth/fetch-public-script.live.ts:6`, starts the default site with real renderer | The documented sequential Public Connect proof group |
| `test/support/hosted-live/live-run.ts`, optional site factory | `hosted.live.ts` uses existing default; `hosted-removal.live.ts:76` supplies factory | Hosted live |
| New `test/support/hosted-live/removal-fixtures.ts` | `hosted-removal.live.ts:80` only; type-only LiveRun edge runs no production behavior | Hosted live |
| New `test/acceptance/auth/fixtures/member-removal-integrated-site.ts` | `hosted-member-removal-integrated.runtime.ts` only; real SQL storage and production HTTP/MCP composition with controlled WorkOS | Private PostgreSQL group |

The static import graph is in [helper-consumer-trace.json](../review/helper-consumer-trace.json). Its graph entries describe load paths; the runtime distinction below is authoritative for selection.

The three ordinary work-slice acceptance files `auth-workos-admin-access.test.ts`, `auth-workos-mcp-url-fetch.test.ts` and `auth-workos-onboarding.test.ts` import `composeWorkSliceApplication` from the manual work-slice entry. That entry imports LocalHttpsSite, but its lines 41–44 execute `run()` only when it is the process entry. These tests call composition and open their own production HTTP bridge; they never call `run()` or `LocalHttpsSite.start`. They are **import-only consumers of the changed helper**, so they do not select the whole ordinary acceptance group. Backend build/typecheck covers this import compatibility.

The real manual work-slice does call `LocalHttpsSite.start` at line 80, with an `application` override at line 83. That bypasses `stagingApplication`, where the new optional storage overlay lives (`local-https-site.ts:86,121–125`). No startup/lifetime/custom-application code changes. Static call/guard review plus build/typecheck checks this unaffected branch. The interactive Google/Claude Code/Axiom workflow is not a required additional run for this optional default-storage seam. It is documented as a manual non-test workflow and changes no selected production guarantee.

## Public Connect pair: selected as one documented group

Only `fetch-public-script.live.ts` is an actual LocalHttpsSite runtime consumer. Its companion `fetch-public-connect.live.ts` uses direct production composition and does not use this helper. The guide nevertheless defines **their dedicated proof group** as both files in one sequential command (`docs/testing/test-list.md:441–460`), and policy line 170 says to use the dedicated command from the test's guide. Select that paired command, not a new script-only group. It is within the selected group and adds no broad offline suite. The shared callback requires serialization.

The actual-script proof creates a private grant directory and fresh exact owned fixtures, validates the designated staging environment and existing first-party Public Connect registration, and uses the production renderer. It changes only private saved `expiresAt` to force refresh (`fetch-public-script-proof.ts:59–61,90,115`); **no 300-second token-expiry wait is required or claimed**. Remote consent removal permits an existing unexpired JWT until forced refresh fails. Local logout only removes the private local grant. Cleanup removes exact owned fixtures and the private directory; never publish grant/certificate contents.

## Concrete launch plan for the validation owner

Do not launch any command from this plan until the manager hands off the pinned checkout. Use a single runner for build/runtime steps; `npm run build` clears `dist`. Record complete input hashes, head/parent/current-main, exact command, UTC times, exit, counts, all failures/retries, fixture cleanup and safe logs. Do not alter ports, timeouts, assertions or package selection to avoid a failure.

1. Confirm source-free complete diff and clean tracked files; verify Node 24.20.0, locked installation, and the existing task-owned Docker context. Coordinate ports before any integration or live group. The ordinary integration group contains an indirect fixed TLS front; it must not overlap any 46443 live/site proof. The #254 quality capture already demonstrated this collision; inspect the group, not only top-level imports.
2. Run `npm run test:integration`. This builds the backend and includes the direct hosted-live-site helper tests. The focused debugging command is `npm run build && node --test dist/test/integration/auth/hosted-live-site.test.js`; a successful complete selected integration run also covers these changed-helper cases, so no duplicate focused run is required merely for reporting.
3. Run `npm run test:logging:postgres` with the task-owned `DOCKER_CONTEXT=colima-thermus-s25-merge`. Its seven files include the new integrated runtime file plus all existing SQL removal/restart/storage cases. The new integrated test is selected before commit through this command. Its isolated debugging command is `npm run build && node --test dist/test/acceptance/auth/hosted-member-removal-integrated.runtime.js`; do not count an isolated pass as the full group.
4. Run the complete hosted live command below through the existing staging launcher. It builds backend and portal, then runs `hosted.live.js` and `hosted-removal.live.js` sequentially. Reserve **46443** for the HTTPS front and **46480** for the hosted Connect callback. Docker is required for the new proof's disposable PostgreSQL. Record the exact cleanup evidence under `.cache/s25-02/live` without copying secrets. Keep new removal's 600,000-ms test deadline.
5. After that group closes all fronts/callbacks and containers, reserve **46443 and 46481** for the sequential Public Connect pair. The first proof uses callback46481 and direct composition; the second starts the HTTPS front46443, uses callback46481, and a dynamic backend port. They must not overlap each other or any hosted/integration run. Build backend/portal, then invoke the pair under the same staging launcher. Keep 240,000/660,000-ms proof deadlines. No forced WorkOS settings or application changes are part of this plan.
6. Run `npm run typecheck` and `habit-hooks --branch origin/main` on the complete candidate; retain each smell or correct it and keep snooze `[]`. Backend/portal builds are covered above. There is no general package lint script/config; Habit applies the repository lint rules. Manually check changed JSON/package commands, documentation links/hashes, source-free/API/registry identity, release gates and frozen whitespace. Run the required stamped architecture/tier checker with actual parent; no architecture approval follows from this static plan.

Prerequisites for both live commands: existing configured WorkOS **staging** key/client/issuer supplied privately; expected password-only profile; public network access; installed Playwright Chromium (or existing `PLAYWRIGHT_CHROMIUM_EXECUTABLE`), OpenSSL and pinned executable `.cache/lightpanda/1.0.0/lightpanda`. Hosted live additionally needs Docker and existing dashboard application/callback settings per policy. The Public Connect pair expects the designated staging environment and already registered first-party Public application; validation checks them and must not mutate their configuration. The launcher is outside the repository and reads macOS Keychain; never print/read/copy its key into evidence. Reuse the established launcher without showing credential values.

```sh
LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda" node ~/.config/thermus/with-workos-staging.cjs npm run test:hosted-live
```

For the Public Connect group, run builds first, then the launcher command with the two explicit files:

```sh
npm run build && npm run build:user-portal
LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda" node ~/.config/thermus/with-workos-staging.cjs node --test --test-concurrency=1 dist/test/acceptance/auth/fetch-public-connect.live.js dist/test/acceptance/auth/fetch-public-script.live.js
```

The commands above are recipes only and were not executed by this review. Environment bindings, renderer hash, launcher hash and Docker context must be recorded privately/safely by the validation runner. Port observations must be fresh, not inferred from this plan.

## Conditional N/A and deferred boundaries

For the prospective source-free increment, ordinary unit/interface/acceptance suites, `npm test`, `npm run check`, Collector, native container, standalone renderer/search-live/Axiom-live and a separate `build:hosted` are not selected. The shared helper has no active path into the ordinary acceptance cases above; its real integration and dedicated live groups are selected. No standalone whole suite is added solely because a document or package script names it.

The hosted image command nests `build:hosted` and checks beyond these selected groups. Record its omission as **deferred by nested-run scope**, not passed, under policy lines 254–263. Do not modify images/gates to isolate it. The explicit release has separate unchanged deployment, image, capacity, storage, legal/notice and other gates. Source-free metric process/snapshots/CRAP are N/A because no applicable source or metric-tool/config path changes; do not collect extra unit coverage. API declarations/registry are byte-identical to parent; verify rather than regenerate them.

[Legal/hash/link review](../review/document-link-review.md) and [frozen-byte machine evidence](../review/legal-manifest-review.json) preserve the UNAPPROVED proposal, date condition and historical source-pin drift. No product test, approval, merge or release is claimed by this selection.
