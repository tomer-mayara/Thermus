# RHD-02: hosted portal and local health

Status: implementation and verification complete; PR #116 awaits owner review.
Date: 2026-10-15. [PR #116](https://github.com/3-headed-monkey/Thermus/pull/116).
Branch: `codex/rhd-02-hosted-portal`, stacked on
[PR #115](https://github.com/3-headed-monkey/Thermus/pull/115), branch
`codex/rhd-01-hosted-fetch`. Both await owner review. PR #115 is open,
Ready, and unmerged at head `e7e43a224ce5d6c282c0b34f5304fba9c555c096`;
this stack still uses that base.
The [RHD-01 record](rhd-01.md) retains its earlier scope and results.

The [Render plan](render-hosted-docker-plan.md) defines this slice. It serves
the built portal with its browser policy, checks local startup prerequisites,
serves constant local health, and checks hosted MCP Origin before authentication.
The existing listener, self-hosted, and protected-route contracts remain in force.
This slice introduces no hosted image, Render service, production identity
setup, or deployment. The existing self-hosted image remains covered by its
container gate. No merge is recorded.

## Application contract

The hosted public base path is `/`. `GET` and `HEAD /` serve the built portal.
The same methods serve allowlisted build assets under `/assets/`. There is no
SPA catch-all. The browser policy permits logout redirects to
`https://api.workos.com` and the exact configured AuthKit origin. Auth, account,
MCP, and protected-resource metadata keep their existing handlers.

Startup checks trusted rules, the native cleaner, the built portal, and the
pinned renderer before listening. The renderer check needs an absolute
`LIGHTPANDA_BIN` path. It runs `version` directly with telemetry off, requires
trimmed stdout `1.0.0`, and has a 5,000 ms timeout, a 1,024-byte bound for each
output stream, and `SIGKILL` on a bound failure. Safe setup errors point to the
[runtime guide](../lightpanda-runtime.md#select-the-executable) and show no
executable path or child output.

After startup, `GET /healthz` returns constant `200` text `ok\n`.
`HEAD /healthz` returns the same status and headers without a body. Other
methods receive `405`. Health makes no provider call and renders no page.
It proves local initialization only.

The hosted MCP resource permits an absent `Origin` for native clients. A
present header must equal the serialized public origin exactly. Foreign,
malformed, opaque `null`, and noncanonical values receive `403` before token
verification, access resolution, or MCP dispatch. This applies to every method
at the exact MCP path. Metadata, browser, account, and self-hosted routes keep
their existing rules. No broad CORS policy is added.

Self-hosted startup keeps the optional renderer setting and PATH fallback.
Local account and client commands load no portal, renderer, rules, or native
cleaner.

## Verification

Write failing acceptance specifications first, then run focused tests and every
applicable existing gate from the [test gate policy](test-gate-policy.md).
The full integration and acceptance selections already include offline hosted
checks; no duplicate suite or new gate is added.

Workers reported these initial BDD failures before the corresponding production
changes. These are failure evidence, not completed gates.

| Specification | Initial red result |
| --- | --- |
| Production hosted portal and health | Root returned `401`, expected `200` |
| Hosted startup without a renderer | 0 passed, 1 failed: the server listened |
| Hosted MCP Origin | 2 passed, 1 failed: foreign Origin returned `401`, expected `403` |

The default hosted-live TLS front now forwards all requests to the production
application, including portal assets. Its browser proofs exercise the production
CSP. It needs the real pinned renderer for startup. A custom development
application retains the front-served portal. The manager reported the results
below. The complete check, acceptance, container, and hosted-live gates passed
after the test corrections. Verification used implementation commit
`575bd6f7f693f47dee8da82f5bb91f927a733e8e`. The final evidence update changes
documents only; code remains unchanged.

| Required evidence | Status |
| --- | --- |
| Initial failing BDD specifications | Worker-reported failures recorded above; manager reviewed |
| Frozen dependency install | Manager reported `pnpm install --frozen-lockfile` exit 0; no lockfile changes |
| Each changed or new test | All 20 files passed: the focused selection passed 151/151 in 10 suites across 19 emitted files, and the dedicated container suite passed 13/13. Both had zero failures, cancellations, skips, or todo cases |
| `npm run check` | Final `pnpm exec npm run check` exited 0: backend units 2,531/2,531 in 183 suites; portal units 8/8; build 10/10; portal acceptance 4/4; zero failures, cancellations, skips, or todo cases |
| `habit-hooks`, empty snooze file, and reasons for retained findings | Complete-candidate rerun exited 1; all 169 findings retained with manager reasons below; snooze `[]` |
| `npm run test:integration` | Manager-confirmed exit 0: 424/424 in 44 suites; zero failures, cancellations, skips, or todo cases |
| `npm run test:acceptance` | Final rerun exited 0: backend 333/333 in 42 suites and portal 4/4; zero failures, cancellations, skips, or todo cases |
| Full interface suite | Manager-confirmed exit 0: 131/131 in 18 suites; zero failures, cancellations, skips, or todo cases |
| `npm run test:mcp:renderer` | Manager-confirmed exit 0: 9/9 in one suite; zero failures, cancellations, skips, or todo cases |
| `npm run test:container` | Corrected dedicated run exited 0: 13/13 in one suite; zero failures, cancellations, skips, or todo cases |
| `npm run test:hosted-live`, Optional MFA profile | Exit 0: 77/77 in 16 suites; zero failures, cancellations, skips, or todo cases; 584,168 ms |
| Manager review and sign-off | All three implementation workers and affected documentation reviewed and signed off by the manager |
| Ready and Actions for PR #116 | See the current status of [PR #116](https://github.com/3-headed-monkey/Thermus/pull/116) |
| Owner review and merge | Pending |

The final complete check is in `/tmp/thermus-rhd02/check-complete.log`.
Integration is in
`/tmp/thermus-rhd02/integration.log`; acceptance is in
`/tmp/thermus-rhd02/acceptance-complete.log`; interface is in
`/tmp/thermus-rhd02/interface.log`; renderer is in
`/tmp/thermus-rhd02/renderer.log`; container is in
`/tmp/thermus-rhd02/container-complete.log`; hosted-live is in
`/tmp/thermus-rhd02/hosted-live.log`. The latest habit-hooks report is in
`/tmp/thermus-rhd02/habit-hooks-complete.log`. The earlier focused run used all 19 then-changed emitted
files in `/tmp/thermus-rhd02/focused-files.txt` after the final check's fresh
build. The manager independently matched this list to every changed and new
test file at that point; none was missing. Its log is
`/tmp/thermus-rhd02/focused.log`. The dedicated container gate later passed the
20th changed file.

The manager checked 392 relative Markdown file links and anchors; all exist.
The WorkOS staging run used the real pinned `LIGHTPANDA_BIN` and the staging
launcher. It passed production portal serving and CSP sign-out, plus the real
300-second token expiry, refusal, and refresh cases. This is an Optional MFA
profile result only; it does not claim a new Required-profile run.

The container gate ran the existing self-hosted image on local Linux ARM64.
It does not prove an AMD64 hosted image or Render deployment. Those proofs
remain in RHD-03 and the later rollout slices. Owner review and merge remain
pending.

After the prior build, the full interface command was:

```sh
LIGHTPANDA_BIN=<pinned-path> pnpm exec node --env-file=.env.local --test 'dist/test/interface/**/*.test.js'
```

The first acceptance run exited 1 with 332 passed and one cancelled case after
the existing 5,000 ms total allowance for `/session` shutdown. The failed phase
was not established, and no production defect was reproduced. The manager
approved a test correction: the three held-identity process cases have a
15-second total allowance and phase/output timeout diagnostics. Each still
requires shutdown under 1,000 ms, exit code 0, and no deadline message. Setup
measured 345–1,634 ms; shutdown measured 7–59 ms. The successful completed results above include this correction.

Container review then found one obsolete expectation: switching the self-hosted
image to hosted mode was expected to serve protected routes. That image has no
portal build. The first dedicated gate exited 1 with 12/13 passed; its only failure was this
obsolete expectation. The image stopped with the safe missing-portal FATAL
message before listening. The manager reviewed and signed off the corrected
case, which keeps the local route-isolation checks and
requires hosted startup to stop before listening, with a safe portal error,
exit code 1, an empty fresh volume, and no outbound call. No image or product
code changed. The complete check, acceptance, and corrected dedicated
container gate passed. The initial container log is
`/tmp/thermus-rhd02/container.log`.

## Retained habit-hooks findings

The complete-candidate report exited 1 with 169 findings: three complexity findings, one
oversized function, one unused binding, 153 comment locations, and 11 oversized
files. The exact diff from the earlier 168-finding report adds only the approved
shutdown-test allowance comment. The later rerun after the container correction
keeps all counts; its only location change is the existing container comment
from line 639 to line 621.
The manager reviewed the current source owners and all new or changed comment
locations and authorized retention. `.habit-hooks/snooze.json` is `[]`.
Retention does not turn the tool result into exit 0.

| Current finding | Manager retention reason |
| --- | --- |
| Complexity: `src/hosted-portal.ts:62` | The compact dispatcher owns three fixed route groups and their GET/HEAD semantics. Splitting these decisions would hide the small routing contract. |
| Complexity: `src/hosted-portal.ts:81` | `validateIndex` owns one invariant: a required module and all script and stylesheet references must name loaded assets. |
| Complexity: `test/support/hosted-live/local-https-site.ts:80` | The method owns one acquisition and cleanup sequence, including the different ownership of production and custom applications. |
| Oversized function: `src/website-fetcher/website-fetcher-lightpanda.ts:103` | The unchanged render method owns one child, timer, abort listener, and completion callback. Keeping that lifecycle together preserves cleanup order, as in the RHD-01 review. |
| Unused binding: `src/index.ts:29` | `using deadline` is required for lexical disposal after `serve()` returns. It removes signal listeners and unreferences the timer, as in the RHD-01 review. |

Each row below covers every reported comment in that new or changed file.
The [RHD-01 retention record](rhd-01.md#retained-habit-hooks-findings) supplies
the inherited reasons for all other comment locations and oversized files.
Current line numbers below come from the RHD-02 report.

| Comment file and line numbers | Manager retention reason |
| --- | --- |
| `src/application.ts`: 13, 14, 27, 28, 40, 41, 52, 54, 69, 80, 113, 134, 144, 204 | Keep server-only loading, edition boundaries, routing and permission ownership, startup order, safe logs, and observation of cleanup failure; inherited RHD-01 reasons still apply. |
| `src/hosted-portal.ts`: 25 | State that startup preloads the complete build before it owns an application or listener. |
| `src/hosted-renderer-startup.ts`: 6 | Explain why the bounded child check uses SIGKILL for a child that ignores SIGTERM. |
| `src/hosted-workos-application.ts`: 21, 22, 29, 30, 34, 36, 40, 57, 58, 98, 99 | Keep connection provenance, production fetch composition, explicit enrollment, MFA authority, bounded provider calls, no fallback, lazy key loading, and shared grant-directory ownership; inherited RHD-01 reasons still apply. |
| `test/unit/test-support-paths.test.ts`: 12, 13, 40 | Keep runtime-path and portal-build ordering explanations; inherited RHD-01 reasons still apply. |
| `test/acceptance/auth/hosted-startup.test.ts`: 11, 12, 13, 102 | Keep the offline forged-credential proof boundary and the distinction between clearing a forged cookie and establishing a session. |
| `test/acceptance/auth/self-hosted-container.test.ts`: 32, 35, 36, 62, 84, 144, 204, 230, 621 | Keep dedicated-gate selection, excluded hosted capabilities, trusted local page and rules fixtures, consent shortcut, Compose isolation, address-literal DNS isolation, and CA-loading evidence without an outbound network. |
| `test/acceptance/auth/self-hosted-startup.test.ts`: 71 | Keep concurrent server starts to expose signal-handler registration races under load. |
| `test/acceptance/mcp/server-only-modules.test.ts`: 17, 20, 44 | Keep FATAL formatting, server-only imports, and operator-command isolation. |
| `test/acceptance/mcp/hosted-process-shutdown.test.ts`: 29 | Explain why the total process setup allowance differs from the strict shutdown assertion. |
| `test/support/fixtures/hosted-placeholder.ts`: 4, 5, 14, 22 | Keep valid but unreachable WorkOS provenance, redirect/base consistency, and the explicit portal and version-command fixtures. |
| `test/support/hosted-live/local-https-site.ts`: 30, 47, 49, 51, 53, 56, 57, 61, 62, 66, 75, 92, 101, 109 | Keep certificate outputs, production versus custom front ownership, checked renderer selection, logger and application defaults, prerequisites before resources, front/backend cleanup order, listener-drain ownership, early rejection observation, and sequential front acquisition. |
| `test/support/in-process/hosted-fetch-site.ts`: 11 | Keep the proof boundary: production composition stays real; only WorkOS/AuthKit traffic reaches the fake. |
| `test/support/processes/module-paths.ts`: 3, 4, 5, 6, 14, 17, 18, 21, 26, 29 | Keep D8 runtime-path ownership, source/dist depth, portal-build ordering, explicit fixture paths, and preload/probe distinctions. |
| `test/support/processes/server-preloads.ts`: 3, 4, 9, 10 | Explain controlled child-process preload settings and the private native-parser failure marker. |
| `test/support/processes/use-hosted-portal-fixture.ts`: 4 | Explain the explicit test-only alias to the static portal build fixture. |
| `test/integration/auth/hosted-administration.test.ts`: 34 | Keep the deliberately different selected organization that proves each operation uses its own organization authority. |
| `test/integration/auth/hosted-live-site.test.ts`: 20, 47, 48, 64, 65, 84, 91, 102, 103, 139, 174, 206 | Keep unreachable settings, checked renderer fixture, OpenSSL isolation, failed-start cleanup, TLS inspection versus trust, close counts, and fixed-port sequencing; inherited RHD-01 reasons still apply. |

For oversized files, the two new findings have these reasons:

| File | Manager retention reason |
| --- | --- |
| `test/unit/application.test.ts` | One application routing specification uses shared fixtures for existing routes and the new Origin contract. |
| `test/integration/auth/hosted-live-site.test.ts` | The fixed-port sequence and failure cleanup stay together to retain isolation and resource ownership. |

The other nine oversized-file findings are the same owners reviewed in RHD-01:
`src/application.ts`, `src/mcp/mcp-server.ts`,
`test/acceptance/auth/hosted-startup.test.ts`,
`test/acceptance/auth/self-hosted-container.test.ts`,
`test/acceptance/auth/self-hosted-startup.test.ts`,
`test/integration/auth/hosted-account.test.ts`, `test/unit/mcp/lifetime.test.ts`,
`test/unit/website-fetcher/website-fetcher-cancellation.test.ts`, and
`test/unit/website-fetcher/website-fetcher-dns-wait.test.ts`. Their inherited
retention reasons still apply to the current report.
