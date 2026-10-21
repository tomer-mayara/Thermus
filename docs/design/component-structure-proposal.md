# Component structure proposal

Date: 2026-10-21. Source snapshot: `af6b9e22`.

Status: Phase 1 is complete. This document keeps the migration plan and reviewed
move map as history. Use the [current component registry](../../architecture/components.md)
for the current system.

Phase 1 implements the reviewed component layout, the three repairs, and the
associated guards, test classification, and resource-path updates. The source
map below retains the reviewed before/after paths as migration evidence.
Dependency-cruiser remains an optional separate diagnostic: its disposable
pilot does not constitute permanent tool adoption. Verification and review-route
evidence for this change belongs in the pull request.

## Decisions and review corrections

Group code by the knowledge, rules, and resources it owns, following the
[coding principles](../coding-principles.md). Keep filenames, exported names,
documented contracts, observable behavior, and `src/index.ts` unchanged during
structural moves. Grouping directories are not logical packages.

The current plan has one server-web component for account routes, browser auth,
and shared HTML/forms. Its account and provider-specific auth folders are
private implementation areas. Hidden terminal input is private app support.
Execution remains a separate component; page fetch, search, HTML processing, and
their providers retain distinct boundaries. There is no generic pipeline engine,
new barrel, module marker, or mandatory form-reader extraction.

The review found these concrete gaps, addressed below:

- The [high-severity layer guard](../../script/code-quality/review/layers.ts)
  still uses old paths and must remain active through the moves.
- The plan did not preserve the distinct inputs of the
  [committed-Git candidate](../../script/pr-review/git-reads.ts) and
  [dependency-free baseline snapshots](../../script/code-quality/snapshot/base.ts).
- Portal compiler settings were confused with execution context:
  [Vite configuration](../../src/interfaces/user-portal/vite.config.ts) runs in Node.
- [HTML depth](../reference/html-processing-limits.md) and
  [renderer network](../reference/renderer-network-policy.md) contracts were
  left subject to an undefined privacy decision; their exports must remain.
- Shared lifetimes in [tool composition](../../src/app/fetch-tool.ts) were
  underspecified and must remain shared at their existing scope.
- Nested test folders conflicted with fixture rules, while the execution split
  changes [executor test](../../test/integration/page-fetch/execute-incoming-step.test.ts)
  classification. Keep flat folders and preserve cases through public interfaces.

The mergers of server-web code and terminal support are simplifications. They
remove unnecessary boundaries without changing browser protections or resource
ownership. The two account type repairs and HTML import repair remain necessary.

Folder migration uses the current graph and check implementations. Keep
dependency-cruiser as the preferred, separately scoped optional working-tree
diagnostic first. Do not replace the committed-Git PR candidate analysis or the
dependency-free metrics baseline scans. Such a replacement needs a separate,
proved adapter. Tool adoption is not a prerequisite for folder moves.

## Target tree and public boundaries

```text
src/
  index.ts                         stable app entrypoint
  app/                             composition, lifetimes, private input support
  accounts/                        grouping directory
    identity/
    organizations/
    billing/
    providers/                     grouping directory
      workos/
      better-auth/
  interfaces/                      grouping directory
    mcp/
    web/                           one server-web owner
      account/                     private routes, forms, pages, styles
      auth/workos/                 private browser adapter
      auth/better-auth/            private browser adapter
      page-html.ts
      html-escape.ts
    cli/
    user-portal/                   browser build, Vite config, declarations, assets
  pipelines/                       grouping directory
    execution/
    page-fetch/
    search/
    html-processing/
      ad-cleaner/adb/              private except named public entries below
      html-to-markdown/            private transformer implementation
      prompt-injection-remover/   private transformer implementation
      search-results/             private transformer implementation
    providers/                     grouping directory
      website-fetcher/
      search-engine/
  logging/
  runtime/                         grouping directory
    http/
    config/
```

The following IDs are stable and contain no slash. Roots are separate metadata.
This snapshot projects to 19 owners; the count is a result, not a permanent gate.
The source map at the end gives every current file one destination.

| ID and root | Responsibility | Public boundary and construction access |
| --- | --- | --- |
| `app` — `src/app/`, plus exactly `src/index.ts` | Select editions and concrete providers/transformers, assemble routes/tools, own startup, shutdown, shared capacity, portal loading, renderer startup checks, and command input lifetime. | Preserve entrypoint serve/signal exports, `application.ts` construction/lifecycle roles, and documented `fetch-tool.ts` exports. Other app files, including `operation-capacity.ts` and `hidden-line-input.ts`, are private support. No lower owner imports app. |
| `identity` — `src/accounts/identity/` | Own identity/access records, immutable request contexts, permission checks/denials, token and browser-session roles, and neutral local-administration/lifetime contracts. | `access-context.ts`, `identity-verifier.ts`, `browser-session.ts`, and `local-user-administration.ts`. No provider, UI, organization implementation, or deployment parser import. |
| `organizations` — `src/accounts/organizations/` | Own customer roles, administration, directory contracts, member/invitation overviews, seat calculations, and privileged change-record behavior. | `organization-directory.ts`, `organization-administration.ts`, `administration-overviews.ts`, `customer-roles.ts`, and `change-records.ts`. `directory-reads.ts` stays private. Public `ChangeRecording` remains available to its permitted callers. |
| `billing` — `src/accounts/billing/` | Report the current free-plan state and accept seat updates. | `billing.ts` roles; app selects `BillingFree` from `billing-free.ts`. No paid provider is implemented. |
| `workos` — `src/accounts/providers/workos/` | Implement identity/access verification, sessions, organization operations, existing signup/onboarding, provider settings, cookies, and document validation. | App constructs the existing provider classes and SDK client. Only `web/auth/workos/` gets the named session/signup role types, `sameSecret`, and `validateSignupDocuments`; see the file-context rules below. Other provider mechanics stay private. |
| `better-auth` — `src/accounts/providers/better-auth/` | Implement local identity/access and account administration; own provider runtime, installation, storage lock, and cleanup. | App uses `BetterAuthProvider`, `openBetterAuthRuntime`, and `openBetterAuthAdministration` through their existing modules. Installation/lock internals are private. |
| `mcp` — `src/interfaces/mcp/` | Adapt MCP requests to supplied identity/access and tool-operation roles; own schemas, protocol failures, metadata, request lifetimes, and completion presentation. | Existing composition entries `mcp-server.ts`, `fetch-tool-server.ts`, `get-url-as-markdown.ts`, `search.ts`, `protected-resource-endpoint.ts`, and client-visible schema modules. SDK-adapter internals stay private. Capacity moves to app. |
| `web` — `src/interfaces/web/` | Serve account/admin/selection, portal-access, sign-in/out, signup, consent, and browser-session flows; own their forms, pages, HTML, and request protections. | App composes `account/account-routes.ts`, `account/portal-access.ts`, `auth/workos/workos-session-routes.ts`, `auth/workos/workos-signup-routes.ts`, and `auth/better-auth/local-auth-pages.ts`. Other routes/forms/pages/helpers stay within this owner. Keep existing form reader and account parsers together; no new `form-body.ts`. |
| `cli` — `src/interfaces/cli/` | Parse local user/client commands, request hidden input through a supplied role, invoke supplied administration, and format output/exit codes. | `local-auth-command.ts` command entry/context roles. `local-auth-command-line.ts` is private. App opens the provider and owns hidden-input cleanup. |
| `user-portal` — `src/interfaces/user-portal/` | Build browser portal behavior, instructions, styles, static assets, and Vite tooling. | Existing browser HTTP interactions and rendered output. Preserve build root, assets, font license, and URLs. Browser runtime modules have narrower permissions than Vite tooling and declarations. |
| `execution` — `src/pipelines/execution/` | Share existing operation context, step/results, records, and pass-through observation. Validate operation IDs and write bounded best-effort records. | `execution-context.ts`, `pipeline-step.ts`, and `step-record.ts` contracts/helpers. Only app constructs `ObserveRequestStep` from `observe-request-step.ts`. These are four moved files, not a new framework. |
| `page-fetch` — `src/pipelines/page-fetch/` | Check product access and URL input, run outgoing/fetch/incoming work, and preserve cancellation, withholding, and safe failure behavior. | `fetch-page.ts` (`createFetchPage`, `FetchPage`, outcome), `fetch-url.ts`, and `fetch-failure.ts`. Executors stay private. |
| `search` — `src/pipelines/search/` | Check access/query, call the supplied engine, process its document, and preserve cancellation, no-results, withholding, and safe failures. | `search-pipeline.ts`, `search-query.ts`, and `search-failure.ts`. Executors/cancellation helper stay private. |
| `html-processing` — `src/pipelines/html-processing/` | Enforce input limits and run ad removal, hidden-content/control sanitation, search projection, and Markdown conversion. | Preserve `ProcessHtmlStep`, the documented `html-to-markdown-pipeline.ts` runner/contracts, and public `ad-cleaner/html-depth-limit-error.ts` exports. Preserve documented construction from `ad-cleaner/adb/clean-html-ads-adblock-rs.ts`. App also selects `PromptInjectionRemoverSanitizer`, `BraveHTTPResultCleanup`, and `CleanHtmlToMarkdownDefuddle` from their existing modules. Other transformer files stay private. |
| `website-fetcher` — `src/pipelines/providers/website-fetcher/` | Render pages, enforce destination/process policies, and own safe renderer diagnostics/reporting. | Preserve `website-fetcher.ts` role, `WebsiteFetchResult`, failures, documented `network-policy.ts`, and moved `renderer-failure-reports.ts`. App selects `WebsiteFetcherLightpanda`; result/diagnostic internals stay private. |
| `search-engine` — `src/pipelines/providers/search-engine/` | Build Brave requests, enforce search-origin rules, and return documents through a supplied fetcher. | `search-engine.ts` role/document contract; app selects `SearchEngineBraveHttp`. |
| `logging` — `src/logging/` | Format and emit operator logs. | Existing `BaseLogger`, `LogLevel`, `ConsoleLogger`, and `OtelLogger` modules. Privileged change records currently go to the operator log; there is no durable audit store. |
| `http` — `src/runtime/http/` | Own the Node listener, exchange conversion, trusted client address, cancellation, and listener drain. | `server.ts` for app; `request-cancellation.ts` and `client-address.ts` for their permitted consumers. `fetch-exchange.ts` stays private. |
| `config` — `src/runtime/config/` | Validate deployment/listen settings and read the trusted ad-rules file. | `deployment-config.ts` and `ad-rules-file.ts`. Provider-specific settings stay with providers. Preserve the existing external MCP metadata-URL helper dependency. |

Keep named file imports and existing documented exports; do not introduce a
barrel or withdraw an API as part of a move. Documented construction access is
an explicit exception, not permission to import every transformer/helper.
Update current contract documents to their new paths in the same change.

## Allowed dependencies and file-context rules

An edge points from importer to imported owner. Runtime permission includes
imports of its public types; the last column adds type-only edges. Type-only
means whole `import type`/`export type` statements or TypeScript import types.
All imports in declaration files are type-only.
An inline `import { type X }` can still load the module under the current
compiler options. Calls through an injected role do not require runtime imports
of its implementation. The public module restrictions above still apply.

| Owner | Allowed runtime owners | Additional type-only owners |
| --- | --- | --- |
| `app` | `better-auth`, `billing`, `cli`, `config`, `execution`, `html-processing`, `http`, `logging`, `mcp`, `organizations`, `page-fetch`, `search`, `search-engine`, `web`, `website-fetcher`, `workos` | `identity` |
| `identity` | None | None |
| `organizations` | None | `identity`, `billing` |
| `billing` | None | None |
| `workos` | `identity`, `organizations` (public seat/change-record behavior) | `billing` |
| `better-auth` | `identity`, `http` (trusted client-address constant) | None |
| `mcp` | `identity`, `http`, `page-fetch`, `search` | `execution` |
| `web` | `identity`, `http`, `workos` (only the auth file contexts below) | `organizations`, `billing` |
| `cli` | `config` | `identity` |
| `user-portal` | None | None |
| `execution` | None | `website-fetcher` (`WebsiteFetchResult`) |
| `page-fetch` | `identity`, `execution`, `website-fetcher` | None |
| `search` | `identity`, `execution`, `website-fetcher` | `search-engine` |
| `html-processing` | None | `execution`, `website-fetcher` |
| `website-fetcher` | None | None |
| `search-engine` | None | `website-fetcher` |
| `logging` | None | None |
| `http` | None | `config` |
| `config` | None | None |

Every unlisted internal edge is forbidden, including reverse imports to app,
interfaces, or a calling pipeline. Page fetch/search do not import each other,
HTML implementations, loggers, or transport. Providers do not import their
callers. Preserve external-package and Node builtin restrictions per owner;
do not grant a split owner every dependency of its former parent. App selects
this application's provider/transformer implementations. Permitted public
helpers, such as `ChangeRecording` inside WorkOS onboarding, remain valid.

Retain narrower file-context guards even when files share one owner:

- Only `web/auth/workos/` may import approved WorkOS session/signup role types
  from `workos-browser-session.ts`/`workos-signup.ts`, `sameSecret` from
  `session-cookies.ts`, and `validateSignupDocuments` from
  `workos-signup-documents.ts`. Account routes use supplied neutral roles.
  Forbid provider construction, SDK clients, other internal exports, and
  namespace/default-import bypasses in web consumers. The Better Auth browser
  adapter keeps its handler role inside web; app supplies the real handler.
- Portal runtime modules must not import Node builtins, server owners, provider
  SDKs, or Vite tooling. `vite.config.ts` may use its declared Node/Vite build
  dependencies; `env.d.ts` is declaration context. The pilot's compiler split
  included these files in the portal inventory and is not a browser-runtime
  security rule. New files must receive the correct execution context.

The current auth/admin and organization cycles are existing debt. A read-only
projection of the map and repairs below is acyclic, including type edges; this
is not proof from migrated code. Keep current cycle protection through each
slice and remove debt declarations only after the corresponding edges disappear.

## Required repairs and behavior to preserve

These are the only mandatory contract/import repairs. Keep them separate from
pure moves and cover their behavior/contracts before changing them.

| Repair | Required result |
| --- | --- |
| HTML runner import | Change its inline-only `WebsiteFetchResult` import to whole `import type`, so HTML processing does not load the provider module. Keep the public result contract in `website-fetcher.ts`; do not invent a generic page model. |
| Local administration lifetime role | Move `OpenedLocalAdministration` from the CLI command module to existing identity `local-user-administration.ts`. The Better Auth implementation must not import CLI, even for a type. |
| Local settings contract | Replace `LocalAuthSettings`' derivation from `DeploymentConfig` with an equivalent identity-owned record of `dataDirectory`, `publicBaseUrl`, and `mcpResourceUrl`. App/CLI pass validated values without a reverse config dependency. |

Preserve the existing `fetch-tool.ts` composition: one shared fetcher, ad cleaner,
sanitizer, outgoing observer, record sink, and report closures for both tools;
one hosted capacity slot shared by fetch and search; separate conversion
instances and fresh per-operation execution/HTML contexts. Preserve construction
order, edition-specific lazy loading, ownership, and cleanup on success,
failure, cancellation, and shutdown. Do not move operation state into shared
services or introduce new dependency injection to make tests appear isolated.

`PipelineStep.execute` returns allow/block; `HtmlTransformation.invoke` updates
HTML context; `ProcessHtmlStep` validates completed Markdown and translates
scan withholding. Keep fetch order ads → sanitizer → Markdown, and search
order ads → sanitizer → Brave projection → search-preserving Markdown. Clean
the full page before Brave projection. Preserve limits, safe errors/records,
permission checks, cancellation, and exact released/withheld outcomes.

The merged web owner keeps the existing bounded form reader, cancellation,
CSRF/Origin/return-path checks, cookies, and escaping. Keep signup/onboarding
provider-bound and billing free. Keep Better Auth's separate Response-returning
form reader; it has a different local-auth contract. No unrelated provider-neutral
workflow, audit storage, class hierarchy, or internal app-cycle refactor is required.

## Ownership and enforcement before moves

Replace the review policy's current `dependency_graph.packages` list with one
minimal declaration of stable IDs and their roots, using the table above.
Tools discover files and imports, not intended component meaning; define
ownership once without an additional machine ownership registry.
The planned `dependency_graph.components` entries hold roots and, for app,
exactly the `src/index.ts` file exception. Share one resolver across consumers;
derive tracked file inventory and imports automatically. Reject unowned or
ambiguous files. Do not use a permanent per-file registry or infer owners from
first-level grouping folders.

During a slice, permit only the temporary old/new roots and exact file overrides
needed for that move. Remove them when the move completes. A new root-level
file must not silently become app. Baseline and head use their own ownership
definitions; revisions without the new declaration use the legacy behavior.
Preserve base-policy authority. Tests must show that a rename or regrouping
cannot hide a forbidden import, private access, external-owner change, runtime
escalation, or known-cycle growth. Snapshot counts are audit facts, not fixed
future coverage targets; compare complete derived file/edge sets.

Use the current graph engines and preserve their source semantics:

| Consumer | Changes and guarantees |
| --- | --- |
| PR review | Adapt `script/pr-review/graph.ts`, `dependency-facts.ts`, `surface.ts`, and policy readers to shared ownership. Keep `git-reads.ts` committed-HEAD inputs, merge-base authority, source import classification, external/builtin normalization, public-surface facts, and cycle rules. Do not replace these with an installed working-tree scan. |
| Metrics ownership | Adapt `script/code-quality/architecture/component-name.ts` and its data/dependency/node consumers, name/trend validation, and `test/acceptance/script/fixtures/ast-metrics-live-assertions.ts`. Supply each revision's ownership, normalize legacy `src`/`composition` identity for comparisons, and retain old-record compatibility. Baseline worktrees remain dependency-free. Never rewrite `docs/metrics/`. |
| Source guards | Update `.habit-hooks/eslint.config.mjs`, auth/page-fetch/search specifications and fixtures, and the new web/portal context controls. Preserve static, type, re-export, literal dynamic, SDK, private-file, and computed/unresolved-import coverage across the combined controls. Keep old/new paths protected until replacement checks pass. |
| High-severity layer review | Update `script/code-quality/review/layers.ts` and `layer-tree.ts` use of ownership/move evidence, `review/command-line.ts` help, and affected review-policy unit/acceptance/live contracts and docs. Preserve the existing HTML→MCP and website-fetcher→auth guarantees through renamed roots and split auth contexts; these checks must not disappear with their old prefixes. |

Keep root `test/`, `script/`, `docs/`, `architecture/decisions/`, `migrations/`,
`docker/`, `tools/`, `patches/`, manifests, configs, and tooling in place. Keep
[testing roles and D1–D8](../testing/test-code-layout.md). Existing ESLint checks
D1–D7; D8 centralizes support runtime paths. These do not prove that a unit test
executes only one real component; review that property separately.

## Ordered migration and finish gates

Each slice must leave a complete, checked candidate. For a later implementation,
use a draft PR and the repository's review process.

1. Add the ownership declaration/resolver and transition tests on current paths.
   Keep the current graph/check engines. Prove legacy/base/head handling,
   importer-specific construction access, web/portal contexts, and all existing
   guard guarantees before moving code. A tool-only change selects affected
   focused checks under the test gate policy, not an unrelated full suite.
2. Establish passing characterization coverage, then make the three repairs.
   Add failing contract/acceptance specifications only for genuinely changed
   behavior; do not create a false red acceptance test for a pure refactor.
3. Move the four execution files and renderer reports, then page-fetch, search,
   provider, and HTML families in small coherent slices. Keep private executors
   private. Move writer-only cases to execution unit tests. Preserve existing
   executor/writer cases through public `createFetchPage` operation integration
   tests, rather than relabel direct private-executor tests or expose internals.
   In cancellation cases, wait for the supplied incoming step to start before
   aborting. Select incoming records by `stepId`; public fetch also records its
   outgoing step.
   Assess other affected unit groups by the new owners; use meaningful doubles,
   not new injection layers just to keep a unit label.
4. Move accounts, the single web owner, MCP, CLI, runtime, and app in small
   dependency-aware slices. Keep flat test folders; change imports/fixtures and
   selectors only as ownership requires. Keep terminal input private in app and
   `src/index.ts` stable. Update current contract paths and security/gate rules
   with each move. Do not expand public exports for test convenience.
5. Move the portal with its Vite root/config, declarations, asset/license files,
   package aliases/scripts, TypeScript includes/excludes, Docker copy/ignore
   paths, and `test/support/processes/module-paths.ts`. Update generated-path
   filtering in `script/code-quality/provenance/inputs.ts` for portal `dist/`
   and `.vite/`, so fingerprints and coverage compatibility exclude them.
   Keep served URLs and build outputs compatible. Test browser runtime versus
   Node tooling contexts.
6. Remove temporary ownership overrides, old paths, and obsolete declarations.
   Derive the final inventory and graph; compare every mapped destination and
   behavior, test classification, public contract, resource path, and guard.

For each candidate, select checks by the complete diff under the
[test gate policy](../implementation/test-gate-policy.md), including both old
and new paths, shared helper consumers, and coverage selection. Any `src/` move
requires `npm test`, `npm run typecheck`, `npm run test:build`, and
`npm run build:user-portal`, plus applicable renderer, self-hosted/hosted image,
signup, and hosted-live gates. Update their old/new path selectors before paths
disappear. Run each selected changed test before commit. Do not add
`npm run check` or bypass nested-run limits. Missing prerequisites are recorded
as deferred/unrun, never passed.

Follow [AGENTS.md](../../AGENTS.md) for `habit-hooks` with an empty snooze file,
metrics/coverage and MI/CRAP goals/exceptions, immutable history, route steps and
facts, public declaration comparison, final report, labels, draft decisions,
and Ready/Actions handling. Fixes after Ready return to Draft. The owner decides
on decision records and merges a PR that adds one. Pilot checks below do not
replace any migration gate.

## Tool evidence and separate optional adoption

The implementation choice is closed for this migration: retain current graph
engines. The dependency-cruiser pilot supports a separate optional working-tree
diagnostic, not a replacement for committed-Git or metrics baseline analysis.
Do not adopt Sheriff or add barrels/markers as part of this folder cleanup.

| Evaluated evidence | Result and implication |
| --- | --- |
| dependency-cruiser 18.7.0, first npm probes | Node 24.20.0 installation with root TypeScript 7 succeeded but TypeScript capability was unavailable and graphs were empty, with warnings in JSON metadata. Isolated TypeScript 6.0.3 worked. Graph exit status alone is insufficient. |
| pnpm pilot, 2026-10-21 | A disposable Darwin arm64 copy installed the full app with pnpm 12.10.1. Adding cruiser beside `.habit-hooks` TypeScript 6 alone still resolved root TypeScript 7.0.2. The scoped compiler extension below fixed resolution; root stayed 7.0.2 and both tool workspace/cruiser used 6.0.3. |
| Clean frozen replay | Both module directories were removed; `pnpm install --frozen-lockfile` recreated 333 packages from the warm store, with lock SHA256 `9229f6a4aee80917d443f02966c118c3b440473141c87fc275ec773b14295bd1` unchanged. This is not cold-network or cross-platform proof. Root `package.json`, existing allowBuilds, patches, overrides, and engines stayed unchanged. Review peer-context lock changes too; base versions did not change. |
| Full resolution and inventory | Default resolution left 19 installed SDK edges unresolved. Explicit export-map/condition options fixed them without suppression. Separate inputs of 140 server and eight portal TypeScript files covered all 148, both declarations, 480 unique source edges and 344 local pairs; no missing/unexpected source TypeScript, unresolved edge, summary error, or nonzero advised status. All 156 source files were byte-identical. These are snapshot results, not future constants. |
| Independent controls | The 344 local pairs matched the existing graph. Four temporary controls proved allowed public/app access and refused private static/type/dynamic, SDK, builtin, and missing-local access. The retained parser caught computed imports omitted by cruiser and runtime escalation from inline type syntax. JSON returned exit 0 with six expected errors/advised status 6; assertions read the summary. |
| Selected checks | Four existing graph/import/cycle/fact test files passed 49 tests; auth/page-fetch/search boundary tests passed 40; root typecheck and portal build passed. Full ordinary/production builds, CLI lazy-loading, live/container gates, permanent adapter, and CI integration were not completed by the pilot. |
| Classification and inventory limits | Use `tsPreCompilationDeps: true`, but retain the current classifier: `specify` mislabels rewritten runtime `.ts` imports, and inline type syntax can still load a module. Ambient mode affects type extraction. Computed/interpolated imports and `import.meta.resolve` need existing checks. Inventory comes from tracked files, not tsconfig include/exclude. Overlay assets; only imported CSS entered the code graph. |
| Graph/API limits | Validate uncollapsed data; CLI collapse lost private-file findings. Aggregate only a separate display. The typed import-only `cruise` API/schema is versioned with the tool; API validation defaults false. There is no independent schema version; `environment.version` names the tool. Assert required compiler capability, complete derived inventory, unresolved/error summaries and advised status. Normalize builtin/npm identity from specifier evidence, not pnpm physical paths. |
| Sheriff 0.20.0 | Root TypeScript 7/compiler API and combined ESLint peer setup failed; isolated TypeScript 6 worked. Current markers discovered no useful component split; automatic barrels required barrel imports and risk changed loading. The ESLint plugin missed TypeScript import types; exported edges lack runtime/type kinds. Barrelless privacy worked in CLI fixtures but needs explicit roots; pnpm and browser Bundler integration were not proved. It is not chosen for this migration. |

The exact successful candidate recipe added the `.habit-hooks` devDependency
`dependency-cruiser: 18.7.0` and this version-scoped
[pnpm package extension](https://pnpm.io/settings/dependency-resolution#packageextensions):

```yaml
packageExtensions:
  "dependency-cruiser@18.7.0":
    dependencies:
      typescript: "6.0.3"
```

Scans used an unresolved-import error rule, `tsPreCompilationDeps: true`,
`doNotFollow: { path: '(^|/)node_modules/' }`, and no source exclusions/collapse.
Server `tsConfig.fileName` was `tsconfig.json`, with:

```js
enhancedResolveOptions: {
  exportsFields: ['exports'],
  conditionNames: ['import', 'node', 'default']
}
```

Portal scans used `tsconfig.user-portal.json` and conditions
`['browser', 'import', 'default']`. The portal inventory includes Node Vite
configuration and declarations. This proved the compiler-context split, not
correct Node-tool export resolution under browser conditions. A maintained
diagnostic must select and test export conditions by execution context: Vite
tooling runs in Node even though the portal config compiles it. Keep the
file-context guard; no new component or compiler config is needed for this plan.
The earlier server-directory scan also parsed portal files under NodeNext and
is diagnostic evidence only. Required TypeScript availability and actual
resolution from the cruiser package must be checked after a frozen install;
unavailable unrelated optional transpilers are acceptable.

Evidence lives under `/tmp/thermus-pnpm-depcruise-pilot.v2yXne/evidence/`:
`PILOT-NOTES.md`, before/add/fix manifests and diffs, `runtime-frozen-replay.log`,
`frozen-replay-{before,after}.json`, `explicit-inventory-assertions.json`,
`explicit-union-summary.json`, `source-unchanged.json`, and `independent-*` logs.
The copy omitted `.env.example` and left the unused tooling gitlink empty.
With Node 24.20.0 first in PATH, its replay commands are:

```sh
cd /tmp/thermus-pnpm-depcruise-pilot.v2yXne/repo
pnpm --filter @thermus/habit-tools add --save-dev --save-exact dependency-cruiser@18.7.0
# Apply the scoped extension above in this disposable copy, keeping other settings.
pnpm install
pnpm install --frozen-lockfile
node ../evidence/runtime-probe.mjs .
node ../evidence/explicit-inventories.mjs .
node --test ../evidence/independent-controls.test.mjs
```

The recorded clean replay removed root and tool `node_modules` before its frozen
command. These temporary drivers are audit evidence, not a shipped command or
permanent gate. A separately proposed diagnostic must turn their capability,
resolution, inventory, summary and negative-control assertions into maintained
checks without changing existing commit/baseline semantics.

Primary references: dependency-cruiser 18.7.0 [release metadata](https://registry.npmjs.org/dependency-cruiser/18.7.0),
[options](https://github.com/sverweij/dependency-cruiser/blob/v18.7.0/doc/options-reference.md),
[API](https://github.com/sverweij/dependency-cruiser/blob/v18.7.0/doc/api.md),
[TypeScript support](https://github.com/sverweij/dependency-cruiser/blob/v18.7.0/src/meta.cjs),
[normalization](https://github.com/sverweij/dependency-cruiser/blob/v18.7.0/src/extract/helpers.mjs),
and [schema](https://github.com/sverweij/dependency-cruiser/blob/v18.7.0/src/schema/cruise-result.schema.json).
Sheriff's [source](https://github.com/sheriff-arch/sheriff),
[core](https://registry.npmjs.org/@softarc/sheriff-core/0.20.0),
[plugin](https://registry.npmjs.org/@softarc/eslint-plugin-sheriff/0.20.0), and
[module-boundary docs](https://sheriff.softarc.io/docs/module_boundaries) identify
the evaluated release; its re-export/deep-import example differed from the
installed probe. Earlier scripts/results remain in
`/tmp/thermus-depcruise-probe.fsSSSl` and `/tmp/thermus-sheriff-probe.CaSaKZ`.

## Complete source map

These are full repository-relative paths for every tracked `src/` file at
`af6b9e22`: 156 current files and 156 unique destinations. Recheck the derived
inventory if the source changes. This table is a reviewable move map, not a
permanent per-file ownership registry or permission to perform the moves. The
planned policy schema/resolver changes are outside this existing-source map.

| Current path | Proposed path |
| --- | --- |
| `src/application.ts` | `src/app/application.ts` |
| `src/auth/access-context.ts` | `src/accounts/identity/access-context.ts` |
| `src/auth/hosted-auth/browser-session.ts` | `src/accounts/identity/browser-session.ts` |
| `src/auth/hosted-auth/workos/hosted-role-mapping.ts` | `src/accounts/providers/workos/hosted-role-mapping.ts` |
| `src/auth/hosted-auth/workos/session-cookies.ts` | `src/accounts/providers/workos/session-cookies.ts` |
| `src/auth/hosted-auth/workos/sign-out-form.ts` | `src/interfaces/web/auth/workos/sign-out-form.ts` |
| `src/auth/hosted-auth/workos/workos-approved-signup-documents.ts` | `src/accounts/providers/workos/workos-approved-signup-documents.ts` |
| `src/auth/hosted-auth/workos/workos-auth-provider.ts` | `src/accounts/providers/workos/workos-auth-provider.ts` |
| `src/auth/hosted-auth/workos/workos-browser-session.ts` | `src/accounts/providers/workos/workos-browser-session.ts` |
| `src/auth/hosted-auth/workos/workos-google-onboarding.ts` | `src/accounts/providers/workos/workos-google-onboarding.ts` |
| `src/auth/hosted-auth/workos/workos-organizations.ts` | `src/accounts/providers/workos/workos-organizations.ts` |
| `src/auth/hosted-auth/workos/workos-session-client.ts` | `src/accounts/providers/workos/workos-session-client.ts` |
| `src/auth/hosted-auth/workos/workos-session-pages.ts` | `src/interfaces/web/auth/workos/workos-session-pages.ts` |
| `src/auth/hosted-auth/workos/workos-session-routes.ts` | `src/interfaces/web/auth/workos/workos-session-routes.ts` |
| `src/auth/hosted-auth/workos/workos-settings.ts` | `src/accounts/providers/workos/workos-settings.ts` |
| `src/auth/hosted-auth/workos/workos-sign-in.ts` | `src/accounts/providers/workos/workos-sign-in.ts` |
| `src/auth/hosted-auth/workos/workos-signup-document-reader.ts` | `src/interfaces/web/auth/workos/workos-signup-document-reader.ts` |
| `src/auth/hosted-auth/workos/workos-signup-documents.ts` | `src/accounts/providers/workos/workos-signup-documents.ts` |
| `src/auth/hosted-auth/workos/workos-signup-form.ts` | `src/interfaces/web/auth/workos/workos-signup-form.ts` |
| `src/auth/hosted-auth/workos/workos-signup-pages.ts` | `src/interfaces/web/auth/workos/workos-signup-pages.ts` |
| `src/auth/hosted-auth/workos/workos-signup-routes.ts` | `src/interfaces/web/auth/workos/workos-signup-routes.ts` |
| `src/auth/hosted-auth/workos/workos-signup-settings.ts` | `src/accounts/providers/workos/workos-signup-settings.ts` |
| `src/auth/hosted-auth/workos/workos-signup-style.ts` | `src/interfaces/web/auth/workos/workos-signup-style.ts` |
| `src/auth/hosted-auth/workos/workos-signup.ts` | `src/accounts/providers/workos/workos-signup.ts` |
| `src/auth/identity-verifier.ts` | `src/accounts/identity/identity-verifier.ts` |
| `src/auth/local-auth/better-auth/better-auth-provider.ts` | `src/accounts/providers/better-auth/better-auth-provider.ts` |
| `src/auth/local-auth/better-auth/better-auth-runtime.ts` | `src/accounts/providers/better-auth/better-auth-runtime.ts` |
| `src/auth/local-auth/better-auth/better-auth-user-administration.ts` | `src/accounts/providers/better-auth/better-auth-user-administration.ts` |
| `src/auth/local-auth/better-auth/data-directory-lock.ts` | `src/accounts/providers/better-auth/data-directory-lock.ts` |
| `src/auth/local-auth/better-auth/local-auth-page-form.ts` | `src/interfaces/web/auth/better-auth/local-auth-page-form.ts` |
| `src/auth/local-auth/better-auth/local-auth-page-html.ts` | `src/interfaces/web/auth/better-auth/local-auth-page-html.ts` |
| `src/auth/local-auth/better-auth/local-auth-pages.ts` | `src/interfaces/web/auth/better-auth/local-auth-pages.ts` |
| `src/auth/local-auth/better-auth/local-auth-provider-routes.ts` | `src/interfaces/web/auth/better-auth/local-auth-provider-routes.ts` |
| `src/auth/local-auth/better-auth/local-installation.ts` | `src/accounts/providers/better-auth/local-installation.ts` |
| `src/auth/local-auth/local-auth-command-line.ts` | `src/interfaces/cli/local-auth-command-line.ts` |
| `src/auth/local-auth/local-auth-command.ts` | `src/interfaces/cli/local-auth-command.ts` |
| `src/auth/local-auth/local-user-administration.ts` | `src/accounts/identity/local-user-administration.ts` |
| `src/billing/billing-free.ts` | `src/accounts/billing/billing-free.ts` |
| `src/billing/billing.ts` | `src/accounts/billing/billing.ts` |
| `src/config/ad-rules-file.ts` | `src/runtime/config/ad-rules-file.ts` |
| `src/config/deployment-config.ts` | `src/runtime/config/deployment-config.ts` |
| `src/fetch-tool.ts` | `src/app/fetch-tool.ts` |
| `src/hosted-admin/account-form.ts` | `src/interfaces/web/account/account-form.ts` |
| `src/hosted-admin/account-pages.ts` | `src/interfaces/web/account/account-pages.ts` |
| `src/hosted-admin/account-routes.ts` | `src/interfaces/web/account/account-routes.ts` |
| `src/hosted-admin/administration-pages.ts` | `src/interfaces/web/account/administration-pages.ts` |
| `src/hosted-admin/administration-routes.ts` | `src/interfaces/web/account/administration-routes.ts` |
| `src/hosted-admin/organization-selection-page.ts` | `src/interfaces/web/account/organization-selection-page.ts` |
| `src/hosted-admin/organization-selection-style.ts` | `src/interfaces/web/account/organization-selection-style.ts` |
| `src/hosted-admin/page-html.ts` | `src/interfaces/web/page-html.ts` |
| `src/hosted-admin/portal-access.ts` | `src/interfaces/web/account/portal-access.ts` |
| `src/hosted-portal.ts` | `src/app/hosted-portal.ts` |
| `src/hosted-renderer-startup.ts` | `src/app/hosted-renderer-startup.ts` |
| `src/hosted-workos-application.ts` | `src/app/hosted-workos-application.ts` |
| `src/html-cleaner-pipeline/ad-cleaner/adb/adblock-rs.d.ts` | `src/pipelines/html-processing/ad-cleaner/adb/adblock-rs.d.ts` |
| `src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts` | `src/pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts` |
| `src/html-cleaner-pipeline/ad-cleaner/adb/source-line-index.ts` | `src/pipelines/html-processing/ad-cleaner/adb/source-line-index.ts` |
| `src/html-cleaner-pipeline/ad-cleaner/adb/source-range-parser.ts` | `src/pipelines/html-processing/ad-cleaner/adb/source-range-parser.ts` |
| `src/html-cleaner-pipeline/ad-cleaner/clean-html-ads.ts` | `src/pipelines/html-processing/ad-cleaner/clean-html-ads.ts` |
| `src/html-cleaner-pipeline/ad-cleaner/html-depth-limit-error.ts` | `src/pipelines/html-processing/ad-cleaner/html-depth-limit-error.ts` |
| `src/html-cleaner-pipeline/html-input-limit.ts` | `src/pipelines/html-processing/html-input-limit.ts` |
| `src/html-cleaner-pipeline/html-to-markdown-pipeline.ts` | `src/pipelines/html-processing/html-to-markdown-pipeline.ts` |
| `src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts` | `src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts` |
| `src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown.ts` | `src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown.ts` |
| `src/html-cleaner-pipeline/html-to-markdown/plain-text-input.ts` | `src/pipelines/html-processing/html-to-markdown/plain-text-input.ts` |
| `src/html-cleaner-pipeline/html-to-markdown/prepare-html-document.ts` | `src/pipelines/html-processing/html-to-markdown/prepare-html-document.ts` |
| `src/html-cleaner-pipeline/html-to-markdown/sanitize-html-document.ts` | `src/pipelines/html-processing/html-to-markdown/sanitize-html-document.ts` |
| `src/html-cleaner-pipeline/process-html-step.ts` | `src/pipelines/html-processing/process-html-step.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-animation-declarations.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-animation-declarations.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-opacity-animations.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-opacity-animations.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-opacity-keyframes.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-opacity-keyframes.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-selector-index.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-selector-index.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-selector-predicates.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-selector-predicates.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-provenance.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-visibility-provenance.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-ranges.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-visibility-ranges.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-rules.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-visibility-rules.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-selectors.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-visibility-selectors.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-tree.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-visibility-tree.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/css-visibility.ts` | `src/pipelines/html-processing/prompt-injection-remover/css-visibility.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-removal-counts.ts` | `src/pipelines/html-processing/prompt-injection-remover/hidden-html-removal-counts.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-removal-session.ts` | `src/pipelines/html-processing/prompt-injection-remover/hidden-html-removal-session.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-scanner.ts` | `src/pipelines/html-processing/prompt-injection-remover/hidden-html-scanner.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/html-control-context.ts` | `src/pipelines/html-processing/prompt-injection-remover/html-control-context.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/html-text-source-ranges.ts` | `src/pipelines/html-processing/prompt-injection-remover/html-text-source-ranges.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts` | `src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover.ts` | `src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/sanitize-html-controls.ts` | `src/pipelines/html-processing/prompt-injection-remover/sanitize-html-controls.ts` |
| `src/html-cleaner-pipeline/prompt-injection-remover/small-text-policy.ts` | `src/pipelines/html-processing/prompt-injection-remover/small-text-policy.ts` |
| `src/html-cleaner-pipeline/search-results/brave-http-result-cleanup.ts` | `src/pipelines/html-processing/search-results/brave-http-result-cleanup.ts` |
| `src/html-cleaner-pipeline/search-results/brave-result-document.ts` | `src/pipelines/html-processing/search-results/brave-result-document.ts` |
| `src/html-cleaner-pipeline/search-results/brave-result-fields.ts` | `src/pipelines/html-processing/search-results/brave-result-fields.ts` |
| `src/html/html-escape.ts` | `src/interfaces/web/html-escape.ts` |
| `src/http/client-address.ts` | `src/runtime/http/client-address.ts` |
| `src/http/fetch-exchange.ts` | `src/runtime/http/fetch-exchange.ts` |
| `src/http/request-cancellation.ts` | `src/runtime/http/request-cancellation.ts` |
| `src/http/server.ts` | `src/runtime/http/server.ts` |
| `src/index.ts` | `src/index.ts` |
| `src/logging/base-logger.ts` | `src/logging/base-logger.ts` |
| `src/logging/console-logger.ts` | `src/logging/console-logger.ts` |
| `src/logging/otel-logger.ts` | `src/logging/otel-logger.ts` |
| `src/mcp/fetch-tool-schema.ts` | `src/interfaces/mcp/fetch-tool-schema.ts` |
| `src/mcp/fetch-tool-server.ts` | `src/interfaces/mcp/fetch-tool-server.ts` |
| `src/mcp/get-url-as-markdown.ts` | `src/interfaces/mcp/get-url-as-markdown.ts` |
| `src/mcp/identity-verifier-sdk-adapter.ts` | `src/interfaces/mcp/identity-verifier-sdk-adapter.ts` |
| `src/mcp/mcp-server.ts` | `src/interfaces/mcp/mcp-server.ts` |
| `src/mcp/operation-capacity.ts` | `src/app/operation-capacity.ts` |
| `src/mcp/protected-resource-endpoint.ts` | `src/interfaces/mcp/protected-resource-endpoint.ts` |
| `src/mcp/search-tool-schema.ts` | `src/interfaces/mcp/search-tool-schema.ts` |
| `src/mcp/search.ts` | `src/interfaces/mcp/search.ts` |
| `src/mcp/tool-completion-record.ts` | `src/interfaces/mcp/tool-completion-record.ts` |
| `src/organizations/administration-overviews.ts` | `src/accounts/organizations/administration-overviews.ts` |
| `src/organizations/change-records.ts` | `src/accounts/organizations/change-records.ts` |
| `src/organizations/customer-roles.ts` | `src/accounts/organizations/customer-roles.ts` |
| `src/organizations/directory-reads.ts` | `src/accounts/organizations/directory-reads.ts` |
| `src/organizations/organization-administration.ts` | `src/accounts/organizations/organization-administration.ts` |
| `src/organizations/organization-directory.ts` | `src/accounts/organizations/organization-directory.ts` |
| `src/page-fetch/execute-incoming-step.ts` | `src/pipelines/page-fetch/execute-incoming-step.ts` |
| `src/page-fetch/execute-outgoing-step.ts` | `src/pipelines/page-fetch/execute-outgoing-step.ts` |
| `src/page-fetch/execution-context.ts` | `src/pipelines/execution/execution-context.ts` |
| `src/page-fetch/fetch-failure.ts` | `src/pipelines/page-fetch/fetch-failure.ts` |
| `src/page-fetch/fetch-page.ts` | `src/pipelines/page-fetch/fetch-page.ts` |
| `src/page-fetch/fetch-url.ts` | `src/pipelines/page-fetch/fetch-url.ts` |
| `src/page-fetch/observe-request-step.ts` | `src/pipelines/execution/observe-request-step.ts` |
| `src/page-fetch/pipeline-step.ts` | `src/pipelines/execution/pipeline-step.ts` |
| `src/page-fetch/renderer-failure-reports.ts` | `src/pipelines/providers/website-fetcher/renderer-failure-reports.ts` |
| `src/page-fetch/step-record.ts` | `src/pipelines/execution/step-record.ts` |
| `src/search-engine/search-engine-brave-http.ts` | `src/pipelines/providers/search-engine/search-engine-brave-http.ts` |
| `src/search-engine/search-engine.ts` | `src/pipelines/providers/search-engine/search-engine.ts` |
| `src/search-pipeline/execute-incoming-step.ts` | `src/pipelines/search/execute-incoming-step.ts` |
| `src/search-pipeline/execute-outgoing-step.ts` | `src/pipelines/search/execute-outgoing-step.ts` |
| `src/search-pipeline/search-cancellation.ts` | `src/pipelines/search/search-cancellation.ts` |
| `src/search-pipeline/search-failure.ts` | `src/pipelines/search/search-failure.ts` |
| `src/search-pipeline/search-pipeline.ts` | `src/pipelines/search/search-pipeline.ts` |
| `src/search-pipeline/search-query.ts` | `src/pipelines/search/search-query.ts` |
| `src/terminal/hidden-line-input.ts` | `src/app/hidden-line-input.ts` |
| `src/user-portal/agent-guides.ts` | `src/interfaces/user-portal/agent-guides.ts` |
| `src/user-portal/connection-guide.ts` | `src/interfaces/user-portal/connection-guide.ts` |
| `src/user-portal/env.d.ts` | `src/interfaces/user-portal/env.d.ts` |
| `src/user-portal/guide-selector.ts` | `src/interfaces/user-portal/guide-selector.ts` |
| `src/user-portal/index.html` | `src/interfaces/user-portal/index.html` |
| `src/user-portal/main.ts` | `src/interfaces/user-portal/main.ts` |
| `src/user-portal/portal.ts` | `src/interfaces/user-portal/portal.ts` |
| `src/user-portal/product-flow.ts` | `src/interfaces/user-portal/product-flow.ts` |
| `src/user-portal/public/assets/plex-OFL.txt` | `src/interfaces/user-portal/public/assets/plex-OFL.txt` |
| `src/user-portal/public/assets/plex-mono-400-latin.woff2` | `src/interfaces/user-portal/public/assets/plex-mono-400-latin.woff2` |
| `src/user-portal/public/assets/plex-sans-latin.woff2` | `src/interfaces/user-portal/public/assets/plex-sans-latin.woff2` |
| `src/user-portal/public/assets/plex-serif-500-latin.woff2` | `src/interfaces/user-portal/public/assets/plex-serif-500-latin.woff2` |
| `src/user-portal/public/assets/thermus-favicon.svg` | `src/interfaces/user-portal/public/assets/thermus-favicon.svg` |
| `src/user-portal/public/assets/thermus-logo.svg` | `src/interfaces/user-portal/public/assets/thermus-logo.svg` |
| `src/user-portal/style.css` | `src/interfaces/user-portal/style.css` |
| `src/user-portal/vite.config.ts` | `src/interfaces/user-portal/vite.config.ts` |
| `src/website-fetcher/fetch-diagnostic.ts` | `src/pipelines/providers/website-fetcher/fetch-diagnostic.ts` |
| `src/website-fetcher/network-policy.ts` | `src/pipelines/providers/website-fetcher/network-policy.ts` |
| `src/website-fetcher/renderer-result.ts` | `src/pipelines/providers/website-fetcher/renderer-result.ts` |
| `src/website-fetcher/website-fetcher-lightpanda.ts` | `src/pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts` |
| `src/website-fetcher/website-fetcher.ts` | `src/pipelines/providers/website-fetcher/website-fetcher.ts` |
