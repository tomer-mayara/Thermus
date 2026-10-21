# Search MCP cancellation during failure inspection

Date: 2026-10-20 (America/Denver).
Status: implemented; selected test and build gates passed; final quality report is recorded in PR 202.

This follow-up fixes the factory cancellation edge found in the final review
of [PR 202](https://github.com/tomer-mayara/Thermus/pull/202). The source and
test commit is `a8ab7753`. The fetched review base is
`063404050aaf2d8989039309afc96d0308f7b318`, the comparison base.

## Behavior and correction

An injected search operation can throw an error whose getter aborts the
request. The MCP failure mapper checked the signal before it read that
getter, then returned a search or processing failure. This gave the wrong
public error and completion status. The production `SearchPipeline` already
handled cancellation during its own error inspection.

`safeSearchFailure` now keeps the safe classification in a local value and
checks the signal again after inspection. An aborted signal gives
`Request cancelled` and completion status `cancelled`. This final check also
runs after a getter throws. Existing typed and fixed search errors keep their
messages when the signal is not aborted. Fetch behavior is unchanged.

The change uses the existing failure boundary. It adds no helper, class,
dependency, retry, or new error type. The manager reviewed and signed off
the worker's change and regression tests.

## Test-first evidence

Four Given-When-Then cases use the existing public factory and MCP client in
`test/integration/mcp/fetch-tool-server.test.ts`. They cover the allowlisted,
typed, unknown, and throwing-inspection paths. Each checks the cancellation
result, one operation call, one correlated completion with status `cancelled`,
and exclusion of private query, reason, and error text.

The four cases failed before the source fix: zero passed and four failed.
The allowlisted and typed cases returned `Search failed`. The unknown and
throwing cases returned `Search processing failed`. After the fix, all four
passed. The complete dispatcher test file passed all 47 tests. Each run had
zero cancellations, skips, or todo cases.

```sh
pnpm install --frozen-lockfile
pnpm exec npm run build
pnpm exec node --test --test-name-pattern='search error with a cancelling' \
  dist/test/integration/mcp/fetch-tool-server.test.js
pnpm exec node --test dist/test/integration/mcp/fetch-tool-server.test.js
```

Node was `v24.20.0`. The install and both builds passed. The regression command
ran before and after the fix. Logs use `/tmp/thermus-cancel-edge-` with
`install.log`, `red-build.log`, `red.log`, `green-build.log`,
`green-regression.log`, and `green-focused.log`.

## Complete-candidate verification

The source change selects the ordinary suite, typecheck, build tests, portal
build, pinned renderer, self-hosted container, hosted offline build, and
Linux AMD64 hosted image gate. Both complete unit parts and integration are
selected, so fresh coverage includes those groups. Run habit-hooks and the
full ast-metrics process against the same base.

The complete pull request also changes the live assertion, so select one
separate live Brave proof on the corrected MCP candidate. Keep the earlier
dated proof in [SEARCH-09](search-09.md#dated-live-mcp-proof). Hosted identity,
signup creation, organization operations, and SDK retries are unchanged, so
their dedicated live gates are not selected.

The commands ran in sequence with Node 24.20.0. The renderer path was
`/Users/tomermayara/git/Thermus/.cache/lightpanda/1.0.0/lightpanda`.
The ordinary suite used the existing launcher for the Axiom test dataset;
no credential is included in this record.

| Check | Result |
| --- | --- |
| `npm test` | The unchanged retry passed 5,828 backend tests and 41 portal tests. No failure, cancellation, skip, or todo. |
| `npm run typecheck` | Passed. |
| `npm run test:build` | 13 passed. |
| `npm run build:user-portal` | Passed. |
| `npm run test:mcp:renderer` | 13 passed. |
| `npm run test:container` | 13 passed. |
| `npm run build:hosted` | All seven phases passed: 4,029 backend unit, 23 portal unit, 13 build-output, 18 portal acceptance, 707 integration, 194 selected acceptance/interface, and 13 renderer tests. |
| `npm run test:container:hosted` | The unchanged retry passed all 9 tests after the first run timed out. See the retained history below. |
| `ast-metrics-coverage.ts --suite unit --suite integration` | Passed: 4,029 backend unit, 23 portal unit, and 707 integration tests; 134 files from 1,158 captured processes. The report is not edited. |
| Focused `script-readme.test.js` on the final documents | 18 passed after a clean build. |
| `npm run test:mcp:search:live` | One test passed on the first call of this follow-up at 2026-10-21 04:37:49 UTC. |

Commands in the table used `pnpm exec`. The coverage command also used
`node script/code-quality/ast-metrics-coverage.ts`. The focused document
contract used a clean build first. Logs have prefix
`/tmp/thermus-cancel-edge-` and suffixes `ordinary.log`,
`ordinary-retry.log`, `typecheck.log`, `test-build.log`, `portal-build.log`,
`renderer.log`, `container.log`, `hosted-build.log`, `hosted-image.log`,
`hosted-image-retry.log`, `coverage.log`, `docs-test.log`, and `live.log`.
Earlier records retain their original inputs and results.

### Retained failed runs

The first ordinary suite reported 5,828 tests: 5,823 passed, three failed,
and two were cancelled. The existing backfill-help and trend-gap cases hit
20-second deadlines. The existing OAuth browser-cancel case returned an
authorization timeout. The existing hung-initialize and hung-tool-call cases
observed zero aborted requests instead of one. These four test files are
unchanged against the review base. A sequential isolation run of those files
and the document contract passed 92 of 93 tests; only the OAuth case still
failed. Its fixture shares a 150-millisecond deadline across preparation and
cancellation. No assertion or deadline was changed.

The final unchanged ordinary command then passed all 5,828 backend tests
and 41 portal tests. The earlier failures remain evidence of those runs;
their underlying timing cause was not established.

The first hosted image command passed all seven runtime subcases but reached
its one-hour parent deadline during the copied build with the deliberate
failure. Its final result was seven passed and two cancelled. The positive
Linux AMD64 image had already completed all seven build-check phases,
including 4,029 passing backend unit tests and all four new MCP regressions.

The unchanged retry reused those verified build layers and passed all nine
gate tests. The copied build reported the deliberate failing test and two
existing coverage-propagation tests with `spawnSync ETIMEDOUT` at 15 seconds.
It therefore reported 3,990 passed and three failed out of 3,993 tests. The
gate confirmed the deliberate failure and that no runtime image was created;
this result is not a clean unit-suite pass for that copied context. The
successful positive image and the standalone coverage run have their own
results above. The first copied build also reported a deployment-fixture
failure before cancellation; that case passed in the retry. There was no
change to Docker, emulation, tests, or time limits.

### Dated live MCP proof

The one live command passed at `2026-10-21T04:37:49.206Z` with Lightpanda
1.0.0 and query `Lightpanda browser`. It used real Brave HTTP, the production
composition, a real local Better Auth access token, and an MCP client. The
assertion found an external result with a description in the same paragraph
or the next paragraph. Both stage records were allowed and joined one
successful completion; there was no renderer error.

The complete diagnostic is saved in
[the live result](search-mcp-cancellation-live-result.json), SHA-256
`191f56349625295caca865b47ef57076e7f7de9b89afe57b9ba141c820bf9bcc`.
It preserves the full MCP result and the correlated records. Earlier live records are unchanged. This dated call does
not prove sustained access, every query or page layout, a live hosted search,
or a live empty-results response. No public request was retried to get a pass.

### Quality review and pull request

The same review base is used for the complete-candidate habit-hooks and
ast-metrics process. Direct inspection of `src/mcp/fetch-tool-server.ts`
reports maintainability 45.7 and 34 decision paths across seven functions.
`safeSearchFailure` has ten paths. The final signal check adds one path and
keeps all classification exits inside the same failure boundary. A separate
helper would add an abstraction without removing that requirement.

The dispatcher retains its file-score exception. The pull request description
contains the final complete process report and the reasons for each retained
habit-hooks, maintainability, high-review, and unknown function assessment.
A recorded exception is not a passing score. Rules, baseline, coverage data,
and historical metric records are not edited. The final process uses the
verified analyzer correction documented in [SEARCH-02](search-02.md).

The pull request can return to Ready after the final quality report and
its exceptions are recorded. Owner review and merge remain separate.
