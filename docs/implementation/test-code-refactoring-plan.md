# Test code review and refactoring plan for `test/**`

This review is modeled on Dave Farley's published approach: *Continuous
Delivery* (Humble and Farley), *Modern Software Engineering*, and his talks on
acceptance testing, with Gerard Meszaros's test-double terms as Farley uses
them. Dave Farley did not review or endorse this document.

Base: commit `1ed55aa` (the merge of PR #80). PR #83 and PR #85 merged after it
and PR #86 is open; §3.5 gives their effect. Inputs: the report on the 66 files
of `test/support` and `test/helpers`, an inventory of the 108 auxiliary files
under `test/`, `AGENTS.md`, and `docs/coding-principles.md`. Each fact below was
checked with `grep` or by reading the file.

Path abbreviations: `S/` = `test/support/`, `U/` = `test/unit/`,
`I/` = `test/integration/`, `A/` = `test/acceptance/`. "=" means "stays".

## 1. Review summary

What works:

- Isolation is strong. Each test gets its own data directory and gets its
  environment variables back. Child processes load `deny-network`. Four modules
  block outbound `fetch`. The live gate names each staging fixture with a run ID
  and deletes it at the end.
- The product runs in four production-like deployments: composed in the test
  process, as a child process of `dist/src/index.js`, as the Docker image, and
  against WorkOS staging. This ladder is rare and valuable.
- Doubles stand at the system boundary. The in-process sites use the real
  composition and replace only the provider parts.

What needs work:

- The four layers are not visible. `S/` holds 45 loose files. DSL steps,
  protocol drivers, system compositions, and doubles sit side by side. Some
  files mix layers: `hosted-organization-site.ts`, `hosted-administration.ts`,
  `local-browser.ts`.
- No channel has one home, so drivers repeat. Thirteen places build an MCP SDK
  client with version negotiation and connect it. Four drivers act as an HTTP
  browser.
- 26 files import across test types: 15 integration files and 7 acceptance
  files import `U/*/fixtures`, 3 support files import `U/*/fixtures`, and 1
  unit file imports `A/work-slice`. A shared double inside one package's unit
  fixtures is hidden from the suites that need it.
- Names claim the wrong kind. The three `*Mock` classes are spies. Two `*Probe`
  classes are spies, while two other probes are child scripts. Two different
  things are called "world".
- Run-time paths are spread over seven support files and eleven test files
  (§3.4). A move can break the container gate or the live gate, and no offline
  test sees it.
- One fake, `S/workos-world.ts`, has 630 lines and five responsibilities.

## Owner decisions

The plan needs four answers. Each one changes a step, not the plan. The owner
gave the first one on 2026-10-14; three remain.

1. Decided: yes. A pure move of a file in the container gate's import graph
   (only import specifiers change; no container script and no run-time path
   changes) skips `npm run test:container` and relies on module load plus the
   path test of Step 1. `docs/implementation/test-gate-policy.md` records it.
   Six steps keep the Docker mark, because they change more than import
   specifiers: 5a, 5b, 5c, 6a, 6g, and 7c. Steps 5d to 5f are pure moves and
   need no Docker run.
2. Step 7c edits test-case text. It is optional.
3. The docs call `NoAuthProvider` "the mock provider". It is a stub. Keep the
   phrase in the docs, or change it when a doc changes for another reason.
4. The step count. The plan gives 27 small pull requests so that each one is
   easy to review and to replay on a ticket branch. The owner can merge
   sub-steps of one step into one pull request.

## 2. Terminology (Deliverable 1)

### 2.1 Terms

| Term | Definition | Farley or Meszaros term | File and class names | Where it lives |
|---|---|---|---|---|
| Test case | One `test()` that states one required behavior in Given-When-Then words. | Executable specification (layer 1) | `*.test.ts`; gates `*.live.ts`, `*.runtime.ts`. A test-case module is `<topic>.ts` with `describe<Topic>…()` | `test/<type>/<area>/`; test-case modules in a folder next to their entry file |
| DSL | Functions and actor objects in domain words. Test cases call them. They hide how a step is done. | DSL layer (layer 2) | Actors are nouns (`LocalMcpUser`, `LiveRun`). Steps are verb phrases (`signInThroughServer`). File `<domain>-<topic>.ts` | `S/dsl/`; the live gate keeps its DSL in `S/hosted-live/` |
| Protocol driver | The only code that knows how to talk to the system through one channel: browser HTTP, MCP SDK, raw MCP over HTTP, CLI stdio, Docker CLI, Playwright, WorkOS REST. | Protocol driver (layer 3) | `<Channel>Browser`, `<Channel>Client`, `*-driver.ts`, `connect…()` | `S/drivers/<channel>/`; CLI driver in `S/processes/`, Docker driver in `S/container/`, Playwright drivers in `S/hosted-live/` |
| System composition | Code that builds real product parts for a test, in a production-like way. | System under test (layer 4) | `<what>.ts`, `open…()`, `compose…()` | The folder of its deployment (next row) |
| Site | A system composition that a test reaches at an address. | System under test in a production-like test environment (layer 4) | `<what>-site.ts`, `serve…Site()`; `<what>-process.ts`; `<what>-container.ts` | One folder per deployment: `S/in-process/`, `S/processes/`, `S/container/`, `S/hosted-live/` |
| Harness | A suite-private system composition that runs the system with doubles and captures its output. | Layer 4 for one suite | `<subject>-harness.ts` | That suite's `fixtures/` |
| Test double | An object that stands in for a collaborator of the system. | Test double (Meszaros) | `<Contract><Kind>`, Kind = `Stub`, `Spy`, or `Fake`; `Double` only on today's mixed kinds; file `<contract>-<kind>.ts` | `U/<package>/fixtures/` when only that package's unit tests use it; else `S/doubles/<src package or external system>/` |
| Fixture data | Values, builders, and data files that set the start state of a test. | Part of the test fixture (Meszaros) | camelCase constants, `<thing>Of()` builders, `<topic>.ts` or a data file | `fixtures/` next to its only users; shared data in `S/fixtures/` |
| Test settings | Fixture data that describes one environment: URLs, placeholder credentials, the role catalog. | Environment configuration | `<environment>-<topic>.ts` | `S/fixtures/`; the live gate keeps `S/hosted-live/settings.ts` |
| Preload | A module that Node loads with `--import` into another process before the program. It isolates the process, records what it does, or injects a fault. | A stub, spy, or saboteur at a seam | Verb phrase of its effect: `deny-network.ts` | `S/processes/`; the container preload in `S/container/` |
| Child script | A module that runs as the main program of another process or container. | — | `container-<role>.ts` | `S/processes/`, `S/container/` |
| Probe | A child script that observes facts inside another process and prints them. | — (an observation point) | `<target>-probe.ts`; no in-process class uses the word | With the other child scripts |
| Seam | A place where a test changes behavior without an edit in that place: a constructor parameter, `NODE_OPTIONS=--import`, `t.mock.method` on a `node:` module. | Seam (Feathers, as this repository uses it) | No files | — |
| Isolation helper | Code that gives one test its own resource and restores shared state after it. | Test isolation | Noun of the resource; the function takes `t` and registers cleanup | `S/isolation/` |
| Module paths | The one module that computes run-time paths from support code to other folders and to the repository root. | Information hiding | `module-paths.ts` | `S/processes/` |

### 2.2 Double kinds this repository needs

- **Stub**: gives canned answers. Examples: `NoAuthProvider`, `ChangeAnswers`,
  `WorkOSFakeApi` with scripted routes.
- **Spy**: gives canned or real answers and records the calls for later checks.
  This is the main kind here: all `*Mock` classes, the two in-process `*Probe`
  classes, `BillingRecorder`, most `*Double` classes.
- **Fake**: a working, simple implementation with state. Multi-step flows need
  it: `WorkOSWorld`, `BrowserSessionStore`, `LocalProviderDouble`,
  `OrganizationDirectoryDouble`, the page server of `network-fixture.ts`.
- **Saboteur** (Meszaros's stub that injects faults): `fail-ad-cleaner.ts`, the
  `failures` maps, the `*Outage` fields. Use the word in comments, not in names.
- **Dummy**: not needed as a file. An inline `() => {}`, for example
  `reportFailure: () => {}`, is enough.
- **Mock** (a double that checks expectations set before the act): not needed.
  The tests check state and spy records after the act. That couples them to
  outcomes, not to call order: the coupling concern of Farley's five tools and
  the rule of `docs/coding-principles.md`. The one mock-like trait,
  `RunbookClientDouble` failing on a forbidden call, is a guard inside a fake.
  No file or class may carry the name Mock. `node:test` calls its API `t.mock`,
  but `t.mock.method` makes stubs and spies.

### 2.3 Current words mapped

| Current word | Meaning here | Our term | Verdict |
|---|---|---|---|
| double | Any stand-in | Test double | Correct but vague. Keep on today's mixed kinds; new files name the kind. |
| mock | `AccessResolverMock`, `IdentityVerifierMock`, `FailureReporterMock`, `mockRenderer()`, "the mock provider" in docs | Spy; stub | Wrong. Rename the classes and the function. The docs phrase is owner decision 3. |
| fixture, `fixtures/` | Data, builders, private doubles; `network-fixture.ts` is a local web site | Fixture data; fake | Keep. |
| support | Shared test code | Root of layers 2 to 4, doubles, shared data | Keep; sort by role. |
| helpers | Two folders with no defined meaning | — | Remove the word. PR #86 removes `test/helpers`. |
| probe | In-process spies and child scripts | Probe (child scripts only) | Two meanings. Rename the spies. |
| seam | The "page seam" of `container-page.ts` | Seam | Keep. |
| driver | `authkit-driver.ts`, the runbook driver | Protocol driver | Keep. |
| world | A fake of WorkOS and a fixture module | Fake; fixture module | Wrong: in BDD a world is the per-scenario context. Rename both. |
| site | A reachable deployment | Site | Keep as the layer-4 noun. |
| harness | `local-auth-command-harness.ts` | Harness | Keep. |
| recorder | `BillingRecorder` | Spy | Accurate. Keep. |
| store | `BrowserSessionStore` | Fake | Accurate about its mechanism. Keep. |
| launcher | Code that starts a process | Site (process) or CLI driver | Do not use in names. |

### 2.4 Names that must change

1. `AccessResolverMock` → `AccessResolverSpy`; `IdentityVerifierMock` →
   `IdentityVerifierSpy`; `FailureReporterMock` → `FailureReporterSpy` (files
   `*-spy.ts`).
2. `RequestContextTools` → `ContextReportToolSpy`; `RequestContextProbe` →
   `ProtectedToolSpy`; `AccountOperationProbe` → `AccountOperationSpy`. The tool
   names `report_context` and `protected_fetch_probe` stay: tests and records
   see them.
3. `WorkOSWorld` → `WorkOSFake` (file `workos-fake.ts`); `WorldUser`,
   `WorldMembership`, `WorldInvitation` → `FakeUser`, `FakeMembership`,
   `FakeInvitation`.
4. `I/auth/fixtures/workos-session-world.ts` → `workos-session-fixtures.ts`;
   `World` → `SessionFixture`; `startWorld` → `startSessionFixture`.
5. `mockRenderer()` → `controlledRenderer()`.
6. The folder `…/css-visibility/helpers/` becomes `…/css-visibility/fixtures/`.
   PR #86 already moves the two files of `test/helpers/` into `test/support/`.

A rename changes identifiers only. It never changes a string that the system or
a test observes, such as the authority `hosted-provider-double`.

### 2.5 Classification of the 108 files

✎ = the name changes. "Package fixture" = data, builders, and helpers in one
package's `fixtures/`. Kind is for doubles only. Rows 13 and 14 give the paths
of the base commit; PR #86 moves both files into `S/` first (§3.5).

| # | File now | Term | Kind | Target |
|---|---|---|---|---|
| 1 | A/auth/hosted-live/administration-proofs.ts | Test-case module | | = |
| 2 | A/auth/hosted-live/administration-server.ts | Test-case module | | = |
| 3 | A/auth/hosted-live/browser-sign-in.ts | Test-case module | | = |
| 4 | A/auth/hosted-live/configuration.ts | Test-case module | | = |
| 5 | A/auth/hosted-live/connect-authorization.ts | Test-case module | | = |
| 6 | A/auth/hosted-live/connect-tokens.ts | Test-case module | | = |
| 7 | A/auth/hosted-live/hosted-server.ts | Test-case module | | = |
| 8 | A/auth/hosted-live/memberships.ts | Test-case module | | = |
| 9 | A/auth/hosted-live/operator-setup.ts | Test-case module | | = |
| 10 | A/auth/hosted-live/organization-server.ts | Test-case module | | = |
| 11 | A/auth/hosted-live/session-ending.ts | Test-case module | | = |
| 12 | A/work-slice/basic-mcp-url-fetch.ts | Work-slice entry point and its site | | = (rule D2 exception until 2026-10-15, when the auth WorkOS MCP URL fetch slice moved the fetch lines to `S/work-slice/`) |
| 13 | test/helpers/process-html.ts | System composition (three-stage pipeline) | | S/in-process/process-html.ts |
| 14 | test/helpers/sanitize-html.ts | Package fixture | | U/html-cleaner-pipeline/fixtures/sanitize-html.ts |
| 15 | I/auth/fixtures/local-auth-command-harness.ts | Harness | Stub, Spy | = |
| 16 | I/auth/fixtures/workos-session-world.ts | Suite fixture module | Stub | I/auth/fixtures/workos-session-fixtures.ts ✎ |
| 17 | S/account-operation-probe.ts | Double | Spy | S/doubles/hosted-admin/account-operation-spy.ts ✎ |
| 18 | S/ad-rules.ts | Fixture data reader | | S/fixtures/ad-rules.ts; `readAdFixture` → U/html-cleaner-pipeline/fixtures/ad-pages.ts |
| 19 | S/auth/no-auth-provider.ts | Double | Stub | S/doubles/auth/no-auth-provider.ts |
| 20 | S/axiom-test-export.ts | System composition (log export to the test dataset) | | S/in-process/axiom-test-export.ts |
| 21 | S/better-auth-agents.ts | Protocol drivers (browser on the provider handler; OAuth clients) | | S/drivers/browser/better-auth-agents.ts |
| 22 | S/better-auth-local.ts | System composition (provider in process); settings | | S/in-process/better-auth-local.ts |
| 23 | S/billing-recorder.ts | Double | Spy | S/doubles/billing/billing-recorder.ts |
| 24 | S/browser-session-store.ts | Double | Fake | S/doubles/auth/browser-session-store.ts |
| 25 | S/command-process.ts | Protocol driver (CLI) | | S/processes/command-process.ts |
| 26 | S/container-edge.ts | Child script | | S/container/container-edge.ts |
| 27 | S/container-gate.ts | Container environment | | S/container/container-gate.ts |
| 28 | S/container-page.ts | Preload (page seam) | Stub, Fake | S/container/container-page.ts |
| 29 | S/container-probe.ts | Probe | | S/container/container-probe.ts |
| 30 | S/container-site.ts | Site (Docker) | | S/container/container-site.ts |
| 31 | S/data-directory.ts | Isolation helper | | S/isolation/data-directory.ts |
| 32 | S/deny-network.ts | Preload; isolation | Saboteur, Spy | S/processes/deny-network.ts |
| 33 | S/docker-cli.ts | Protocol driver (Docker CLI) | | S/container/docker-cli.ts |
| 34 | S/fail-ad-cleaner.ts | Preload | Saboteur | S/processes/fail-ad-cleaner.ts |
| 35 | S/foreign-origin-probe.ts | Probe | | S/processes/foreign-origin-probe.ts |
| 36 | S/hosted-administration.ts | DSL; fixture data | | S/dsl/hosted-administration.ts |
| 37 | S/hosted-browser.ts | Protocol driver (browser); page reader | | S/drivers/browser/hosted-browser.ts |
| 38 | S/hosted-live/administration-fixtures.ts | Fixture data (staging) | | = |
| 39 | S/hosted-live/authkit-driver.ts | Protocol driver (Playwright on AuthKit) | | = |
| 40 | S/hosted-live/browser-session.ts | DSL | | = |
| 41 | S/hosted-live/connect-client.ts | Protocol driver (OAuth over HTTP) | | = |
| 42 | S/hosted-live/connect-grant.ts | DSL | | = |
| 43 | S/hosted-live/fixture-registry.ts | Fixture lifecycle | | = |
| 44 | S/hosted-live/live-browser.ts | Protocol driver (Playwright browser) | | = |
| 45 | S/hosted-live/live-run.ts | DSL (run context) | | = |
| 46 | S/hosted-live/local-https-site.ts | Site (local HTTPS front) | | = |
| 47 | S/hosted-live/navigations.ts | Protocol driver part (Playwright) | | = |
| 48 | S/hosted-live/operator-runbook.ts | Protocol driver (operator steps) | | = |
| 49 | S/hosted-live/organization-fixtures.ts | Fixture data (staging) | | = |
| 50 | S/hosted-live/portal-visit.ts | DSL; Playwright request driver | | = |
| 51 | S/hosted-live/settings.ts | Test settings | | = (catalog from Step 6d) |
| 52 | S/hosted-live/staging-fixtures.ts | Fixture data and factory | | = |
| 53 | S/hosted-live/tokens.ts | Utility (token reader) | | = |
| 54 | S/hosted-live/totp.ts | Utility (the user's authenticator) | | = |
| 55 | S/hosted-live/workos-api.ts | Protocol driver (WorkOS REST) | | = |
| 56 | S/hosted-organization-site.ts | Site (in process); data; DSL | | S/in-process/hosted-organization-site.ts (split in 7b) |
| 57 | S/hosted-placeholder.ts | Test settings | | S/fixtures/hosted-placeholder.ts |
| 58 | S/html-cleaner-context.ts | Package fixture | | U/html-cleaner-pipeline/fixtures/html-cleaner-context.ts |
| 59 | S/in-process-server.ts | Site (serve sequence in process) | | S/in-process/in-process-server.ts |
| 60 | S/jwt-signing-key.ts | Part of the WorkOS fake | Fake | S/doubles/workos/jwt-signing-key.ts |
| 61 | S/local-browser.ts | Protocol driver (browser on a socket); DSL steps | | S/drivers/browser/local-browser.ts |
| 62 | S/local-commands.ts | DSL (operator) | | S/dsl/local-commands.ts |
| 63 | S/local-mcp-user.ts | DSL (actor) | | S/dsl/local-mcp-user.ts |
| 64 | S/local-runtime.ts | System composition (runtime on a data directory); settings | | S/in-process/local-runtime.ts |
| 65 | S/mcp-fetch-site.ts | Site (fetch tool in process) | | S/in-process/mcp-fetch-site.ts |
| 66 | S/mcp-protocol-eras.ts | Protocol driver data | | S/drivers/mcp/mcp-protocol-eras.ts |
| 67 | S/mcp-sdk-oauth-client.ts | Protocol driver (MCP OAuth client) | | S/drivers/mcp/mcp-sdk-oauth-client.ts |
| 68 | S/membership-directory-double.ts | Double | Fake, Spy | S/doubles/organizations/membership-directory-double.ts |
| 69 | S/network-fixture.ts | Double (local web, DNS) | Fake, Stub | S/doubles/website-fetcher/network-fixture.ts |
| 70 | S/otel-log-receiver.ts | Double (OTLP endpoint) | Fake | S/doubles/logging/otel-log-receiver.ts |
| 71 | S/process-environment.ts | Isolation helper | | S/isolation/process-environment.ts |
| 72 | S/renderer-process-double.ts | Double (Lightpanda, DNS) | Stub, Spy | S/doubles/website-fetcher/renderer-process-double.ts ✎ |
| 73 | S/request-context-probe.ts | Double | Spy | S/doubles/mcp/protected-tool-spy.ts ✎ |
| 74 | S/server-container.ts | Protocol driver (server container) | | S/container/server-container.ts |
| 75 | S/server-preloads.ts | Preload settings | | S/processes/server-preloads.ts |
| 76 | S/server-process.ts | Site (child process) | | S/processes/server-process.ts |
| 77 | S/trace-sqlite.ts | Preload | Spy | S/processes/trace-sqlite.ts |
| 78 | S/workos-fake-api.ts | Double (WorkOS HTTP API) | Stub, Spy | S/doubles/workos/workos-fake-api.ts |
| 79 | S/workos-sign-in.ts | DSL | | S/dsl/workos-sign-in.ts |
| 80 | S/workos-world.ts | Double (WorkOS environment) | Fake | S/doubles/workos/workos-fake.ts ✎ (split in 7a) |
| 81 | U/auth-better-auth/fixtures/administration-fixtures.ts | Package fixture | Stub | = |
| 82 | U/auth-better-auth/fixtures/local-access-tokens.ts | Suite fixture builder | | I/auth/fixtures/local-access-tokens.ts |
| 83 | U/auth-better-auth/fixtures/local-auth-pages-fixtures.ts | Package fixture | Spy | = |
| 84 | U/auth-better-auth/fixtures/local-provider-double.ts | Double | Fake, Spy | S/doubles/auth/local-provider-double.ts |
| 85 | U/auth-better-auth/fixtures/token-provider-double.ts | Double | Stub, Spy | I/auth/fixtures/token-provider-double.ts |
| 86 | U/auth-workos/fixtures/runbook-client-double.ts | Double | Fake, Spy | = |
| 87 | U/auth-workos/fixtures/session-routes-fixtures.ts | Package fixture | Spy | = |
| 88 | U/auth-workos/fixtures/workos-organizations-double.ts | Double | Fake, Spy | = |
| 89 | U/auth-workos/fixtures/workos-session-client-double.ts | Double; data | Spy | = |
| 90 | U/hosted-admin/fixtures/account-operation-double.ts | Double | Spy | = |
| 91 | U/hosted-admin/fixtures/account-routes-fixtures.ts | Package fixture | | = |
| 92 | U/hosted-admin/fixtures/administration-routes-fixtures.ts | Package fixture | | = |
| 93 | U/hosted-admin/fixtures/browser-session-double.ts | Double | Spy | S/doubles/auth/browser-session-double.ts |
| 94 | U/hosted-admin/fixtures/organization-administration-double.ts | Double | Spy | = |
| 95 | U/hosted-admin/fixtures/organization-routes-fixtures.ts | Package fixture | | = |
| 96 | U/html-cleaner-pipeline/prompt-injection-remover/css-visibility/helpers/css-pipeline.ts | Package fixture (loaded by path) | | …/css-visibility/fixtures/css-pipeline.ts ✎ (folder) |
| 97 | U/http/fixtures/http-server-fixtures.ts | Package fixture; raw TCP driver | | = |
| 98 | U/mcp/fixtures/access-resolver-mock.ts | Double | Spy | S/doubles/auth/access-resolver-spy.ts ✎ |
| 99 | U/mcp/fixtures/access-test-server.ts | System composition (MCP server with spies); data | | S/in-process/access-test-server.ts |
| 100 | U/mcp/fixtures/failure-reporter-mock.ts | Double | Spy | S/doubles/mcp/failure-reporter-spy.ts ✎ |
| 101 | U/mcp/fixtures/identity-verifier-mock.ts | Double | Spy | S/doubles/auth/identity-verifier-spy.ts ✎ |
| 102 | U/mcp/fixtures/mcp-http-request.ts | Protocol driver (raw MCP over HTTP) | | S/drivers/mcp/mcp-http-request.ts |
| 103 | U/mcp/fixtures/request-context-tools.ts | Double | Spy | S/doubles/mcp/context-report-tool-spy.ts ✎ |
| 104 | U/organizations/fixtures/administration-fixtures.ts | Package fixture | | = |
| 105 | U/organizations/fixtures/billing-double.ts | Double | Spy | = |
| 106 | U/organizations/fixtures/change-answers.ts | Double base | Stub | S/doubles/organizations/change-answers.ts |
| 107 | U/organizations/fixtures/directory-double-records.ts | Fixture data of the directory doubles | | S/doubles/organizations/directory-double-records.ts |
| 108 | U/organizations/fixtures/organization-directory-double.ts | Double | Fake, Spy | S/doubles/organizations/organization-directory-double.ts |

## 3. Refactoring plan (Deliverable 2)

### 3.1 Target layout and rules

```
test/
  unit/<package>/        test cases; fixtures/ = data and doubles of this package only
  integration/<area>/    test cases; fixtures/ = files of this area only
  interface/<area>/      test cases
  acceptance/<area>/     test cases; auth/hosted-live/ test-case modules; work-slice/
  support/
    dsl/                 layer 2
    drivers/browser/     layer 3: HTTP browsers, cookie jar, page forms
    drivers/mcp/         layer 3: MCP SDK client, raw MCP request, eras, OAuth client
    in-process/          layer 4: the system composed in the test process
    processes/           layer 4: the system as a child process; CLI driver; preloads; probes; module-paths.ts
    container/           layer 4: the system in Docker; Docker driver; container scripts
    hosted-live/         layers 2 to 4 of the live staging environment (unchanged)
    doubles/<name>/      <name> = src package of the contract (auth, mcp, organizations, hosted-admin,
                         billing, application, website-fetcher, logging) or external system (workos)
    fixtures/            shared fixture data, settings, data files
    isolation/           per-test isolation in the test process
```

Two axes stay apart. The top folders under `test/` give the test type.
AGENTS.md decides the type by the packages that a test executes, not by the
folder of its helpers. The folders under `S/` give the layer role. The four
layer-4 folders are the four deployments of §1, so a reader sees how
production-like a site is.

Placement rules:

- P1. A test case lives in `test/<type>/<area>/`.
- P2. A file that only the tests of one unit package, or of one area of one
  test type, use lives in that place's `fixtures/`.
- P3. A file that two such places use lives in `S/<role>/`.
- P4. Every DSL module, protocol driver, site, external-system double, preload,
  and child script lives in `S/`, also when it has one user today.

P4 is where Farley's model and the owner's first goal meet. Proximity is right
for private data and private doubles (P2). It is wrong for a driver or a DSL
step. A channel needs one driver, and all specifications need one vocabulary. A
driver next to one suite is invisible to the next suite that needs the channel.
This repository shows the cost: four HTTP browsers and thirteen MCP client
setups. The better rule: private things near their users, shared roles in one
home.

Dependency rules:

- D1. `S/**` imports only `src/**`, packages, and `S/**`.
- D2. A file in `test/<type>/` imports no other test type. The first version
  had one exception: the unit test of the work-slice fetch lines imported the
  entry point of the basic slice. That exception is gone. The auth WorkOS MCP
  URL fetch slice moved the fetch lines to test support. They are now the spy
  `S/doubles/mcp/fetch-operation-spy.ts`, and the unit test imports them from
  there.
- D3. A unit test imports `fixtures/` only from its own package.
- D4. `S/drivers/**` imports no `S/dsl/**`.
- D5. `S/doubles/**` and `S/fixtures/**` import no `S/dsl/**` and no
  `S/drivers/**`.
- D6. `S/container/container-{edge,page,probe}.ts` import only `node:` modules.
  Each file runs alone in a container.
- D7. No `*.test.ts` under `S/`. The suite globs select by test-type folder.
  The tests of support code live in `U/test-support/`, as PR #86 starts.
- D8. A run-time path from support code to another folder or to the repository
  root lives only in `S/processes/module-paths.ts`. A path to a sibling file
  may stay in its user. A test file may compute a path to a `src` module that it
  runs in a child process, or to a sibling file.

The cross-layer imports: support → unit fixtures goes; integration and
acceptance → unit fixtures goes (Steps 2 and 3 move the 13 borrowed files);
unit → support stays, because `S/` is the shared base of all test types; unit →
work slice stayed as the one documented exception until 2026-10-15, when the
auth WorkOS MCP URL fetch slice moved the fetch lines to `S/work-slice/` and
the exception went. ESLint enforces D1 to D6
(Steps 4 and 5i), and an architecture spec proves each rule, as
`auth-boundaries.test.ts` does for `src`.

### 3.2 Ordered steps

Each step is one draft pull request that follows AGENTS.md. Moves use `git mv`.
A moved file changes only in its import specifiers, so `git log --follow` keeps
its history. Identifier renames go in a second commit of the same pull request.
Rewrite the specifiers with a script, and let `npm run build` prove them: `tsc`
refuses an import that does not resolve. Publish the move list in each pull
request.

Before each step, record the baseline counts of tests, pass, fail, skipped,
and todo for the groups selected by the changed paths. After the step, compare
those groups with their baseline, with the new tests added. This is
characterization, as `docs/coding-principles.md` asks for a refactor; no step
makes a false red.

Standard check (SC): run the test groups or existing focused checks selected
by the changed paths under the [test gate policy](test-gate-policy.md#required-runs),
and run `habit-hooks`. Run the path check
`node --test dist/test/unit/test-support-paths.test.js` (from Step 1) when the
changed files affect those paths. Run
`node --test dist/test/acceptance/auth/hosted-live-setup.test.js`, which loads
the live module graph offline, when that graph changes. Apply the doc check
of §3.6 item 9 when the documents change.

"Docker" marks a step that changes a file in the import graph of
`A/auth/self-hosted-container.test.ts` beyond its import specifiers: a
run-time path, a container script, or code. Select the relevant existing
container checks under the [test gate policy](test-gate-policy.md#required-runs).
A pure move needs no Docker run (owner decision 1).

**Step 0. Terms and rules (docs only).** Add `docs/testing/test-code-layout.md`
with §2.1 to 2.4 and §3.1. Link it from `docs/README.md` and from "Test types"
in AGENTS.md. Owner decision 1 is already in
`docs/implementation/test-gate-policy.md`. Safe: no code.

**Step 1. One owner for run-time paths.** Add `S/processes/module-paths.ts`
with `programEntry`, `repositoryRoot` (the same value and type as each user has
today; aware of `.ts` and `.js`), `networkBlocker`, `sqlTracer`,
`foreignOriginProbe`. Switch the test files that reach another test folder or
the repository root: `A/auth/hosted-live-setup.test.ts` (2 paths),
`test/interface/auth/better-auth.test.ts` (1),
`A/auth/local-command-provider-loading.test.ts` (1),
`U/html-cleaner-pipeline/ad-cleaner/ad-rules-deployment.test.ts` (root),
`U/image/check-lightpanda-digest.test.ts` (root). `command-process.ts` and
`server-process.ts` switch in 5a, so this step needs no Docker. Add
`U/test-support-paths.test.ts`: each path of `module-paths.ts`,
`failingAdCleaner`, and `trustedAdRulesFile` exists after a build. Docs:
`docs/testing/test-list.md`. Check: SC and
`node --test dist/test/interface/auth/better-auth.test.js`. Safe: the same
URLs, computed in one place, and a test fails when one points nowhere.

**Step 2. Shared MCP doubles and the raw MCP driver leave the unit tree.**

- `U/mcp/fixtures/access-resolver-mock.ts` → `S/doubles/auth/access-resolver-spy.ts` (10 importers)
- `U/mcp/fixtures/identity-verifier-mock.ts` → `S/doubles/auth/identity-verifier-spy.ts` (9)
- `U/mcp/fixtures/failure-reporter-mock.ts` → `S/doubles/mcp/failure-reporter-spy.ts` (7)
- `U/mcp/fixtures/request-context-tools.ts` → `S/doubles/mcp/context-report-tool-spy.ts` (4)
- `U/mcp/fixtures/mcp-http-request.ts` → `S/drivers/mcp/mcp-http-request.ts` (16)
- `U/mcp/fixtures/access-test-server.ts` → `S/in-process/access-test-server.ts` (5)

Renames: §2.4 item 1 and `RequestContextTools`. Docs: `README.md` (links near
line 127), `docs/testing/test-list.md`, `docs/design/authentication-design.md`.
Check: SC. Safe: only specifiers and identifiers change.

**Step 3. The other borrowed fixtures move.**

- `U/auth-better-auth/fixtures/token-provider-double.ts` (3, integration only) and `local-access-tokens.ts` (3) → `I/auth/fixtures/`
- `U/auth-better-auth/fixtures/local-provider-double.ts` (8) → `S/doubles/auth/`
- `U/hosted-admin/fixtures/browser-session-double.ts` (4) → `S/doubles/auth/`
- `U/organizations/fixtures/organization-directory-double.ts` (3), `change-answers.ts` (1), `directory-double-records.ts` (5) → `S/doubles/organizations/`

Docs: `docs/design/authentication-design.md`, `docs/testing/test-list.md`.
Check: SC; then §3.6 items 3 and 4 already hold. Safe: as Step 2.

**Step 4. Lint the boundaries between test types.** In
`.habit-hooks/eslint.config.mjs`, add `no-restricted-imports` and
`no-restricted-syntax` blocks for D1 to D3 and D6, in the form of the existing
auth blocks. In flat config a later block replaces an earlier block's options
for the same rule, so give each glob one block with all its patterns. Add
`A/architecture/test-layer-boundaries.test.ts`, in the form of
`auth-boundaries.test.ts`: each rule refuses a static, type, re-export, and
dynamic import. Docs: `test-gate-policy.md` (the focused run of the new spec),
`test-list.md`, `test-code-layout.md`. Check: SC and
`node --test dist/test/acceptance/architecture/test-layer-boundaries.test.js`.
Safe: no file moves.

**Step 5. Sort `S/` by role.** Start after PR #86 merges (§3.5). Each sub-step
is one pull request. Steps 5a to 5c change run-time paths or container scripts
and keep the Docker mark; 5d to 5f are pure moves and need no Docker run.

- **5a (Docker)** → `S/processes/`: `command-process.ts` (15 importers),
  `server-process.ts` (11), `server-preloads.ts` (3), `deny-network.ts` (2
  side-effect imports), `trace-sqlite.ts`, `fail-ad-cleaner.ts`,
  `foreign-origin-probe.ts`. `command-process.ts` and `server-process.ts` take
  their paths from `module-paths.ts`; its paths become `./…`. Keep the name
  `trace-sqlite`: the preload drops its own stack frames by that name. Docs:
  `docs/implementation/mcp-p03.md`, `test-list.md` (the `foreign-origin-probe`
  path). Extra check: `I/auth/local-auth-command.test.ts`, whose SQL trace case
  proves the frame filter.
- **5b (Docker)** → `S/container/`: `container-gate.ts`, `container-site.ts`,
  `container-edge.ts`, `container-page.ts`, `container-probe.ts`,
  `server-container.ts`, `docker-cli.ts` (one test importer).
  `container-gate.ts` takes `repositoryRoot` from `module-paths.ts`. Export
  `edgeScript`, `pageScript`, `probeScript` and add them to the path test. Docs:
  `test-gate-policy.md` (the `container-page.ts` path), `test-list.md`. Check:
  SC and `npm run test:container`.
- **5c (Docker)** → `S/fixtures/` and `S/isolation/`: `ad-rules.ts` →
  `S/fixtures/ad-rules.ts`, which reads through `repositoryRoot`;
  `U/fixtures/element-hiding.filters.txt` → `S/fixtures/`; `readAdFixture` and
  the six HTML pages of `U/fixtures/` →
  `U/html-cleaner-pipeline/fixtures/ad-pages.ts` and `…/fixtures/pages/`;
  `html-to-markdown.test.ts` and `hidden-text.test.ts` read through
  `ad-pages.ts`, not `process.cwd()`; `hosted-placeholder.ts` → `S/fixtures/`;
  `data-directory.ts`, `process-environment.ts` → `S/isolation/`. Importers:
  20, 10, 20, 3. Docs: `mcp-p03.md`. Extra check from source:
  `node --test test/unit/html-cleaner-pipeline/ad-cleaner/clean-html-ads.test.ts test/unit/html-cleaner-pipeline/prompt-injection-remover/hidden-html/hidden-text.test.ts`.
- **5d** → `S/drivers/browser/`: `hosted-browser.ts` (21),
  `local-browser.ts` (4), `better-auth-agents.ts` (12), and `cookie-jar.ts` and
  `html-entities.ts` from PR #86; → `S/drivers/mcp/`: `mcp-protocol-eras.ts`
  (12), `mcp-sdk-oauth-client.ts` (2). The tests of the two PR #86 modules stay
  in `U/test-support/` and change their imports. Docs: `test-list.md`,
  `mcp-p03.md`.
- **5e** → `S/in-process/`: `hosted-organization-site.ts` (12),
  `mcp-fetch-site.ts` (6), `in-process-server.ts` (3), `better-auth-local.ts`
  (24), `local-runtime.ts` (18), `axiom-test-export.ts` (5), which holds the
  Axiom header builder of PR #86, `process-html.ts` (6). Docs: `test-list.md`,
  `authentication-design.md`, `docs/testing/otel-logger.md`,
  `basic-mcp-url-fetch-plan.md`, `mcp-p03.md`. Extra check:
  `env -i PATH="$PATH" HOME="$HOME" npx tsx test/acceptance/work-slice/basic-mcp-url-fetch.ts`
  stops with a settings error, not `ERR_MODULE_NOT_FOUND`.
- **5f** → `S/dsl/`: `hosted-administration.ts` (7),
  `workos-sign-in.ts` (4), `local-commands.ts` (15), `local-mcp-user.ts` (6).
  Docs: `test-list.md`, `authentication-design.md`.
- **5g** → `S/doubles/`, in three pull requests. (1) `auth/no-auth-provider.ts`
  (5) and `browser-session-store.ts` (4) → `doubles/auth/`;
  `membership-directory-double.ts` (3) → `doubles/organizations/`;
  `account-operation-probe.ts` (3) → `doubles/hosted-admin/account-operation-spy.ts` ✎;
  `request-context-probe.ts` (6) → `doubles/mcp/protected-tool-spy.ts` ✎;
  `billing-recorder.ts` (2) → `doubles/billing/`. Docs: `mcp-server-plan.md`,
  `basic-mcp-url-fetch-plan.md`, `reference/mcp-fetch-tool.md`, `test-list.md`,
  `authentication-design.md`. Repeat the `tsx` check of 5e. (2)
  `renderer-process-double.ts` (16, ✎ `mockRenderer`), `network-fixture.ts`
  (7), and `builtin-mocks.ts` from PR #86 → `doubles/website-fetcher/`;
  `otel-log-receiver.ts` (3) → `doubles/logging/`. Docs:
  `reference/website-fetcher.md`, `reference/renderer-network-policy.md`,
  `test-gate-policy.md`, `test-list.md`, `mcp-p03.md`. (3) `workos-fake-api.ts`
  (8), `workos-world.ts` (6) → `workos-fake.ts` ✎, `jwt-signing-key.ts` (8) →
  `doubles/workos/`. Docs: `test-gate-policy.md`, `test-list.md`,
  `authentication-design.md`.
- **5h** → `U/html-cleaner-pipeline/fixtures/`: `html-cleaner-context.ts` (31)
  and `sanitize-html.ts` (9). Only that package's unit tests use them.
- **5i.** Add D4, D5, and D7 to the lint rules and the spec. Then
  `find test/support -maxdepth 1 -type f` gives nothing.

**Step 6. Duplication removals (DRY3).** One pull request each. Each new
module goes straight into its final folder. Each item has three or more copies
that mean the same thing and change for the same reason.

- **6a (Docker) MCP SDK client driver.** Thirteen copies in twelve files build
  a `Client` with `versionNegotiation` and connect it: `S/local-mcp-user.ts`,
  `S/mcp-fetch-site.ts`, `A/work-slice/basic-mcp-url-fetch.test.ts`,
  `I/mcp/sdk-http.test.ts` (which also re-creates `eraNegotiation`),
  `A/mcp/http-renderer-shutdown.test.ts`, `A/mcp/http-request-isolation.test.ts`,
  `A/mcp/http-shutdown.test.ts` (2), `A/mcp/http-fetch-refusals.test.ts`,
  `A/mcp/http-fetch-cancellation.test.ts`, `A/auth/mcp-access.test.ts`,
  `A/auth/mcp-failure-reports.test.ts`, `U/mcp/discovery.test.ts`. Add
  `S/drivers/mcp/mcp-sdk-client.ts` with
  `connectMcpClient(t, transport, { era, probe, timeoutMs, checkEra })`.
  Transports stay with their callers, because their auth and `fetch` differ.
  The driver registers no cleanup: the shutdown tests close the client in a set
  order. Options keep each call as it is: `probe` where the call has it,
  `timeoutMs` 5,000 (10,000 in `local-mcp-user.ts`), `checkEra: false` for the
  six calls that do not check the era today.
- **6b Operator log spy.** Eight classes record log lines. Six are identical
  and record `INFO` and `ERROR` lines: `LogLines` in the three
  `A/auth/hosted-workos*.test.ts` files and in `S/hosted-live/local-https-site.ts`;
  `RecordingLogger` in `I/auth/hosted-organizations.test.ts` and
  `I/auth/hosted-administration.test.ts`. Add
  `S/doubles/application/operator-log-spy.ts` (`OperatorLogSpy`). The variant
  without the `INFO` prefix has two copies
  (`U/application-operator-log.test.ts`, `I/auth/local-installation.test.ts`)
  and stays.
- **6c Hosted WorkOS site.** The three `openSite()` functions of
  `A/auth/hosted-workos*.test.ts` compose the same site; the hosted test
  configuration (`PUBLIC_BASE_URL: 'https://thermus.example/team'`) exists six
  times; the MCP discover call exists three times. Add
  `S/in-process/workos-site.ts` with `serveWorkOSSite(t, setUp)`, which gives
  the fake, transport, base URL, log, and `discover(token?)`. Move
  `WorkOSServerSite` there from `S/dsl/workos-sign-in.ts`. Add
  `S/fixtures/hosted-config.ts` (`hostedConfig`) and use it in the three tests,
  `I/auth/workos-provider-organizations.test.ts`, `I/auth/hosted-account.test.ts`,
  and `hosted-organization-site.ts`.
- **6d Hosted role catalog.** One fact has three support copies:
  `environmentRoles` in the WorkOS fake, `hostedRolePermissions` in
  `S/hosted-live/settings.ts`, and the grants of `hosted-organization-site.ts`.
  `memberRole` has three copies: `directory-double-records.ts`,
  `hosted-organization-site.ts`, and `U/organizations/organization-administration.test.ts`;
  the unit test copy stays (§3.3). Add `S/fixtures/hosted-roles.ts`. Keep the
  key order user, admin, super-admin, member, because the fake lists roles in
  that order. `roleGrantOf` in `directory-double-records.ts` keeps its own
  user-and-admin map: it refuses other roles, which is behavior. Then the fake
  and the live gate cannot drift apart.
- **6e Outbound fetch guard.** Four modules replace `globalThis.fetch` in
  `before` and restore it in `after`: `test/interface/auth/workos.test.ts`,
  `test/interface/auth/better-auth.test.ts`, `I/auth/local-access.test.ts`,
  `I/auth/fixtures/workos-session-world.ts`. Add
  `S/isolation/outbound-fetch-guard.ts` with
  `guardOutboundFetch({ allowLoopback, refusal, finding })`. Each call passes
  its current messages. `deny-network.ts` and `foreign-origin-probe.ts` replace
  `fetch` for a whole process and stay as they are.
- **6f Form by label.** `formFor` (`hosted-organization-site.ts`, 11 users),
  `formNamed` (`S/hosted-live/portal-visit.ts`), and `formNamed`
  (`A/auth/hosted-workos-administration.test.ts`). Add `formLabelled()` next to
  `formsIn()` in `S/drivers/browser/hosted-browser.ts`; the two live users of
  `formNamed` (`administration-server.ts`, `organization-server.ts`) change
  their import only. One output changes: on failure, `formFor` printed all
  fields; the shared message prints labels only, as the live code does, because
  fields hold form tokens.
- **6g (Docker) Operator log reader.** `S/processes/server-process.ts`,
  `S/container/server-container.ts`, and `S/in-process/in-process-server.ts`
  each parse the listening line and the tenant line. Add
  `S/drivers/operator-log.ts` with `listeningUrlIn`, `tenantIn`,
  `completionRecordsIn`. Use the tenant pattern of `in-process-server.ts`,
  which ends at the full stop of today's line.

**Step 7. Complexity reductions (structure only).**

- **7a.** Split `S/doubles/workos/workos-fake.ts` (630 lines) by
  responsibility: `workos-fake.ts` (state, setup, public API; about 200 lines),
  `workos-fake-wire.ts` (JSON shapes, list and error answers),
  `workos-fake-directory.ts` (membership, user, organization, and
  role-assignment routes with paging), `workos-fake-invitations.ts` (invitation
  routes and send refusals), `workos-fake-sessions.ts` (codes, refreshes,
  browser and Connect tokens). The facade gives each part a narrow view of its
  state. Check: the commit changes no file in `test/acceptance` or
  `test/integration`, and the five users give the same counts.
- **7b.** Split `S/in-process/hosted-organization-site.ts`: `members`,
  `member()`, `userOf()`, the organization names, and `administrationMembers`
  (from `S/dsl/hosted-administration.ts`) → `S/fixtures/hosted-members.ts`;
  `statusesOf()`, `contextAt()`, `destinationPaths` → `S/dsl/hosted-access.ts`.
  The composition stays.
- **7c (Docker; owner decision 2, because it edits test-case text).** Move the
  DSL steps `openSignIn()` and `authorize()` from `LocalBrowser` to
  `LocalMcpUser`, and `serverFetch()` to `S/drivers/mcp/`. Eight test cases
  then read `user.openSignIn()`, not `user.browser.openSignIn(…)`.
- **7d.** Remove the `export` of the four values and about 37 types that no
  other file imports (the report's list; PR #86 did this for the files it
  touched; check each remaining one with `grep` first).

**Step 8. Remaining names.** 8a: §2.4 item 4. 8b: rename
`…/css-visibility/helpers/` to `…/fixtures/` (34 importers) and change
`./helpers/css-pipeline` in `css-selector-cost.test.ts`. PR #83 (merged) added
`pipeline-child.ts` next to `css-pipeline.ts`; it finds `css-pipeline` as a
sibling and needs no change.

### 3.3 What not to do

- Do not merge the two WorkOS worlds. One is a scripted stub: the
  browser-session tests need exact control of each answer. The other is a fake
  with a model for the acceptance tests. They share three setup lines.
- Do not merge the four browsers into one class now. They are four drivers of
  one channel for four entry points. Their answer types differ (`Response`,
  `PageResponse`, `BrowserAnswer`, `ServerAnswer`), and 40 importers use them.
  PR #86 extracts the real shared knowledge: the cookie jar and the entity
  decoding. The `node:http` send exists twice. Revisit when one DSL must drive
  the offline and the live administration specifications, which repeat
  scenarios, through two drivers.
- Do not extract a "serve on loopback" helper. The copies differ in grace time,
  logger, and close order, which the shutdown tests check. The shared part is
  one option object.
- Do not share code with `container-edge.ts`, `container-page.ts`, or
  `container-probe.ts`. Each runs alone in a container. `container-page.ts`
  repeats `resolveAsPublic` and `permitIPv4Fixture` on purpose.
- Do not restructure `S/hosted-live/` or the live test-case modules. No offline
  run can show their behavior. Move their channel mechanics (for example
  `shownPage` and `submit` in `administration-server.ts`) in the next ticket
  that runs the live gate.
- Do not share literal test data such as URLs, emails, and redirect URIs. A
  test shows its data. Share only named environment settings.
- Do not replace the unit-package copies of the role grants with the catalog.
  They are examples in one package's suite; a catalog change must not ripple
  through unrelated unit suites.
- Do not derive an expected value from `src`, for example the role catalog from
  `hosted-role-mapping.ts`. The test must stay an independent check. Type-only
  imports of public contracts are allowed. (PR #86 makes `browserIssuer` call
  `browserSessionIssuer` of `src`; that is a settings value, not an expected
  value, so it may stay. Do not go further.)
- Do not merge two-copy pairs or pairs with different contracts:
  `BillingDouble` and `BillingRecorder`, `ProtectedToolSpy` and
  `ContextReportToolSpy`, the two `cookieHeaderOf`, `hiddenField` and
  `hiddenOauthQuery`, the offline and live copies of `assertNotice`,
  `assertOnboarding`, `seatsIn`, and `labelsOf`.
- Do not move the tests of support code (`renderer-process-double.test.ts`,
  `network-fixture.test.ts`, `no-auth-provider.test.ts`,
  `operator-runbook.test.ts`, `axiom-test-export.test.ts`, and the
  `U/test-support/` tests of PR #86) under `S/`. The suite globs select by
  folder, and `npm run check` would drop them.
- Do not add path aliases or barrel files. Relative `.ts` imports with
  `rewriteRelativeImportExtensions` are the standard, and
  `build-output.test.ts` pins the build.
- Do not rename every `*Double`. "Double" is correct; the churn buys nothing.
- Do not mix a move with a logic change in one commit.

### 3.4 Risks and how to remove them

- **Run-time paths.** Seven support files compute paths at run time:
  `ad-rules.ts`, `command-process.ts`, `server-process.ts`,
  `server-preloads.ts`, `container-gate.ts`, `container-site.ts`,
  `S/hosted-live/local-https-site.ts`. Eleven test files do too. Four reach
  another test folder: `hosted-live-setup.test.ts`, `better-auth.test.ts`,
  `local-command-provider-loading.test.ts`, `css-selector-cost.test.ts`. Two
  reach the repository root: `ad-rules-deployment.test.ts`,
  `check-lightpanda-digest.test.ts`. Three reach a `src` module for a child
  process: `data-directory-lock.test.ts`, `source-range-parser.test.ts`,
  `console-logger.test.ts`. Two read fixture pages through `process.cwd()`:
  `html-to-markdown.test.ts`, `hidden-text.test.ts`. `renderer-gate-setup.test.ts`
  reaches a sibling file, and `trace-sqlite.ts` filters by its own name.
  Removal: Step 1 puts the cross-folder and root paths in one module and tests
  them; D8 keeps them there; 5c removes the two `process.cwd()` readers; the
  `src` module paths and sibling paths stay (D8 allows them).
  `build-output.test.ts` assumes only the `test/<type>/` suites and
  `dist/test/**`; the layout keeps both.
- **Container gate.** Removal: D6; move the container files together in one
  step (5b); run `npm run test:container` on a Docker host for the six Docker
  steps, or let such a step wait. A pure move needs no run (owner decision 1):
  the acceptance suite still loads the container file and skips it, which
  proves module resolution, and the path test of Step 1 proves each run-time
  path.
- **Preloads.** They load by URL through `--import` and `NODE_OPTIONS`;
  `fail-ad-cleaner.ts` imports `server-preloads.ts`. Removal: keep the preload
  family in one folder; the path test checks each URL; the SQL trace case
  checks `trace-sqlite.ts`.
- **Live gate.** It needs WorkOS staging. Removal: change only import
  specifiers there, plus the two shared modules of 6b and 6d;
  `hosted-live-setup.test.ts` loads the live module graph offline; record the
  gate as "did not run" when the settings are missing, as the policy says.
- **Running from source.** The work slice runs with `tsx`, and a unit file can
  run from source with Node type stripping. Removal: the `tsx` check of 5e and
  the source run of 5c.
- **Docs.** Fifteen documents name 200 distinct test paths 472 times;
  `docs/testing/test-list.md` alone has 199 mentions. Removal: each pull
  request lists its moves; §3.6 item 9 finds every old path and old name. The
  archive documents keep their historical paths.
- **Parallel branches.** Moves conflict with ticket branches. Removal: small
  pull requests merged at once, and a published move list that a branch can
  replay.
- **New files from other work**, for example `pipeline-child.ts` from PR #83.
  Removal: re-run the inventory script before each Step 5 sub-step and before
  8b.

### 3.5 Relation to PR #86 (the DRY3 session)

PR #86 on `claude/youthful-babbage-a404b2` is Ready for review, mergeable,
and not merged. It holds all nine of its items in ten commits and 58 files,
with no `src` change: the two comment fixes; `S/cookie-jar.ts` and
`S/html-entities.ts`; `S/builtin-mocks.ts` (the mock-reset helper);
`S/hosted-live/sdk-errors.ts` (the shared `statusOf`); the Axiom header
builder inside `S/axiom-test-export.ts`; the move of
`test/helpers/process-html.ts` and `sanitize-html.ts` into `S/`; the `src`
type imports in `local-runtime.ts`, `local-commands.ts`, and
`hosted-live/settings.ts`; the export cleanup; and the docs. The tests of the
new modules are in `U/test-support/`.

Sequence this plan after it, from Step 5 on. Steps 0 to 4 touch no file of
PR #86 and can start now.

Do not absorb it. It is small, defined, and in progress. Its changes edit 15
files that Step 5 moves; two branches that move and edit the same files
conflict on each of them. Its output also helps this plan. When it merges,
Step 5 moves each shared helper with its family: `cookie-jar.ts` and
`html-entities.ts` to `S/drivers/browser/` (5d), `builtin-mocks.ts` to
`S/doubles/website-fetcher/` (5g), the Axiom header builder with
`axiom-test-export.ts` (5e), `hosted-live/sdk-errors.ts` stays,
`process-html.ts` goes to `S/in-process/` (5e), and `sanitize-html.ts` goes to
`U/html-cleaner-pipeline/fixtures/` (5h). PR #86 is Ready, and a change to it
returns it to Draft, so it keeps its layout; Step 5 does the moves.

### 3.6 Acceptance criteria

1. The groups or focused checks selected by the changed paths under the
   [test gate policy](test-gate-policy.md#required-runs) give their baseline
   counts plus the new tests. Run any selected container checks on a Docker
   host. Record a selected live check that cannot run as "did not run".
2. `ls test/support` gives
   `container dsl doubles drivers fixtures hosted-live in-process isolation processes`.
   `find test/support -maxdepth 1 -type f` gives nothing. `test/helpers` does
   not exist.
3. `grep -rEn "from '(\.\./)+(unit|integration|interface|acceptance)/" test/support`
   gives nothing.
4. `grep -rEln "from '(\.\./)+(integration|interface|acceptance)/" test/unit`
   gave only `test/unit/work-slice/basic-mcp-url-fetch.test.ts` at Step 4.
   Since 2026-10-15 it gives nothing.
   `grep -rEln "from '(\.\./)+unit/" test/integration test/interface test/acceptance`
   gives nothing.
   `grep -rEn "from '(\.\./)+[a-z-]+/fixtures/" test/unit | grep -v support/fixtures/`
   gives nothing.
5. `habit-hooks` is clean, `.habit-hooks/snooze.json` is `[]`, and
   `node --test dist/test/acceptance/architecture/test-layer-boundaries.test.js`
   passes.
6. `grep -rEn "\b(AccessResolverMock|IdentityVerifierMock|FailureReporterMock|RequestContextTools|RequestContextProbe|AccountOperationProbe|WorkOSWorld|mockRenderer)\b" test docs README.md`
   gives nothing.
7. Duplication: `grep -rln "versionNegotiation" test` gives only
   `mcp-sdk-client.ts`. `grep -rn "class LogLines\|class RecordingLogger" test`
   gives only the two prefix-free copies.
   `grep -rln "globalThis.fetch = " test` gives `outbound-fetch-guard.ts`,
   `deny-network.ts`, `foreign-origin-probe.ts`.
   `grep -rn "candidate.label === label" test` gives one line.
   `grep -rn "PUBLIC_BASE_URL: 'https://thermus.example/team'" test` gives one
   line. `grep -rln "composeWorkOSApplication" test` gives `workos-site.ts`.
   `grep -rln "src/index.js\|deny-network.js" test` gives `module-paths.ts`.
8. `wc -l test/support/doubles/workos/*.ts` shows no file above 250 lines.
   `git log --follow` of each moved file reaches its first commit.
9. For each line `old new` of the combined move list,
   `grep -rn "old" docs README.md AGENTS.md test` gives nothing, except in
   `docs/archive/`.

## 4. Addendum (2026-10-16): the additions since Step 5

Between the Step 5 stack and its merge, 45 commits landed on `main` from the
free hosted signup, MFA policy, hosted Docker image, production deployment,
and auth work-slice work (PRs #108 and #114 to #124). They changed 145 files
under `test/` and added 38 auxiliary files, 21 of them under `test/support`.
This addendum records what they changed, what the review of 2026-10-16 found
when it classified the new files against `docs/testing/test-code-layout.md`,
what Step 6 must absorb, and the extra cleanup, Step 9. Each fact below was
checked with `grep` or by reading the file.

### 4.1 What still holds

- No file under `src/**` imports test code. The one mention is a comment in
  `src/html/html-escape.ts`.
- The two architecture specifications pass (56 cases), and the lint rules D1
  to D7 report nothing over `test/**`. No file imports across test types, and
  no unit test imports another package's fixtures. The new work removed the
  old work-slice exception of D2 and updated the rule text.
- `test/support` has no loose file.

### 4.2 What broke or drifted

- **A tenth folder.** `S/work-slice/` holds three files. The layout tree
  lists nine folders, and D2 now names the tenth, so the layout document
  contradicts itself.
- **The Step 6 copies grew.** 6a: the MCP SDK client setup is in 15 files
  (16 sites), among them `A/auth/hosted-live/signup-server.ts`. 6c:
  `openSite()` is in 8 files, the hosted test configuration in 7, and
  `composeWorkOSApplication` is called in 11 files, where Step 6c found 3; the
  new `S/in-process/workos-signup-site.ts` is a second site composer that
  overlaps the planned `workos-site.ts`. 6d: the role catalog has two more
  copies, in `S/doubles/workos/workos-signup-fake.ts` and
  `U/auth-workos/fixtures/signup-workos-fake.ts`. 6g: the listening-line
  parser has a fourth copy, in `S/container/hosted-image-gate.ts`. 6b, 6e,
  and 6f are unchanged.
- **A double parked as data.** `S/fixtures/lightpanda-version.sh` stands in
  for the Lightpanda executable; it is a stub, not fixture data.
- **A driver in the live-gate folder.** `S/hosted-live/https-client.ts` is a
  node:https driver that only two integration test-case modules use, and
  `frontGet()` in `I/auth/hosted-live-site.test.ts` is a second copy.
- **Container scripts copied instead of extended.** `hosted-image-probe.ts`
  repeats the pnpm store regex, the renderer version call, the write check,
  and eight of nine development package names of `container-probe.ts`;
  `hosted-image-page.ts` repeats the DNS override, the `--block-cidrs`
  launch wrapper, and the port-8090 page of `container-page.ts`. D6 forbids
  a shared import between container scripts, and the lint rule and the
  support spec name only the three old scripts. `hosted-image-identity.ts`
  imports three `src` modules and works only because the gate mounts it at a
  hard-coded image path that copies the repository layout.
- **Test code re-creates product code.** `S/work-slice/pinned-renderer.ts`
  repeats `assertHostedRenderer` of `src/hosted-renderer-startup.ts`, which
  came later. `S/hosted-live/portal-front.ts` repeats the headers and the
  build loading of `HostedPortal` in `src/hosted-portal.ts`, which also came
  later. `S/drivers/workos/signup-contract-driver.ts` rebuilds the SDK client
  that `workosClient` of `S/hosted-live/settings.ts` builds, repeats the
  staging-key guard of `hosted.live.ts`, and hard-codes the staging client ID.
- **One default in ten places.** `settings.mfaPolicy` is optional, and ten
  readers repeat `?? 'optional'`.
- **Names.** `U/work-slice/fixtures/launcher-case.ts` is a harness, and the
  layout names a harness `<subject>-harness.ts`; "case" claims a test case.
  `SignupWorkOSFake` (unit) and `WorkOSSignupFake` (support) differ only in
  word order. The rename of `workos-session-world.ts` (Step 8a) is still open.
- **D7.** Five new tests of support code are outside `U/test-support/`:
  `U/server-preloads.test.ts`, `U/work-slice/observe-fetches.test.ts`,
  `U/work-slice/stop-signal.test.ts`,
  `U/auth-workos/signup-contract-cleanup.test.ts`, and
  `U/auth-workos/signup-live-cleanup.test.ts`.
- **Exports without an importer.** `HostedImageServer`, `HttpsExchange`,
  `PortalFile`, `WorkSliceParts`, `LocalHttpsSiteOptions`, `BrowserSession`
  (live), `settings` and `World` (`workos-session-world.ts`), `ClientCall` and
  `checked` (`workos-session-client-double.ts`).
- **Comments that disagree with the code.** The header of `live-run.ts` says a
  run deletes its fixtures, but a run made with `existingFixtures` does not.
  `auth-workos-mcp-url-fetch.ts` line 45 says production composes the hosted
  edition without a tool, but `src/hosted-workos-application.ts` adds the
  fetch tool servers since commit 080dd065. Both launcher scripts say pnpm
  runs the package script, which they do not do, and the basic entry point
  names the package script while its README and launcher use `pnpm exec node`.
- **Layout document.** The tree lists `drivers/browser/` and `drivers/mcp/`
  only; `drivers/workos/` exists now and the Terms allow it. The data folder
  `S/fixtures/hosted-portal/` is not named.

Two-copy pairs, recorded for the third copy and not shared now (DRY3): the
probe run, label cleanup, `waitForLog`, port lookup, and `--env` flatten of
`hosted-image-gate.ts` against `container-gate.ts` and `container-site.ts`;
the private harness of `U/work-slice/basic-mcp-url-fetch-script.test.ts`
against `launcher-case.ts`; `Environment`, `run()`, and the Axiom instruction
lines of the two work-slice entry points; and `temporaryDirectory()` of
`I/auth/fixtures/https-site-fixtures.ts` against `dataDirectory()` (check).

### 4.3 What Step 6 absorbs

Step 6 continues on the rebased stack with these changes to its items. 6a
covers the 15 files. 6c's `serveWorkOSSite(t, setUp)` takes over
`workos-signup-site.ts` (options for the signup fake and the signup documents)
and replaces the `openSite()` of `A/auth/hosted-mcp-signup-guidance.test.ts`
and the direct `composeWorkOSApplication` calls of the hosted-workos signup
and MFA policy tests and of `A/work-slice/…/auth-workos-onboarding.test.ts`;
`S/hosted-live/local-https-site.ts` and the auth work-slice entry point keep
their own composition, because they are sites of other deployments. 6d's
`hosted-roles.ts` also feeds `workos-signup-fake.ts`; the unit fixture copy
stays, as §3.3 says. 6g's operator log reader also serves
`hosted-image-gate.ts`. Criterion 7 changes to: `composeWorkOSApplication` is
called only in `workos-site.ts`, `local-https-site.ts`, and the auth
work-slice entry point.

### 4.4 Step 9: the extra cleanup

One draft PR per item, stacked, after Step 6 is merged. The same rules as
Steps 5 and 6: baseline counts first, `git mv` for a move, a rename in a
second commit, no behavior change, docs in the same PR, Docker only where
marked.

- **9a. Retire the tenth folder.** `S/work-slice/observe-fetches.ts` →
  `S/doubles/mcp/fetch-operation-spy.ts` (P3: unit and acceptance use it; the
  contract `FetchOperation` is in `src/mcp`); `S/work-slice/stop-signal.ts` →
  `S/processes/stop-signal.ts` (P3), with a header line that says why it uses
  `on` where `src/index.ts` uses `once`; `S/work-slice/pinned-renderer.ts` is
  deleted and the two entry points call `assertHostedRenderer` of
  `src/hosted-renderer-startup.ts`, because an entry point runs product code
  (owner's call: keep a copy in `A/work-slice/fixtures/` instead). Update D2
  in `test-code-layout.md` and in this plan, line 45 of
  `test-type-boundaries.test.ts`, `docs/testing/test-list.md`,
  `docs/implementation/basic-mcp-url-fetch-plan.md`, and
  `docs/implementation/auth-workos-mcp-url-fetch-validation.md`. Then
  criterion 2 holds again.
- **9b (Docker). Extend the container scripts instead of copying them.** Add
  the hosted image probes as `PROBE` entries of `container-probe.ts` and the
  hosted page as a mode of `container-page.ts`, delete `hosted-image-probe.ts`
  and `hosted-image-page.ts`, and point `hosted-image-gate.ts` at the shared
  scripts through `module-paths.ts`. Put the in-image paths of the identity
  and page mounts in one place. Extend the D6 lint rule and the support spec
  to every script under `S/container/` that runs in a container. Remove the
  `export` of `HostedImageServer`. Check: `npm run test:container` and the
  hosted image gate.
- **9c. Signup fakes.** Make `workos-signup-fake.ts` use the shared role
  catalog of 6d and the `roleJson` and `organizationJson` of `workos-fake.ts`
  (export them from the fake). Rename `SignupWorkOSFake` in the unit fixture
  to `SignupClientFake`, because it stands in for the narrow SDK client of
  `WorkOSSignup`.
- **9d. The renderer stub.** `S/fixtures/lightpanda-version.sh` →
  `S/doubles/website-fetcher/lightpanda-stub.sh`; `hosted-placeholder.ts` and
  `module-paths.ts` follow.
- **9e. The HTTPS driver.** `S/hosted-live/https-client.ts` →
  `S/drivers/browser/https-client.ts` (P4), and `frontGet()` of
  `I/auth/hosted-live-site.test.ts` uses it.
- **9f. One MFA default.** `settings.ts` gives `mfaPolicy` with its default
  applied; the ten `?? 'optional'` fallbacks go.
- **9g. Names and D7.** `launcher-case.ts` →
  `auth-workos-mcp-url-fetch-script-harness.ts`; `workos-session-world.ts` →
  `workos-session-fixtures.ts` with its identifiers (Step 8a); the five new
  tests of support code → `U/test-support/`. Optional: the older tests of
  support code (`renderer-process-double.test.ts`, `network-fixture.test.ts`,
  `no-auth-provider.test.ts`, `operator-runbook.test.ts`,
  `axiom-test-export.test.ts`, `test-support-paths.test.ts`) → the same folder.
- **9h. Comments, exports, and the layout document.** Fix the four comments
  of §4.2; remove the `export` of the nine symbols of §4.2; add
  `drivers/workos/` and the `fixtures/hosted-portal/` data folder to the tree
  in `test-code-layout.md`, and say that D6 covers every container script.
- **9i (owner's call). Product copies.** Let `LocalHttpsSite` serve the
  portal through `HostedPortal` of `src` and retire `portal-front.ts`, since
  the work-slice README allows a test-only part only where the product has
  none. Make `SignupContractDriver` take its client from `workosClient` of
  `settings.ts`, share the staging-key guard with `hosted.live.ts`, and read
  the client ID from the settings. Both need a run of the live gate or the
  signup contract test, so they wait for a ticket that runs it.

Acceptance for Step 9: criteria 2 to 5 of §3.6 hold; criterion 7 holds as
§4.3 restates it; `ls test/support/doubles/mcp` lists `fetch-operation-spy.ts`;
`find test/support/container -name 'hosted-image-p*'` gives nothing; the D6
spec names every container script; `grep -rn "?? 'optional'" test` gives
nothing; and each moved or renamed path is absent from the docs outside
`docs/archive/`.
