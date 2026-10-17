# RHD-01: protected hosted fetch

Status: implementation and verification complete; PR #115 awaits owner review.
Date: 2026-10-15. [PR #115](https://github.com/3-headed-monkey/Thermus/pull/115).
Branch: `codex/rhd-01-hosted-fetch`.
The [Render plan](render-hosted-docker-plan.md) gives the wider release scope.
The manager signed off all three implementation workers and this documentation.
Owner review and merge remain pending. The PR notes track Ready and Actions
status. No deployment or merge is recorded.

## Implemented contract

The production WorkOS opener supplies `getURLAsMarkdown` through the existing
fetch operation and request-scoped MCP servers. Each request needs a valid
WorkOS Connect token and the current User grant. Missing or revoked access is
refused before rendering. Existing input, sanitation, network, renderer, and
safe completion-record contracts remain in force.

One shared slot covers DNS, rendering, cleaning, and cleanup across requests.
There is no queue or new capacity setting. The operation holds the slot until
settlement, including after cancellation. An overlapping call gets this result:

| Field | Value |
| --- | --- |
| Tool result | `isError: true` |
| Text | `Server busy. Try again later.` |
| Completion status | `busy` |

The hosted server reads trusted `AD_RULES_FILE` once at startup and loads the
native cleaner. Missing or invalid rules stop startup before listening. Local
operator commands keep their isolation from rules, renderer, and native modules.
Production rule source, license, version, and update policy remain an owner
choice for RHD-03. Test fixtures do not make that choice.

## Lifetime boundaries

Request and shutdown cancellation apply before token verification and access
resolution. Cancellation ends those waits and prevents tool dispatch after a
late identity result. Hosted account and browser routes check cancellation
before the next stage. A provider call without a cancellation API can settle
later; its eventual rejection remains observed. Real tool cleanup stays owned
until settlement.

DNS has a fixed five-second cancellable wait. The native system lookup cannot
be cancelled. The fetcher keeps ownership of a lookup left pending by timeout
or abort and refuses more hostname lookups until it settles. Late answers
cannot start rendering. Address literals and separate fetchers remain
independent. Normal concurrent fetches remain supported. There is no DNS
answer cache; recovery performs a fresh lookup. This changes no resolver or
address policy.

The hosted CLI starts a fixed 10-second deadline on `SIGINT` or `SIGTERM`.
Normal shutdown exits cleanly. If cleanup stalls or a residual handle keeps the
process alive, it writes `Hosted shutdown exceeded 10000 ms` and exits 1. The
timer stays referenced while `serve()` waits for cleanup, so a stalled wait
reaches the explicit deadline. After `serve()` exits, the timer is unreferenced:
a clean process can exit, while residual handles still reach the deadline.
Self-hosted operation
has no new watchdog. Deadline failure is not a graceful-stop pass.

This slice adds no production enrollment, public root, portal serving, health
route, Origin validation, Docker change, cloud service, or deployment.

## Verification

The manager reported these initial red results. They are failure evidence,
not completed gates:

| Specification | Initial result |
| --- | --- |
| Production hosted tool composition | `tools/list` returned method not found |
| Shared capacity busy result | Generic failure result instead of safe busy result |
| HTTP DNS cancellation | 2/2 cases failed |
| HTTP authentication cancellation | 4/4 cases failed |
| Hosted process deadline with residual handle | Test timed out |

Build once with the pinned Node runtime, then run these new focused files:

```sh
npm run build
node --test dist/test/acceptance/mcp/hosted-fetch-tool.test.js dist/test/acceptance/mcp/http-dns-cancellation.test.js dist/test/acceptance/mcp/http-authentication-cancellation.test.js dist/test/acceptance/mcp/hosted-process-shutdown.test.js dist/test/acceptance/auth/hosted-request-cancellation.test.js
node --test dist/test/unit/mcp/single-fetch-operation.test.js dist/test/unit/website-fetcher/website-fetcher-dns-wait.test.js dist/test/unit/http/request-cancellation.test.js dist/test/unit/auth-workos/workos-session-routes-cancellation.test.js dist/test/unit/hosted-admin/account-routes-cancellation.test.js
```

Run every changed existing test too. The affected files currently include:

```sh
node --test dist/test/acceptance/auth/hosted-startup.test.js dist/test/acceptance/mcp/server-only-modules.test.js dist/test/acceptance/mcp/http-shutdown.test.js dist/test/acceptance/auth/self-hosted-startup.test.js
node --test dist/test/unit/mcp/fetch-tool-server.test.js dist/test/unit/mcp/lifetime.test.js dist/test/unit/website-fetcher/website-fetcher-cancellation.test.js dist/test/unit/auth-workos/workos-session-routes.test.js dist/test/unit/test-support-paths.test.js
node --test dist/test/integration/auth/hosted-administration.test.js dist/test/integration/auth/hosted-organizations.test.js dist/test/integration/auth/local-installation.test.js dist/test/integration/server-stop-signals.test.js dist/test/integration/auth/hosted-account.test.js dist/test/integration/auth/hosted-live-site.test.js
```

This list comes from the changed and untracked test files in the working tree.
The changed `test/acceptance/auth/self-hosted-container.test.ts` runs through
`npm run test:container`; a normal acceptance run skips it. Check the complete
candidate for later test changes. Follow the existing
[required runs](test-gate-policy.md#required-runs) for all gates. The full
integration and acceptance suites include the offline hosted checks, so those
files need no duplicate gate run. The hosted live site now supplies trusted
test rules to its default hosted application; its integration tests exercise
that default composition. Provider live checks remain separate.

The manager reported an initial complete `npm run check` pass: exit 0, server
units 2,507/2,507, portal units 8/8, build tests 10/10, and portal acceptance
4/4, with no failures, cancellations, skips, or todo cases.

After the fixture fixes, the manager reported a new complete-candidate
sequence, all exit 0: `npm run check` passed server units 2,507/2,507, portal
units 8/8, build tests 10/10, and portal acceptance 4/4;
`npm run test:integration` passed 422/422; `npm run test:acceptance` passed
backend cases 326/326 and portal cases 4/4. Each
report had zero failures, cancellations, skips, and todo cases. The logs are
`/tmp/thermus-rhd01/check-final.log`, `integration-final.log`, and
`acceptance-final.log`. Acceptance used the local Axiom credential setup; no
credential value is part of this record.

The initial `habit-hooks` run exited 1 with 126 findings: one renderer length
finding, one unused `using` binding, 117 comment findings, and seven file
findings. A later run exited 1 with 158 findings. The manager reviewed every
location in that report and accepted retention under AGENTS.md, with the
reasons below. `.habit-hooks/snooze.json` remains `[]`. This records an accepted
review result; it does not change the tool exit status to 0.

| Final gate | Result |
| --- | --- |
| Each new or changed focused test | Exit 0: 197/197 across 25 emitted files; container file covered by its dedicated gate |
| `npm run check` | Complete-candidate pass: server units 2,507/2,507; portal units 8/8; build 10/10; portal acceptance 4/4 |
| `habit-hooks`, empty snooze file, retained-finding reasons | Exit 1; all 158 findings retained with manager sign-off below; snooze `[]` |
| `npm run test:integration` | Exit 0: 422/422; no failures, cancellations, skips, or todo cases |
| `npm run test:acceptance` | Exit 0: backend 326/326 and portal 4/4; no failures, cancellations, skips, or todo cases |
| Offline hosted checks | Covered by full integration and acceptance suites |
| Full interface suite | Exit 0: 125/125, including WorkOS, Better Auth, local and public renderer cases, and Axiom |
| `npm run test:mcp:renderer` | Exit 0: 9/9 |
| `npm run test:container` | Exit 0: 13/13 |
| `npm run test:hosted-live`, Optional MFA profile | Exit 0: 77/77 tests in 16 suites; no failures, cancellations, skips, or todo cases |
| Manager review | Three implementation workers and documentation signed off |
| Ready and Actions | See the notes of [PR #115](https://github.com/3-headed-monkey/Thermus/pull/115) |
| Owner review and merge | Pending |

The focused run selected the 25 emitted files listed in
`/tmp/thermus-rhd01/focused-files.txt`; the changed container test ran separately.
After a successful build, the full interface command was:

```sh
LIGHTPANDA_BIN=<pinned-path> pnpm exec node --env-file=.env.local --test 'dist/test/interface/**/*.test.js'
```

The renderer and container commands were `npm run test:mcp:renderer` and
`npm run test:container`. All four reports exited 0 with zero failures,
cancellations, skips, and todo cases. These results include the existing
self-hosted image contract. They do not prove an AMD64 hosted image or Render
deployment; the hosted image proof belongs to RHD-03.

The WorkOS staging live gate passed through the documented launcher:

```sh
pnpm exec node ~/.config/thermus/with-workos-staging.cjs npm run test:hosted-live
```

The Optional MFA profile exited 0: 77 tests in 16 suites, 77 passed, and zero
failures, cancellations, skips, or todo cases. Duration: 580831.741459 ms.
The log is `/tmp/thermus-rhd01/hosted-live.log`. No secret value is recorded.
This is the Optional profile result; it does not claim a new Required-profile
run. Owner review and merge remain pending. No deployment is recorded.

## Retained habit-hooks findings

The manager signed off retaining all 158 findings in the reviewed report:
one oversized function, one unused binding, 147 comment locations, and nine
oversized files. Locations below refer to that report.

| Finding and location | Retention reason |
| --- | --- |
| Oversized function: `src/website-fetcher/website-fetcher-lightpanda.ts:103` | The unchanged 62-line render method owns one child, timer, abort listener, and completion callback. Keeping that lifecycle together preserves cleanup order. The DNS change needs no split of it. |
| Unused binding: `src/index.ts:29` | The `using deadline` binding is required for lexical disposal after `serve()` returns. Disposal removes the signal listeners and unreferences the timer. It is not dead code. |

Each row covers every listed comment line of that file.

| Comment file and line numbers | Retention reason |
| --- | --- |
| `src/application.ts`: 13, 14, 27, 28, 40, 41, 52, 54, 69, 80, 113, 134, 144, 198 | Keep server-only configuration and edition loading boundaries, browser-before-account routing, permission and billing ownership, rules-before-data startup, public-provider path restrictions, safe change logs, and early observation of drain failures. |
| `src/hosted-workos-application.ts`: 21, 22, 29, 30, 34, 36, 40, 51, 52, 92, 93 | Keep production-versus-fake connection provenance, the shared fetch composition, explicit slice enrollment, the one-way MFA override, request timeout/no-retry choices, no local or anonymous fallback, lazy JWKS loading, and shared current-grant directory ownership. |
| `src/index.ts`: 39, 68, 70, 79, 99, 100 | Keep lazy local-command loading, cancellation-before-drain ordering, stop-handler registration before the listening log, listener disposal after failed starts, and the referenced-then-unreferenced watchdog lifetime. |
| `test/unit/test-support-paths.test.ts`: 12, 13, 37 | Keep the reason the compiler cannot check runtime paths and the portal-build ordering exception: check the build parent before the portal build exists. |
| `src/hosted-admin/account-routes.ts`: 9, 10, 65, 66, 84, 85, 97, 98, 109, 110, 131, 132, 133, 141, 155 | Keep operation-level permission ownership, cookie effects on failure, administration route precedence, identity-only onboarding guidance, Origin-before-body ordering, current membership authority, cookie replacement order, base-directory paths, and context snapshot isolation. |
| `src/http/request-cancellation.ts`: 1, 2 | Keep the provider cancellation limitation, observation of late results, no later stage after abort, and separate ownership of real tool cleanup. |
| `src/mcp/fetch-tool-server.ts`: 83 | Keep the best-effort log boundary: a completion log failure must not change the tool result. |
| `src/mcp/mcp-server.ts`: 21, 40, 41, 80, 112 | Keep full-handler cleanup ownership, required-permission semantics, the duplex-close reentry guard, and the SDK body reader limitation that requires explicit abort handling. |
| `src/mcp/single-fetch-operation.ts`: 3 | Keep the capacity invariant: abort alone cannot release the shared slot before operation cleanup settles. |
| `src/website-fetcher/network-policy.ts`: 28, 29 | Keep the native DNS cancellation limit and residual-lookup ownership that prevents more hostname work until every abandoned lookup settles. |
| `src/website-fetcher/website-fetcher-lightpanda.ts`: 21, 22, 67, 68, 69, 82, 166 | Keep the pinned renderer telemetry behavior, per-child environment override, Node spawn-versus-system-limit error distinction, private URL-bearing cause boundary, PATH fallback, and immediate ENOEXEC classification. |
| `test/acceptance/auth/hosted-startup.test.ts`: 6, 7, 8, 98 | Keep the offline forged-credential proof boundary versus real WorkOS live proof, and the rule that a forged cookie can clear a cookie but cannot establish a session. |
| `test/acceptance/auth/self-hosted-container.test.ts`: 32, 35, 36, 62, 84, 144, 204, 230, 639 | Keep dedicated-gate selection, excluded hosted capabilities, fixed local-page seam, trusted-rule fixture meaning, consent shortcut, isolated Compose environment, address-literal DNS isolation, and CA-loading evidence without an outbound network. |
| `test/acceptance/auth/self-hosted-startup.test.ts`: 71 | Keep simultaneous server starts: they make the listening-log/stop-handler race observable under load. |
| `test/acceptance/mcp/http-shutdown.test.ts`: 156 | Keep the token provenance that lets the verifier hold only the tool request during the shutdown test. |
| `test/acceptance/mcp/server-only-modules.test.ts`: 17, 20, 44 | Keep console FATAL formatting, the server-only import boundary, and the operator-command isolation requirement. |
| `test/support/fixtures/hosted-placeholder.ts`: 3, 4, 13, 21 | Keep valid-but-unreachable WorkOS fixture provenance, redirect/base-path consistency, and trusted rules without a running renderer. |
| `test/support/hosted-live/local-https-site.ts`: 30, 47, 49, 51, 54, 55, 59, 60, 61, 62, 63, 67, 76, 82, 91, 100, 108 | Keep generated certificate outputs, portal/logger/TLS/application defaults, the default production composition with trusted test rules, the local gate versus slice boundary, front-before-back cleanup, direct backend address, prerequisites-before-resources ordering, listener ownership on cleanup failure, early rejection observation, and sequential front acquisition. |
| `test/support/in-process/hosted-fetch-site.ts`: 10 | Keep the proof boundary: production composition is unchanged and only WorkOS/AuthKit network traffic reaches the fake. |
| `test/support/processes/hold-hosted-cleanup.ts`: 3 | Keep the watchdog fixture purpose: stalled cleanup after listener drain must retain the explicit deadline. |
| `test/support/processes/hold-hosted-identity.ts`: 5 | Keep the fixture constraint that no timer or network handle keeps the identity promise alive; the real CLI must cancel the HTTP wait. |
| `test/support/processes/keep-hosted-handle-open.ts`: 1 | Keep the residual foreign-library handle scenario that must trigger the hosted deadline after request cleanup. |
| `test/support/processes/module-paths.ts`: 3, 4, 5, 6, 14, 17, 18, 21, 24 | Keep the D8 runtime-path owner, source/dist depth difference, path-existence proof, repository root, portal-build exception, compiled entry path, and preload-URL versus main-probe distinction. |
| `test/support/processes/server-process.ts`: 26, 79 | Keep the outbound-network prohibition and same-callback stop signal that make process tests isolated and deterministic. |
| `test/integration/auth/hosted-administration.test.ts`: 32 | Keep the deliberately different selected organization that proves each operation uses its own organization authority. |
| `test/integration/auth/hosted-live-site.test.ts`: 18, 45, 46, 62, 63, 82, 89, 100, 101, 134, 164, 196 | Keep unreachable settings/no startup network, empty-PATH OpenSSL isolation, leaked-server cleanup, one-turn handle retirement, certificate inspection versus certificate trust, MCP close count, and serialized ownership of the documented fixed port. |
| `src/auth/hosted-auth/workos/workos-session-routes.ts`: 32, 33, 36, 37, 38, 79, 89, 99, 100, 114, 122, 123, 145 | Keep RFC 3986 path restrictions, browser-before-account routing and recoverable cookies, AuthKit-initiated login, sealed return-path authority, Origin-before-body ordering, logout token exception, display-data/access separation, redirect-loop and dot-segment refusal, and directory base paths. |

| Oversized file | Retention reason |
| --- | --- |
| `src/application.ts` | One composition owner connects edition-specific startup, routing, cancellation, and cleanup. Splitting at the line threshold would hide acquisition and release order. |
| `src/mcp/mcp-server.ts` | One MCP lifetime owner coordinates authentication, request servers, body transfer, transport reentry, cancellation, and close. These paths share the same shutdown invariants. |
| `test/acceptance/auth/hosted-startup.test.ts` | One process-level hosted startup contract covers settings, trusted rules, metadata, forged credentials, and isolation from local state and network. |
| `test/acceptance/auth/self-hosted-container.test.ts` | One dedicated image gate verifies the installed artifact, persisted accounts, offline network boundary, renderer seam, rules prerequisite, and replacement-image contract. |
| `test/acceptance/auth/self-hosted-startup.test.ts` | One edition-startup suite verifies installation identity, locking, recovery, command refusal, provider separation, and stop-signal registration through the real entry point. |
| `test/integration/auth/hosted-account.test.ts` | One hosted account boundary suite verifies session/organization isolation, permission unions, denials, and routing/close through public composition interfaces. |
| `test/unit/mcp/lifetime.test.ts` | One lifecycle suite verifies shared close, request cancellation, late identity results, body cancellation, transport cleanup, and error ownership with controlled collaborators. |
| `test/unit/website-fetcher/website-fetcher-cancellation.test.ts` | One fetch-cancellation suite verifies no work before abort, DNS and child cancellation, one kill, timer/listener cleanup, late callbacks, and independent concurrent calls. |
| `test/unit/website-fetcher/website-fetcher-dns-wait.test.ts` | One DNS-wait ownership suite verifies the fixed deadline, abort races, late outcomes, residual lookup refusal, recovery, and independence of literals and other fetchers. |
