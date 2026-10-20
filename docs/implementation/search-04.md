# SEARCH-04: Shared resources and hosted capacity

Date: 2026-10-20.
Status: implementation and verification in progress.

This record covers [SEARCH-04](search-pipeline-plan.md#search-04-share-renderer-resources-and-hosted-operation-capacity).
It continues the Draft pull request for SEARCH-03. The comparison base for
this verification round is `063404050aaf2d8989039309afc96d0308f7b318`.
During verification, `main` advanced from the prior SEARCH-03 base only by
updating the unused `tools/code-review-agents` submodule reference. That
update changes no application, test, or build input and is included before
the quality comparison. The submodule stays uninitialized.

## Composition

`createToolOperations(environment, logger)` creates the fetch and search
operations for one application. They share one Lightpanda fetcher, one loaded
ad rule set, the ad cleaner, the sanitizer, the outgoing observation step,
the record sink, and the renderer setup reporter. The setup reporter retains
one set of reported codes across both operations.

Each operation has its own HTML pipeline and converter. Fetch retains the
default converter. Search enables `preserveSearchResults` and uses
`SearchEngineBraveHttp` and `SearchPipeline`. Search retains its typed release
or withholding result for the MCP projection in SEARCH-05.

`createHostedToolOperations` wraps both operations with one `OperationCapacity`.
The owner checks cancellation before busy, refuses overlap without a queue,
and releases its slot only after the operation settles. The slot includes
outgoing work, rendering, incoming work, and cleanup. Self-hosted operations
have no capacity wrapper.

Sharing the fetcher also shares its abandoned DNS guard. A cancelled caller
can return before a native DNS lookup settles, but the other operation cannot
start another lookup through a separate fetcher. Each application retains
its own resources and capacity state.

Both production entry points use these factories. `fetchToolServers` still
receives the fetch operation until SEARCH-05 adds public search dispatch.
There is no change to the lifecycle algorithm in `MCPServer`.

## Check selection

The complete candidate changes `src/`. It selects `npm test`,
`npm run typecheck`, `npm run test:build`, and `npm run build:user-portal`.
Run portal tests separately if a backend failure stops the ordinary command.
The composition changes also select `npm run test:mcp:renderer`,
`npm run test:container`, `npm run build:hosted`, and the Linux AMD64 gate
`npm run test:container:hosted`.

The change does not alter hosted authentication, organization reads or writes,
signup creation, acceptance records, or SDK retry settings. Their dedicated
live gates are not selected. The ordinary suite retains their offline tests.

Run habit-hooks and the full ast-metrics process against the fixed base.
Collect unit and integration coverage because both groups are already
selected by `npm test`. Reuse the documented local analyzer correction in
[SEARCH-02](search-02.md#analyzer-completeness-correction). Keep the installed
analyzer, quality rules, baseline, and immutable history records unchanged.

Public search registration and the pinned end-to-end search runtime proof
remain in SEARCH-05 and SEARCH-06. Keep the pull request Draft while the
public search acceptance cases remain open.

## Test-first evidence and review

The capacity worker first ran all five existing fetch-only capacity cases
successfully. The new capacity specification then failed because
`operation-capacity.ts` did not exist. After implementation, all 13 cases
passed. The concrete composition specification first failed because
`createToolOperations` was not exported. Its focused checks later passed.

The additional capacity acceptance matrix was written after the factory
existed. It passed all 20 cases; no red run is claimed for that matrix.
The manager's combined source run passed all 44 cases in the capacity,
composition, hosted-capacity, and existing renderer-report test files.

Manager review confirmed one owner through settlement, exact typed results,
and no second hosted slot. It corrected asset paths for emitted integration
tests, added a bounded DNS cancellation check, and made polling stop at the
test deadline. The first full build found missing types in test spies and
cleanup callbacks; those test annotations were corrected before verification.

The manager reviewed and signed off all three workers' changes. The source
and test candidate is `19eda2b0`; subsequent record updates add only prose.

## Complete-candidate checks

`pnpm install --frozen-lockfile` passed. Commands use pnpm 12.10.1 and
Node 24.20.0 through `pnpm exec`.

| Check | Exit | Result |
| --- | --- | --- |
| Combined focused source run | 0 | All 44 cases passed. |
| `npm test` | 1 | 5,689 of 5,694 backend cases passed in 304 suites. Five failures are listed below. |
| `npm run test:user-portal` | 0 | All 41 cases passed. Run separately because the backend failures stopped the ordinary command. |
| `npm run typecheck` | 0 | Backend and portal types passed. |
| `npm run test:build` | 0 | All 13 cases passed. |
| `npm run build:user-portal` | 0 | Passed. |
| `npm run test:mcp:renderer` | 0 | All nine pinned-runtime cases passed. |
| `npm run test:container` | 0 | All 13 self-hosted image cases passed. |
| `npm run build:hosted` | 0 | All selected groups passed: 3,969 backend unit, 23 portal unit, 13 build, 18 portal acceptance, 665 integration, 146 hosted acceptance/interface, and nine renderer cases. |
| `habit-hooks --branch origin/main` | 1 | The 73 retained findings are explained below. No lint errors. |
| `git diff --check` | 0 | No whitespace findings. |

All completed test runs above had zero cancelled, skipped, or todo cases.
The ordinary suite is still a failed gate: two public search specifications
need the SEARCH-05 registration, and three logger cases need the unset
`AXIOM_API_KEY`. No case was skipped, weakened, or changed to expect failure.
The pull request stays Draft.

The runtime command set `LIGHTPANDA_BIN` to
`/Users/tomermayara/git/Thermus/.cache/lightpanda/1.0.0/lightpanda`.
Its SHA-256 was
`955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d`.
This is the existing fetch runtime gate. It does not replace the public
search runtime and real-Brave proof required in SEARCH-06.

## Habit-hooks review

The complete-candidate run found one duplicate import, which was corrected.
The next run had no lint errors and retained 69 comment lines and four file
size findings. The snooze file stays `[]`.

| File and comment lines | Reason to retain |
| --- | --- |
| `.habit-hooks/eslint.config.mjs`: 60–61 | The two lines explain why container entry paths and the boundary specification must agree. |
| `src/application.ts`: 13–14, 27–28, 40–41, 52, 54, 70, 81, 114, 135, 145, 206 | These state the server-only environment boundary, unauthenticated browser-route order, provider resource ownership, audit storage and billing choices, explicit edition selection, rules-before-storage order, public route restriction, deferred provider loading, and early drain-failure observation. Those constraints are not all visible in type names. |
| `src/fetch-tool.ts`: 29, 65, 76 | The lines explain application-scoped sharing, setup-warning deduplication, and why native parser errors stay in a cause. |
| `src/hosted-workos-application.ts`: 22–23, 30–31, 35, 37, 39, 43, 62–63, 106–107 | These explain provider and composition boundaries, explicit slice enrollment and signup documents, MFA evidence authority, bounded retries, fail-closed startup without a network call, and the shared grants directory. |
| `test/integration/fetch-tool-renderer-setup-report.test.ts`: 17, 27 | The comments explain DNS-free address selection and the different synchronous and asynchronous process launch failures. |
| `test/interface/page-fetch/pipeline-step-types.ts`: 9, 12, 14, 17, 31 | These five `@ts-expect-error` directives are executable negative type checks. |
| `test/support/hosted-live/local-https-site.ts`: 26, 44, 46, 48, 50, 53–54, 58–59, 63, 72, 86, 95, 103 | The comments specify certificate file effects, option defaults, static-front and production-front differences, logger ownership, listener address, cleanup order, failed-start ownership, and early drain-error observation. |
| `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts`: 1–5, 45–48, 67, 90 | These identify the manual entry point and launcher, explain its test import guard and deliberate composition differences, and record logging cleanup and root-origin requirements. |
| `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts`: 1–4, 27–28 | These identify the manual slice and launcher, its test import guard, and why its provider and logging composition cannot be used in production. |

Retain the four size findings: the lint config keeps ordered boundary rules
together; `application.ts` keeps edition composition, routing, and resource
ownership visible; the protected-search specification keeps one operation
contract and its matrices together; the fetch outgoing specification keeps
its stage and shared record contract together. A split only to meet the line
limit would not separate a new responsibility. The source change in
`application.ts` is limited to selecting the new operation factory.
