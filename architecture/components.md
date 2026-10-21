# Component registry

This is the current architecture of Thermus. It describes component intent,
important collaborations, and known limits. The [review rules](../docs/implementation/pr-review-rules.yaml)
remain the machine authority for source ownership, public modules, and permitted
imports. This registry is not another import allowlist.

Use the [registry update workflow](../docs/implementation/component-registry-workflow.md)
when a change affects this view. Git history and pull request diffs show its
evolution. The [component structure proposal](../docs/design/component-structure-proposal.md)
records the migration design; this page describes the resulting system.

## Runtime view

Arrows show selected runtime collaborations, not TypeScript imports. Each box
can group several component IDs. These diagram groups are not source owners;
the table below defines the owners. Group node IDs stay stable for readable
Git diffs. WorkOS and public websites are external services. The local auth data
directory is application-owned storage.

```mermaid
flowchart TB
  clients["Clients / operator<br/>Thermus user-portal"]
  interfaces["Request adapters<br/>mcp · web · cli"]
  accounts["Account rules and roles<br/>identity · organizations · billing"]
  hosted["Hosted provider<br/>workos"]
  local["Local provider<br/>better-auth"]
  workos_service(["WorkOS / AuthKit"])
  local_data[("Local auth data directory")]
  tools["Tool operations<br/>page-fetch · search"]
  processing["Steps and HTML processing<br/>execution · html-processing"]
  fetching["Search and page providers<br/>search-engine · website-fetcher"]
  external_web(["Lightpanda → public web / Brave HTML"])
  runtime["Composition and runtime<br/>app · config · http · logging"]
  clients --> interfaces
  interfaces -->|supplied account roles| accounts
  accounts -->|hosted selection| hosted
  accounts -->|local selection| local
  hosted --> workos_service
  local --> local_data
  interfaces -->|MCP tools| tools
  tools --> processing
  tools --> fetching
  fetching --> external_web
  runtime -.->|construct, serve, record, close| interfaces
```

App constructs the collaborators and selects one authentication edition. The
account/provider arrows summarize that binding; identity records and contracts
do not themselves call providers. Hosted web uses sessions and organization
administration backed by WorkOS. Local CLI commands use supplied Better Auth
administration roles. The browser portal calls web routes over HTTP; app loads
its built assets through [HostedPortal](../src/app/hosted-portal.ts).

Within the provider group, the Brave search engine calls the supplied website
fetcher. Both search and page fetch reach external pages through Lightpanda;
search uses Brave HTML rather than a separate external API. Within the runtime
group, app owns composition and lifetimes, config validates settings, HTTP serves
the composed handler, and logging receives supplied record/report sinks.

An **import dependency** points from an importer to the component whose module
it imports. The rules count runtime and whole-statement type-only imports
separately; inline `import { type X }` can still load a module. A **runtime
collaboration** follows calls on supplied objects/functions. For example,
page-fetch calls HTML processing through `IncomingStep`, but does not import
its implementation. Organizations calls a supplied WorkOS directory while
importing only neutral roles. The [review rules](../docs/implementation/pr-review-rules.yaml)
and generated metrics reports provide the complete import view; this diagram
does not duplicate it.

## arc42 building-block view

This section uses the static decomposition described by
[arc42 section 5](https://docs.arc42.org/section-5/): a whole-system view and
selected deeper views. The [Ownership](#ownership) table supplies each component's
responsibility, public boundary, and source location. The diagrams add structure
and selected dependencies; they are not a complete import graph.

### Level 1: Thermus whitebox

All 19 stable component IDs appear below. A subgraph contains logical building
blocks; it does not add a source owner. The browser boundary separates browser
code from server code. The server / command group locates source for alternative
entry paths; its contents do not all run in one process. These groups do not
prescribe separate deployments. `app` selects and constructs the server
collaborators; the wide composition access is stated here instead of drawn as
an arrow to every component.

Solid arrows in this overview mean a selected source dependency, including type
imports. They point from the importer to the owner of the imported module.
Dependencies on injected roles point to the component that defines the role,
not to the selected implementation. The labelled browser arrow is an HTTP
contract, not a source import. The two refinements below separate role use,
implementation, and composition in more detail. Omitted arrows do not imply
that an import or collaboration is forbidden; the review rules give that check.

```mermaid
flowchart TB
  subgraph arc_browser["Browser"]
    arc_portal["user-portal"]
  end
  subgraph arc_server["Thermus server / local commands"]
    subgraph arc_composition["Composition and support"]
      arc_app["app"]
      arc_config["config"]
      arc_http["http"]
      arc_logging["logging"]
    end
    subgraph arc_adapters["Request adapters"]
      arc_mcp["mcp"]
      arc_web["web"]
      arc_cli["cli"]
    end
    subgraph arc_accounts["Account rules and roles"]
      arc_identity["identity"]
      arc_orgs["organizations"]
      arc_billing["billing"]
    end
    subgraph arc_auth["Alternative authentication providers"]
      arc_workos["workos · hosted"]
      arc_better["better-auth · local"]
    end
    subgraph arc_tools["Tool operations and processing"]
      arc_fetch["page-fetch"]
      arc_search["search"]
      arc_execution["execution"]
      arc_html["html-processing"]
    end
    subgraph arc_content["Page and search adapters"]
      arc_engine["search-engine"]
      arc_fetcher["website-fetcher"]
    end
  end
  arc_portal -->|HTTP routes| arc_web
  arc_app --> arc_config
  arc_app --> arc_http
  arc_app --> arc_logging
  arc_app --> arc_mcp
  arc_app --> arc_web
  arc_mcp --> arc_fetch
  arc_mcp --> arc_search
  arc_fetch --> arc_fetcher
  arc_mcp --> arc_identity
  arc_web --> arc_orgs
  arc_cli --> arc_identity
  arc_orgs --> arc_identity
  arc_orgs --> arc_billing
  arc_workos --> arc_identity
  arc_workos --> arc_orgs
  arc_better --> arc_identity
  arc_fetch --> arc_execution
  arc_search --> arc_execution
  arc_search --> arc_engine
  arc_html --> arc_execution
  arc_engine --> arc_fetcher
```

The browser portion of `user-portal` uses server routes through HTTP. Its Vite
configuration is build-time Node code, not browser access to server modules.
[HostedPortal](../src/app/hosted-portal.ts) loads the built assets. The overview
shows selected dependencies across component boundaries, not every sibling
relationship or external library.

### Level 2: refinement of tool operations and processing

This whitebox refines `page-fetch`, `search`, `execution`, `html-processing`,
`search-engine`, and `website-fetcher`. Boxes within an owner are private parts
or public contracts of that owner, not new component IDs. Solid arrows labelled
`uses` mean dependency on a supplied role or a directly held collaborator.
Dotted `implements` arrows point from an implementation to its contract.
Thick `constructs / supplies` arrows are composition by `app`; they do not
mean that the recipient imports app or the concrete provider.

```mermaid
flowchart TB
  tool_root["app / fetch-tool.ts<br/>shared tool composition"]
  subgraph tool_fetch_owner["page-fetch"]
    tool_fetch["createFetchPage<br/>permission · URL · outcomes"]
  end
  subgraph tool_search_owner["search"]
    tool_search["SearchPipeline<br/>permission · query · outcomes"]
  end
  subgraph tool_execution_owner["execution"]
    tool_steps["OutgoingStep / IncomingStep<br/>execute → allow or block"]
    tool_observer["ObserveRequestStep"]
    tool_records["ExecutionContext / StepRecordSink"]
  end
  subgraph tool_html_owner["html-processing"]
    tool_process["ProcessHtmlStep"]
    tool_runner["HtmlToMarkdownPipeline<br/>fresh HtmlProcessingContext"]
    tool_transforms["HtmlTransformation.invoke<br/>ads · sanitizer · optional Brave projection<br/>Markdown converter"]
  end
  subgraph tool_engine_owner["search-engine"]
    tool_engine_role["SearchEngine"]
    tool_brave["SearchEngineBraveHttp"]
  end
  subgraph tool_fetcher_owner["website-fetcher"]
    tool_fetch_role["WebsiteFetcher"]
    tool_lightpanda["WebsiteFetcherLightpanda<br/>destination and process limits"]
  end
  tool_child["Lightpanda child<br/>one per fetch"]
  tool_web(["Public pages / Brave HTML"])
  tool_root ==>|constructs / supplies| tool_fetch
  tool_root ==>|constructs / supplies| tool_search
  tool_root ==>|constructs / supplies| tool_process
  tool_fetch -->|uses| tool_steps
  tool_search -->|uses| tool_steps
  tool_fetch -->|uses| tool_records
  tool_search -->|uses| tool_records
  tool_observer -.->|implements OutgoingStep| tool_steps
  tool_process -.->|implements IncomingStep| tool_steps
  tool_process -->|uses| tool_runner
  tool_runner -->|uses ordered transformations| tool_transforms
  tool_fetch -->|uses| tool_fetch_role
  tool_search -->|uses| tool_engine_role
  tool_brave -.->|implements| tool_engine_role
  tool_brave -->|uses| tool_fetch_role
  tool_lightpanda -.->|implements| tool_fetch_role
  tool_lightpanda -->|starts and bounds| tool_child
  tool_child -->|loads pages| tool_web
```

The last two arrows mark the adapter's external boundary, not TypeScript
imports. [Tool composition](../src/app/fetch-tool.ts) constructs one fetcher,
ad cleaner, sanitizer, observer, record sink, and renderer-report closures for
both operations. It supplies these objects through the roles above. Each tool
has its own `ProcessHtmlStep`, HTML runner, and Markdown converter. Fetch uses
ads → sanitizer → Markdown; search adds Brave projection before Markdown.
[PipelineStep](../src/pipelines/execution/pipeline-step.ts) and
[HtmlTransformation](../src/pipelines/html-processing/html-to-markdown-pipeline.ts)
are distinct contracts. There is no shared generic pipeline engine.

Each operation has fresh execution and HTML context. Hosted composition wraps
both operations in one application-wide capacity slot. The
[Lightpanda adapter](../src/pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts)
owns each child until completion or cancellation. These lifetimes explain
sharing inside this static decomposition; the Runtime view describes calls.

### Level 2: refinement of accounts and browser authentication

The two whiteboxes below refine the account/provider groups and their request
adapters for the hosted and local authentication editions.
Solid `uses` arrows name required contracts. Dotted `implements` arrows point
from providers to neutral contracts; the contracts do not depend on providers.
Thick composition arrows mark app's selection and binding of one edition.
The direct WorkOS web dependency is explicit because browser authentication is
only partly provider-neutral.

#### Hosted edition

```mermaid
flowchart TB
  account_root["app<br/>hosted composition"]
  subgraph account_identity_owner["identity"]
    account_access["IdentityVerifier / AccessResolver<br/>trusted access records"]
    account_browser["BrowserSession"]
  end
  subgraph account_org_owner["organizations"]
    account_admin["OrganizationAdministration<br/>roles · MFA · changes · seat count"]
    account_directory["OrganizationDirectory"]
  end
  subgraph account_billing_owner["billing"]
    account_billing_role["Billing / BillingFree"]
  end
  subgraph account_web_owner["web"]
    account_routes["HostedAccountRoutes"]
    account_workos_routes["WorkOS session / signup routes"]
  end
  account_mcp["mcp / MCPServer"]
  subgraph account_workos_owner["workos · hosted alternative"]
    account_workos_access["WorkOSAuthProvider"]
    account_workos_directory["WorkOSOrganizations"]
    account_workos_session["WorkOSBrowserSession"]
    account_workos_signup["WorkOSSignup / signup contracts"]
  end
  account_workos_external(["WorkOS / AuthKit<br/>remote identity and organizations"])
  account_root ==>|constructs / supplies hosted roles| account_workos_owner
  account_mcp -->|uses| account_access
  account_routes -->|uses| account_access
  account_routes -->|uses| account_browser
  account_routes -->|uses| account_admin
  account_admin -->|uses| account_directory
  account_admin -->|uses| account_billing_role
  account_workos_access -.->|implements| account_access
  account_workos_directory -.->|implements| account_directory
  account_workos_session -.->|implements BrowserSession| account_browser
  account_workos_routes -->|uses provider session roles| account_workos_session
  account_workos_routes -->|uses signup contracts| account_workos_signup
  account_workos_owner -->|SDK / key-set boundary| account_workos_external
```

#### Local edition

The local alternative repeats the neutral identity roles. The web-owned
`ProviderHandler` is a function contract; app supplies the runtime handler.
This binding is not a source dependency from web to the provider.

```mermaid
flowchart TB
  local_root["app / local composition and CLI entry"]
  subgraph local_identity_owner["identity"]
    local_access["IdentityVerifier / AccessResolver"]
    local_admin_role["LocalUserAdministration"]
  end
  subgraph local_web_owner["web"]
    account_local_pages["LocalAuthPages"]
    account_local_handler["ProviderHandler<br/>Request → Promise of Response"]
  end
  account_cli["cli / local-auth-command.ts"]
  local_mcp["mcp / MCPServer"]
  subgraph account_better_owner["better-auth"]
    account_better_access["BetterAuthProvider"]
    account_better_admin["BetterAuthUserAdministration"]
    account_better_runtime["Better Auth runtime / installation"]
  end
  account_local_data[("Local auth data<br/>SQLite · secret · client record")]
  local_root ==>|opens / supplies local roles| account_better_owner
  local_root ==>|binds local handler| account_local_handler
  local_mcp -->|uses| local_access
  account_cli -->|uses| local_admin_role
  account_local_pages -->|uses| account_local_handler
  account_better_access -.->|implements| local_access
  account_better_admin -.->|implements| local_admin_role
  account_better_runtime -->|owns open resources| account_local_data
```

The two external-boundary arrows describe service/storage access, not imports.
[Hosted composition](../src/app/hosted-workos-application.ts) shares a WorkOS
SDK client, key-set resolver, and directory. It supplies that directory to
access resolution and account administration, and selects `BillingFree`.
The [provider](../src/accounts/providers/workos/workos-auth-provider.ts)
implements identity verification and access resolution;
[WorkOSOrganizations](../src/accounts/providers/workos/workos-organizations.ts)
implements the directory. Account administration depends on those neutral
roles, not WorkOS classes. WorkOS-specific web routes use provider session,
signup, cookie, and document contracts directly.
[LocalAuthPages](../src/interfaces/web/auth/better-auth/local-auth-pages.ts)
imports the web-owned `ProviderHandler` contract from
[local-auth-provider-routes.ts](../src/interfaces/web/auth/better-auth/local-auth-provider-routes.ts).
It has no source dependency on the Better Auth runtime: app binds
`runtime.auth.handler` to that function contract.

[Application composition](../src/app/application.ts) uses edition-specific
dynamic imports. The local edition supplies a Better Auth handler to local
pages and a verifier/resolver to MCP; it does not construct hosted organization
administration. Local CLI administration is a separate open/close path using
the neutral administration role. The
[Better Auth runtime](../src/accounts/providers/better-auth/better-auth-runtime.ts)
owns its database and data-directory lock until app or CLI closure. App closes
request work before provider resources. HTTP listener drain and logging sinks
remain the support responsibilities shown at level 1.

## Ownership

The 19 IDs below are stable logical component names. Each root owns its source
files recursively. `app` also owns exactly `src/index.ts`. The directories
`accounts`, `accounts/providers`, `interfaces`, `pipelines`,
`pipelines/providers`, and `runtime` group components; they do not own code.
Private subdirectories below an owner are implementation areas, not separate
components. Components here are logical boundaries within one application,
not independently deployed services.

Public boundaries use named modules, not a barrel. App has construction access
to concrete implementations. That access does not make every implementation
module a contract for other callers. The review rules define the exact checked
surface and the narrower file-context restrictions.

| Stable ID and source root | Responsibility and main parts | Boundary |
| --- | --- | --- |
| `app` — [`src/app/`](../src/app/), plus [`src/index.ts`](../src/index.ts) | Select hosted or self-hosted operation; construct providers, routes, tools, logs, and shared services; own startup, shutdown, capacity, portal loading, and hidden terminal input. | Entrypoint and application lifecycle; documented [tool composition](../src/app/fetch-tool.ts). Other components do not import app. |
| `identity` — [`src/accounts/identity/`](../src/accounts/identity/) | Define authenticated users, grants, immutable request contexts, permission checks, verification, browser sessions, and local administration roles. | [Access context](../src/accounts/identity/access-context.ts), verifier, browser-session, and local-user-administration contracts. No provider or UI implementation belongs here. |
| `organizations` — [`src/accounts/organizations/`](../src/accounts/organizations/) | Customer roles, administration rules, member/invitation overviews, directory roles, seat calculations, and privileged change recording. | Directory, administration, overview, customer-role, and change-record modules. Directory-read helpers remain private. |
| `billing` — [`src/accounts/billing/`](../src/accounts/billing/) | Report plan state and accept seat updates. `BillingFree` is the current implementation. | [Billing roles](../src/accounts/billing/billing.ts); app selects the implementation. |
| `workos` — [`src/accounts/providers/workos/`](../src/accounts/providers/workos/) | Hosted token/access verification, sessions, organization operations, signup/onboarding, settings, cookies, and signup-document validation. | App constructs provider/SDK objects. Web's WorkOS auth area uses selected session/signup roles and cookie/document helpers; account routes use neutral supplied roles. |
| `better-auth` — [`src/accounts/providers/better-auth/`](../src/accounts/providers/better-auth/) | Local authentication, access resolution, user/client administration, installation storage, data-directory lock, and cleanup. | Provider, runtime-opening, and administration-opening modules for app; storage and lock mechanics remain private. |
| `mcp` — [`src/interfaces/mcp/`](../src/interfaces/mcp/) | Adapt protocol requests to trusted access contexts and supplied tool operations. Own schemas, metadata, protocol errors, request lifetimes, and completion presentation. | Server/tool composition modules, protected-resource endpoint, and client-visible schema modules. SDK adaptation stays inside this owner. |
| `web` — [`src/interfaces/web/`](../src/interfaces/web/) | Account/admin/organization-selection routes, portal access, sign-in/out, signup, consent, forms, pages, escaping, and browser request protection. `account/` and `auth/` are private areas of this one owner. | Route constructors for app; shared account-form, page-html, and html-escape modules. Provider-specific browser adapters have narrower access than the whole owner. |
| `cli` — [`src/interfaces/cli/`](../src/interfaces/cli/) | Parse local user/client commands, use supplied administration and hidden-input roles, format output and exit status. | [Local command](../src/interfaces/cli/local-auth-command.ts). App opens and closes administration/input resources. |
| `user-portal` — [`src/interfaces/user-portal/`](../src/interfaces/user-portal/) | Browser portal behavior, connection instructions, styles, and static assets; Vite build configuration and declarations. | Browser HTTP interactions and rendered output. Vite runs in Node; browser modules cannot inherit its server/build access. |
| `execution` — [`src/pipelines/execution/`](../src/pipelines/execution/) | Operation IDs/context, outgoing/incoming step roles, bounded best-effort records, and pass-through request observation. | Execution-context, pipeline-step, and step-record modules. App constructs the observer. |
| `page-fetch` — [`src/pipelines/page-fetch/`](../src/pipelines/page-fetch/) | Check product permission and URL; run outgoing work, fetch, and incoming work; preserve cancellation, withholding, and safe failures. | [Fetch operation](../src/pipelines/page-fetch/fetch-page.ts), URL validation, and failure modules. Step executors remain private. |
| `search` — [`src/pipelines/search/`](../src/pipelines/search/) | Check permission/query, use a supplied search engine, process its page, and preserve cancellation, no-results, withholding, and safe failures. | Search-pipeline, search-query, and search-failure modules; private step executors and cancellation helper. |
| `html-processing` — [`src/pipelines/html-processing/`](../src/pipelines/html-processing/) | Input/depth limits; ad removal; hidden-content/control sanitation; Brave result projection; Markdown conversion. Transformer subdirectories remain inside one owner. | ProcessHtmlStep and documented [HTML runner](../src/pipelines/html-processing/html-to-markdown-pipeline.ts); documented ad-cleaner construction and depth-limit error. App selects concrete transformations. |
| `website-fetcher` — [`src/pipelines/providers/website-fetcher/`](../src/pipelines/providers/website-fetcher/) | Render pages with Lightpanda; destination/process policy; safe renderer failures and reports. | Fetcher/result/failure roles, renderer-failure-reports, and documented [network policy](../src/pipelines/providers/website-fetcher/network-policy.ts). App selects Lightpanda. |
| `search-engine` — [`src/pipelines/providers/search-engine/`](../src/pipelines/providers/search-engine/) | Build Brave search requests, validate the returned origin/document, and fetch through a supplied website fetcher. | [Search engine/document roles](../src/pipelines/providers/search-engine/search-engine.ts). App selects the Brave HTTP adapter. |
| `logging` — [`src/logging/`](../src/logging/) | Format and emit operator logs through console or OpenTelemetry implementations. | BaseLogger/LogLevel and concrete logger modules selected at composition. |
| `http` — [`src/runtime/http/`](../src/runtime/http/) | Node listener, HTTP-to-Fetch exchange, trusted client address, request cancellation, connection tracking, and listener drain. | Server for app; client-address and request-cancellation modules for other consumers. Exchange mechanics remain private. |
| `config` — [`src/runtime/config/`](../src/runtime/config/) | Validate deployment/listen settings and read trusted ad rules. Provider settings stay with their provider. | Deployment-config and ad-rules-file modules. |

## Behavior and resource ownership

The [tool composition](../src/app/fetch-tool.ts) shares one fetcher, ad cleaner,
sanitizer, outgoing observer, step-record sink, and renderer-report closures
between fetch and search. Each operation gets fresh execution/HTML context.
Markdown converters are separate instances. Hosted fetch and search share one
[capacity slot](../src/app/operation-capacity.ts); a concurrent operation gets a
busy error. This slot has application scope, not tenant scope or cluster scope.

Fetch runs ads → sanitizer → Markdown. Search runs ads → sanitizer → Brave
projection → search-preserving Markdown. The full search page is cleaned before
projection. [ProcessHtmlStep](../src/pipelines/html-processing/process-html-step.ts)
converts completed HTML work to the step outcome and preserves scan withholding.
`PipelineStep.execute` gives allow/block results; `HtmlTransformation.invoke`
updates HTML context. These are distinct protocols, not a generic Pipeline/Step
framework. Permission checks, invalid inputs, cancellation, withheld content,
and ordinary failures stay separate observable outcomes.

The [MCP server](../src/interfaces/mcp/mcp-server.ts) binds a copied, frozen access
context to each authenticated request and tracks its work and cleanup. Shutdown
aborts request work and drains owned servers/transports. The
[application lifecycle](../src/app/application.ts) closes MCP work, waits for
listener drain, then disposes provider resources. The
[HTTP listener](../src/runtime/http/server.ts) tracks sockets and bounds drain
with a grace period.

The shared [Lightpanda adapter](../src/pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts)
starts a child process for each fetch. It checks public destinations, sets
renderer network restrictions, bounds output/time, and removes timers/listeners
on completion. Cancellation kills the child. Search reaches Brave's public
HTML search page through that same adapter; it does not use a separate search
API service.

The local [Better Auth runtime](../src/accounts/providers/better-auth/better-auth-runtime.ts)
owns a data-directory lock and installation resources. The
[installation](../src/accounts/providers/better-auth/local-installation.ts)
keeps SQLite authentication/installation data, the secret, and the resource-server
client record together. Opening failure releases acquired resources; application
or CLI closure releases the database and lock. These files survive process
closure and must retain a consistent installation identity.

Hosted [composition](../src/app/hosted-workos-application.ts) shares a WorkOS SDK
client, remote key-set resolver, and organization directory. WorkOS owns remote
identity/organization data. Provider calls run during requests with a short
timeout and no SDK retry. Self-serve signup follows configured enablement and
approved documents. Google enrollment is an optional explicit composition;
production does not supply its onboarding settings.

## Design choices and current soft spots

The source uses a composition root and role-based adapters: app selects concrete
implementations while callers use supplied verifier, directory, engine, fetcher,
and step roles. Edition-specific dynamic imports keep provider startup separate.
Immutable [access records](../src/accounts/identity/access-context.ts) keep trusted
identity and permissions together. Ordered HTML transformations separate cleanup
operations; [ChangeRecording](../src/accounts/organizations/change-records.ts)
separates current checks from one directory mutation and records uncertain
outcomes without repeating a mutation. Disposable stacks and idempotent close
promises make ownership explicit. These are observed uses, not requirements to
add a class hierarchy or a shared workflow engine.

The following limits affect architectural decisions today:

- HTML safety and conversion depend on local [pinned patches](../pnpm-workspace.yaml)
  for agent-input-sanitizer 1.47.14, Defuddle 0.19.4, and LinkeDOM 0.18.13.
  Dependency upgrades must preserve deletion ranges, extraction checks, joiner
  handling, and attribute escaping. Use the existing affected interface and
  acceptance contracts described in the [README](../README.md) to verify them.
- Privileged account changes go to the operator log through
  [accountChangeRecorder](../src/app/application.ts). Step records are explicitly
  [best effort](../src/pipelines/execution/step-record.ts). Neither is a durable
  application audit store; log retention and delivery determine later evidence.
- [BillingFree](../src/accounts/billing/billing-free.ts) returns a free plan and
  zero billed seats, including after seat updates. The billing role is a seam,
  but there is no paid-plan implementation or durable seat billing here.
- The [Brave adapter](../src/pipelines/providers/search-engine/search-engine-brave-http.ts)
  validates specific HTML selectors and no-results text. Upstream page changes
  can reject search responses; the separate
  [result projection](../src/pipelines/html-processing/search-results/brave-http-result-cleanup.ts)
  also contains Brave document knowledge. Changes to that external format need
  review across both owners.
- Browser authentication is only partly provider-neutral. Web's
  [WorkOS session routes](../src/interfaces/web/auth/workos/workos-session-routes.ts)
  use selected provider roles/helpers, while local pages use a supplied
  Response-returning handler. A provider change must preserve each browser
  contract, cookie, Origin/CSRF, and return-path protection; a common provider
  interface alone does not cover this work.
- The application-wide hosted capacity slot bounds this process only. It rejects
  overlap instead of queuing work and does not coordinate multiple instances.
  A deployment change must account for that actual scope.

These statements identify source behavior and its effects. They do not assign
quality scores or claim that an unmeasured component needs a rewrite.
