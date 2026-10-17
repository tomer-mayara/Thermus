# Test code layout and terms

This document gives the terms for the auxiliary files under `test/`: the files
that are not test cases. It also gives the layout of `test/support`, the rules
that say where a file lives, and the rules that say what a file may import.
[AGENTS.md](../../AGENTS.md) defines the test types. The
[test code refactoring plan](../implementation/test-code-refactoring-plan.md)
gives the review behind these terms, the ordered steps that bring the files to
this layout, and the state of each rename. Until a step of the plan runs, a
file stays where it is today.

The terms follow Dave Farley's four-layer model of acceptance testing, with
Gerard Meszaros's test-double terms as Farley uses them. Neither author
reviewed or endorsed this document.

Path abbreviations: `S/` = `test/support/`, `U/` = `test/unit/`,
`I/` = `test/integration/`, `A/` = `test/acceptance/`.

## Terms

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

The hosted image acceptance test uses `hosted-image.test.ts`. Its ordinary
suite commands explicitly exclude the emitted basename; its dedicated command
selects it. The other runtime and live gate names stay as listed above.

## Double kinds

This repository needs these kinds of test double:

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
  the rule of [the coding principles](../coding-principles.md). The one
  mock-like trait, `RunbookClientDouble` failing on a forbidden call, is a
  guard inside a fake. No file or class may carry the name Mock. `node:test`
  calls its API `t.mock`, but `t.mock.method` makes stubs and spies.

## Words in use today

| Current word | Meaning here | Our term | Verdict |
|---|---|---|---|
| double | Any stand-in | Test double | Correct but vague. Keep on today's mixed kinds; new files name the kind. |
| mock | `AccessResolverMock`, `IdentityVerifierMock`, `FailureReporterMock`, `mockRenderer()`, "the mock provider" in docs | Spy; stub | Wrong. Rename the classes and the function. The docs phrase is owner decision 3 of the plan. |
| fixture, `fixtures/` | Data, builders, private doubles; `network-fixture.ts` is a local web site | Fixture data; fake | Keep. |
| support | Shared test code | Root of layers 2 to 4, doubles, shared data | Keep; sort by role. |
| helpers | Two folders with no defined meaning | — | Remove the word. PR #86 removed `test/helpers`. |
| probe | In-process spies and child scripts | Probe (child scripts only) | Two meanings. Rename the spies. |
| seam | The "page seam" of `container-page.ts` | Seam | Keep. |
| driver | `authkit-driver.ts`, the runbook driver | Protocol driver | Keep. |
| world | A fake of WorkOS and a fixture module | Fake; fixture module | Wrong: in BDD a world is the per-scenario context. Rename both. |
| site | A reachable deployment | Site | Keep as the layer-4 noun. |
| harness | `local-auth-command-harness.ts` | Harness | Keep. |
| recorder | `BillingRecorder` | Spy | Accurate. Keep. |
| store | `BrowserSessionStore` | Fake | Accurate about its mechanism. Keep. |
| launcher | Code that starts a process | Site (process) or CLI driver | Do not use in names. |

## Names that change

The plan renames these identifiers in its steps:

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
   PR #86 already moved the two files of `test/helpers/` into `test/support/`.

A rename changes identifiers only. It never changes a string that the system or
a test observes, such as the authority `hosted-provider-double`.

## Layout

```
test/
  unit/<package>/        test cases; fixtures/ = data and doubles of this package only
  integration/<area>/    test cases; fixtures/ = files of this area only
  interface/<area>/      test cases
  acceptance/<area>/     test cases; fixtures/ = files of this area only;
                         auth/hosted-live/ test-case modules; work-slice/
  support/
    dsl/                 layer 2
    drivers/             layer 3: operator-log.ts, the reader of the operator log of the server
    drivers/browser/     layer 3: HTTP browsers, cookie jar, page forms, HTTPS request driver
    drivers/mcp/         layer 3: MCP SDK client, raw MCP request, eras, OAuth client
    drivers/workos/      layer 3: WorkOS REST driver of the signup contract
    in-process/          layer 4: the system composed in the test process
    processes/           layer 4: the system as a child process; CLI driver; preloads; probes; module-paths.ts
    container/           layer 4: the system in Docker; Docker driver; container scripts
    hosted-live/         layers 2 to 4 of the live staging environment (unchanged)
    doubles/<name>/      <name> = src package of the contract (auth, mcp, organizations, hosted-admin,
                         billing, application, website-fetcher, logging) or external system (workos)
    fixtures/            shared fixture data, settings, data files
      hosted-portal/     the portal build fixture of the offline hosted tests
    isolation/           per-test isolation in the test process
```

Two axes stay apart. The top folders under `test/` give the test type.
AGENTS.md decides the type by the packages that a test executes, not by the
folder of its helpers. The folders under `S/` give the layer role. The four
layer-4 folders are the four deployments of the product under test: composed
in the test process, as a child process of `dist/src/index.js`, as the Docker
image, and against WorkOS staging. So a reader sees how production-like a
site is.

### Placement rules

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
This repository showed the cost: four HTTP browsers and thirteen MCP client
setups. The better rule: private things near their users, shared roles in one
home.

### Dependency rules

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
- D6. Each script under `S/container/` that runs in a container runs there
  alone, so it imports only `node:` modules: `container-edge.ts`,
  `container-page.ts`, and `container-probe.ts`. The one
  exception is the preload `hosted-image-identity.ts`: the hosted image gate
  mounts it at the path of the emitted test support in the image. The preload
  does not run alone: it runs in the server process of the image and imports
  `src` as the image has it.
- D7. No `*.test.ts` under `S/`. The suite globs select by test-type folder.
  The tests of support code live in `U/test-support/`, as PR #86 started.
- D8. A run-time path from support code to another folder or to the repository
  root lives only in `S/processes/module-paths.ts`. A path to a sibling file
  may stay in its user. A test file may compute a path to a `src` module that it
  runs in a child process, or to a sibling file.

The cross-layer imports: support → unit fixtures goes; integration and
acceptance → unit fixtures goes (Steps 2 and 3 of the plan move the 13 borrowed
files); unit → support stays, because `S/` is the shared base of all test
types. ESLint enforces D1 to D7 (Steps 4 and 5i of the plan), and two
architecture specifications prove each rule, one for each axis.
`test/acceptance/architecture/test-type-boundaries.test.ts` proves D2 and D3,
and `test/acceptance/architecture/test-support-boundaries.test.ts` proves D1 and
D4 to D7, as `test/acceptance/architecture/auth-boundaries.test.ts` does for
`src`.
