# MCP-PIPE-01: protected neutral page fetch

Status: implementation in progress; candidate checks pending.
Implementation baseline: `8d12c1e7`. Draft PR: [#155](https://github.com/tomer-mayara/Thermus/pull/155).

The [reviewed plan](mcp-pipelines-plan.md#appendix-a-implementation-tickets)
defines this slice. The historical design review used `41373e82`; that is not
the implementation baseline. Characterization, focused checks, the final hosted
build, full acceptance, self-hosted container, and AST review are recorded below.
The hosted image gate remains pending; the candidate is not marked complete or Ready.

## Scope and ownership

Extract the protected fetch use case into `src/page-fetch/`. `createFetchPage`
uses the public auth and fetch contracts. It checks cancellation, requires
`product:access`, and validates the original URL before fetching. Direct callers
retain these checks. The result is released Markdown in a typed record.

The MCP schema and the protected use case share the neutral semantic URL rules.
SDK schema conversion stays in `src/mcp/`. The thin `createGetURLAsMarkdown`
adapter projects the released result to the existing string-returning operation.

`PageProcessor` is a small core-owned contract. The cleaner-owned
`HtmlPageProcessor` implements it with the existing HTML pipeline. It checks
the 10 MiB UTF-8 limit before any cleaner/parser and requires string Markdown.
The ad cleaner, hidden-content sanitizer, and Defuddle keep their order and
algorithms. Each cleaner stage runs once; the sanitizer can still scan repeatedly.

Both editions use this composition. Renderer launch/readiness reports retain
their safe fields, cancellation priority, reporter-failure isolation, and setup
deduplication. The hosted slot still covers the full operation through cleanup.

The import guard protects the core from transport, provider, composition,
concrete renderer/network, cleaner, and logger dependencies, including type-only
imports. Public auth/fetch contracts and fetcher error types remain permitted.

## Preserved public behavior

- Tool name/schema and modern/legacy protocol behavior remain unchanged.
- Requested URL spelling, final-URL link resolution, and exact Markdown remain.
- Empty source, complete removal, and sanitizer withholding still return exact
  empty MCP success. No warning text determines a new release decision.
- Invalid input, denied access, fetch/processing errors, and cancellation keep
  their fixed public results without raw causes or partial content.
- Completion records retain their current best-effort behavior and fields.
  URL paths and verbatim reasons can contain sensitive text.

This slice adds no pipeline-step decisions, operation IDs, step records, typed
withholding, outgoing tenant policy/redaction, hashes, or cache. The processor
port is transitional: MCP-PIPE-04 converts the same cleaner adapter to the
incoming standard step and removes that port.

README now distinguishes current renderer-based MCP behavior from planned
policy/redaction/hash/cache features. Thermus covers only calls sent through it.

## Verification record

The following runs cover the baseline and the extraction before AST refactoring.
The failed import-guard runs are intentional red tests: forbidden imports were
accepted before the rule changed. No artificial red is claimed for unchanged
fetch behavior. Every run below reported zero cancelled, skipped, and todo tests.

| Run and local log under `.cache/mcp-pipe-01/` | Exit | Tests | Suites | Pass | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before extraction: `characterization.log` | 0 | 165 | 5 | 165 | 0 |
| Initial guard red: `import-guard-red.log` | 1 | 8 | 1 | 4 | 4 |
| Initial guard green: `import-guard-green.log` | 0 | 8 | 1 | 8 | 0 |
| Added boundary examples red: `import-guard-expanded-red.log` | 1 | 8 | 1 | 4 | 4 |
| Focused extraction checks, including final guard: `focused-green.log` | 0 | 215 | 6 | 215 | 0 |

### Commands for recorded runs

Before extraction, `pnpm run build` exited 0, then this command produced the
165-test characterization result. These paths record the tests before their moves:

```sh
pnpm exec node --test \
  dist/test/unit/mcp/fetch-tool-schema.test.js \
  dist/test/unit/mcp/single-fetch-operation.test.js \
  dist/test/integration/mcp/get-url-as-markdown.test.js \
  dist/test/integration/mcp/get-url-as-markdown-pipeline.test.js \
  dist/test/integration/mcp/get-url-as-markdown-mcp.test.js \
  dist/test/integration/mcp/renderer-setup-report.test.js \
  dist/test/acceptance/mcp/http-fetch.test.js \
  dist/test/acceptance/mcp/http-fetch-cancellation.test.js \
  dist/test/acceptance/mcp/http-fetch-refusals.test.js \
  dist/test/acceptance/mcp/http-request-isolation.test.js \
  dist/test/acceptance/mcp/http-shutdown.test.js \
  dist/test/acceptance/mcp/http-renderer-shutdown.test.js \
  dist/test/acceptance/mcp/hosted-fetch-tool.test.js \
  dist/test/acceptance/mcp/self-hosted-fetch-tool.test.js \
  dist/test/acceptance/mcp/renderer-setup-report.test.js
```

Both red guard runs used the first command below. Initial green reused the
same emitted tests with the corrected ESLint configuration and used the second:

```sh
pnpm run build && pnpm exec node --test dist/test/acceptance/architecture/page-fetch-boundaries.test.js
pnpm exec node --test dist/test/acceptance/architecture/page-fetch-boundaries.test.js
```

The focused extraction command exited 0 and passed 215 tests. It covers the
new processor unit tests, moved integration tests, real cleaner collaboration,
both MCP protocol eras, both editions, cancellation, and the final import guard:

```sh
pnpm run build && pnpm exec node --test \
  dist/test/acceptance/architecture/page-fetch-boundaries.test.js \
  dist/test/unit/html-cleaner-pipeline/html-page-processor.test.js \
  dist/test/unit/mcp/single-fetch-operation.test.js \
  dist/test/integration/page-fetch/fetch-page.test.js \
  dist/test/integration/mcp/fetch-tool-schema.test.js \
  dist/test/integration/mcp/fetch-tool-server.test.js \
  dist/test/integration/mcp/tool-completion-record.test.js \
  dist/test/integration/mcp/get-url-as-markdown-pipeline.test.js \
  dist/test/integration/mcp/get-url-as-markdown-mcp.test.js \
  dist/test/integration/mcp/renderer-setup-report.test.js \
  dist/test/acceptance/mcp/http-fetch.test.js \
  dist/test/acceptance/mcp/http-fetch-cancellation.test.js \
  dist/test/acceptance/mcp/http-fetch-refusals.test.js \
  dist/test/acceptance/mcp/http-request-isolation.test.js \
  dist/test/acceptance/mcp/http-shutdown.test.js \
  dist/test/acceptance/mcp/http-renderer-shutdown.test.js \
  dist/test/acceptance/mcp/http-dns-cancellation.test.js \
  dist/test/acceptance/mcp/hosted-fetch-tool.test.js \
  dist/test/acceptance/mcp/self-hosted-fetch-tool.test.js \
  dist/test/acceptance/mcp/renderer-setup-report.test.js
```

### AST measurement and retained findings

Three measurement/inspection passes are complete. Each measurement used
`pnpm exec node script/ast-metrics-delta.ts --no-compare` and exited 1: six of
eight measured production files remained below 85. Each pass inspected all six
files with `pnpm exec node script/ast-metrics-mcp.ts file <path>`; all 18 calls
exited 0. Scores were unchanged across the passes. The two unused type exports
`FetchPageOutcome` and `RendererReadinessTimeout` became private after pass 2.

The optional HTML comparison failed with `Cannot compare code with branch or
commit origin/main`; measurement continued with `--no-compare`. This does not
claim a successful HTML comparison. No more measurement/refactor passes are
planned. The rules and `.ast-metrics-baseline.yaml` remain unchanged.

| Production file | File score | Reason retained after three passes |
| --- | ---: | --- |
| `src/page-fetch/fetch-page.ts` | 54.2 | The returned operation is 24 lines with 4 paths. It preserves cancellation → permission → URL → fetch → cancellation → processor → cancellation → release. Its two catches need distinct fixed messages and report rules. Generic wrappers, async helpers, or mutable phase flags would hide that order. The shared cancellation helper is already 5 lines with 4 paths. |
| `src/mcp/tool-completion-record.ts` | 56.6 | Only imports changed. Its unchanged projection has 13 paths across 3 functions, maximum 6. URL/reason projection changes belong in the record ticket, not this extraction. |
| `src/page-fetch/fetch-url.ts` | 60.4 | The 10-line validator has 7 paths for bounded input, authority/forbidden characters, parsing, and hostname checks. Its 8-line bounded loop stops at 8,193 code points without an unbounded allocation. Tiny predicates or sharing a second loop would add indirection. |
| `src/mcp/fetch-tool-schema.ts` | 60.6 | Improved from 54.7. The 10-line `fieldStatus` has 6 paths for five distinct logging states and bounded length; parsing is 5 lines with 3 paths. Each function owns one contract. |
| `src/html-cleaner-pipeline/html-page-processor.ts` | 73.9 | The initial review reports class maintainability 73, severity high. Keep the adapter: its method is 6 lines with 2 paths and its constructor is 1 line. The size guard, one pipeline call, and required Markdown check belong together; more layers or mechanical splits would weaken clarity. |
| `src/fetch-tool.ts` | 81.4 | The initial review reports 15 dependencies, severity low. The composition root must select the real fetcher, cleaner, neutral operation, MCP adapter, and reporters. Keep that explicit selection and existing lifetime ownership together. |

No new production function has more than 10 paths. These are documented
residual reasons, not a claim that the 85 goal or high finding passed.

The final `pnpm exec node script/ast-metrics-review.ts` exited 1. Its local log
is `.cache/mcp-pipe-01/ast-review-final.log`; `ast-report/review.md` contains the
exact Markdown for the PR description. The final report retains the adapter's
class score 73/high finding and composition's 15-dependency/low finding. The
reasons in the table above apply to both. Improvements are schema 55 → 61 and
the thin MCP adapter 67 → 87. The review is complete with justified retained
findings; its process exit remains 1 and is not recorded as a green gate.
The manager will include the full review Markdown and reasons in the PR.

### Final hosted build and renderer

This final stable-source command exited 0 after the two type-export fixes:

```sh
LIGHTPANDA_BIN=/Users/tomermayara/git/Thermus/.cache/lightpanda/1.0.0/lightpanda pnpm run build:hosted
```

Local log: `.cache/mcp-pipe-01/build-hosted-final.log`. The phases ran in this
order. Every test passed; every phase reported zero failed, cancelled, skipped,
and todo tests. Typechecks, backend build, and portal build also exited 0.

| Phase | Tests | Suites | Passed |
| --- | ---: | ---: | ---: |
| Check: backend unit | 2,722 | 194 | 2,722 |
| Check: portal unit | 19 | 0 | 19 |
| Check: build proofs | 13 | 0 | 13 |
| Check: portal acceptance | 16 | 0 | 16 |
| Complete integration | 518 | 44 | 518 |
| Hosted offline selection | 128 | 17 | 128 |
| Real renderer | 9 | 1 | 9 |

This final run supplies the full check, complete integration, hosted offline
build, and renderer proofs. The renderer phase is recorded separately, as the
policy requires; a duplicate standalone renderer run is not needed. An earlier
hosted-build pass preceded the type-export cleanup; this final run is authoritative.

### Full acceptance suite

`pnpm run test:acceptance` exited 0. Local log:
`.cache/mcp-pipe-01/acceptance-final.log`.

| Phase | Tests | Suites | Passed |
| --- | ---: | ---: | ---: |
| Backend acceptance | 461 | 47 | 461 |
| Portal acceptance | 16 | 0 | 16 |

Both phases reported zero failed, cancelled, skipped, and todo tests. A wrapper
supplied only the required Axiom test settings from the main checkout's local
environment file to the child process. No credential value was written to docs
or printed. The designated dataset was `system-log-test`; these are acceptance
results, not a substitute for either container gate.

### Container gates

`pnpm run test:container` exited 0. The local log
`.cache/mcp-pipe-01/container-final.log` reports 13 tests, 1 suite, and 13 passes;
failed, cancelled, skipped, and todo counts are all zero. This proves the packaged
renderer/MCP flow, production network guards, offline auth/persistence/admin
commands, backup/restore, image contents, and wrong-renderer-digest build refusal.

The first `pnpm run test:container:hosted` attempt under the original QEMU7
configuration exited 1. `.cache/mcp-pipe-01/container-hosted-final.log` reports
1 test, 0 suites, 0 passes, 1 failure, and zero cancelled/skipped/todo tests.
The image's offline build stopped at `tsc --noEmit` with SIGSEGV/exit 139 before
its inner test suites. The [RHD-03 record](rhd-03.md) describes similar QEMU failures;
this attempt is not a hosted image pass.

For the same unchanged code, rules, tests, and dependencies, the manager saved
all three VM config files, binfmt records, and resource settings, then temporarily
selected bundled Rosetta with 2 CPUs, 4 GiB, and `LIMA_SSH_PORT_FORWARDER=true`.
The exact hosted gate is running again; its log is
`.cache/mcp-pipe-01/container-hosted-rosetta.log`. The compiler passed and offline
unit tests started, but the gate has no final result yet. Managed cleanup is
set to restore and verify the saved configuration and stop the VM to its prior
state. Restoration and VM-stop verification are also pending.

### Habit-hooks findings

The final `habit-hooks` run in `.cache/mcp-pipe-01/habit-hooks-final.log`
exited 1. Two new unused type-export findings were corrected as noted above.
The following findings remain with reasons; this gate is not recorded as green.
`.habit-hooks/snooze.json` remains `[]`.

- Four pre-existing CLI exports remain: `readyToken` and
  `discoverHostedAuthorization` in `script/fetch-url/oauth.mjs`, plus
  `callbackResult` and `launchBrowser` in `script/fetch-url/browser.mjs`.
  Their test-facing CLI boundaries need a separate CLI/test refactor; this
  extraction does not alter those modules or silence their findings.
- Ten comment findings remain. The two comments at
  `.habit-hooks/eslint.config.mjs:54–55` explain the standalone-container import
  rule and its test proof. `src/fetch-tool.ts:17–19,40,51` explains startup/shared
  lifetime, setup-report deduplication, and why native parser causes stay private.
  `src/page-fetch/renderer-failure-reports.ts:11,21` explains the report privacy
  boundary and why reporter failure cannot change a result.
  `test/acceptance/mcp/http-shutdown.test.ts:152` explains why the token seam
  holds only the tool call. These comments preserve non-obvious safety,
  lifecycle, and test-boundary reasons.
- `test/acceptance/mcp/http-request-isolation.test.ts` remains above 200 lines.
  It keeps one cohesive acceptance concern: independent overlapping requests.
  Only factory wiring changed. A size-driven split would add unrelated test
  restructuring to this slice without improving the extraction.

### Remaining evidence

The hosted image gate and VM restoration verification remain pending.
The manager will add their results and the final
candidate revision. The retained habit-hooks and AST findings above remain
explicit; neither nonzero command is presented as a pass.

Use the [test gate policy](test-gate-policy.md) for focused/suite commands and
prerequisites. A complete passing renderer phase of `build:hosted` can supply
that proof without a duplicate renderer run. Use the
[AST review guide](ast-metrics-review.md) and current
[AGENTS.md process](../../AGENTS.md#code-quality-review-with-ast-metrics)
before Ready. Keep the AST baseline unchanged in this slice. Any justified
residual scores and the review Markdown belong in the PR description.
