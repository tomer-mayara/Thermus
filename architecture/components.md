# Component registry

This is the current architecture of Thermus. It describes component intent,
important collaborations, and known limits. The [review rules](../docs/implementation/pr-review-rules.yaml)
remain the machine authority for source ownership, public modules, and permitted
imports. This registry is not another import allowlist.

Use the [registry update workflow](../docs/implementation/component-registry-workflow.md)
when a change affects this view. Git history and pull request diffs show its
evolution. The [component structure proposal](../docs/design/component-structure-proposal.md)
records the migration design; this page describes the resulting system.

This baseline uses selected arc42 sections: context (3), building blocks (5),
runtime (6), and deployment (7). It does not fill the complete template.
[C4 notation](https://c4model.com/diagrams/notation) supplies element types,
responsibilities, technologies, and labelled relationships. A
[C4 container](https://c4model.com/diagrams/container) means an application,
process, or datastore; it does not mean a Docker container or a source folder.
The [arc42 building-block view](https://docs.arc42.org/section-5/) adds the
static decomposition. Ordinary Mermaid expresses these views without special
C4 syntax. Each heading gives the diagram type and scope.

## Context

C4 system context; scope: Thermus as one software system. Thermus converts
public pages and Brave HTML search results to cleaned Markdown for MCP clients,
and provides account and connection pages. External clients and websites are
outside its trust boundary. Local Better Auth belongs inside Thermus.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 260}}}%%
flowchart TB
  context_customer["Person: customer<br/>Uses tools and manages workspace access"]
  context_operator["Person: operator<br/>Runs and administers Thermus"]
  context_client["External software: MCP client<br/>Requests page fetch and search"]
  context_thermus["Software system: Thermus<br/>Authorized web-to-Markdown tools and account UI"]
  context_workos["External system: WorkOS / AuthKit<br/>Hosted identity and organizations"]
  context_public["External systems: public websites<br/>Includes Brave HTML search"]
  context_customer -->|uses tools through client| context_client
  context_customer -->|opens account and connection pages| context_thermus
  context_operator -->|configures installation / manages local accounts| context_thermus
  context_client -->|requests page fetch and search| context_thermus
  context_thermus -->|uses hosted identity and organizations| context_workos
  context_thermus -->|fetches public content| context_public
```

## arc42 building-block view

### C4 containers: hosted edition

Scope: Thermus hosted system. The browser portal is a separate browser
application. The Node server serves its assets and routes. Lightpanda is a
short-lived process container even when it shares the server's Docker image.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 260}}}%%
flowchart TB
  hosted_user["Person: customer<br/>Uses tools and manages access"]
  hosted_client["External software: MCP client<br/>Calls Thermus tools"]
  subgraph hosted_system["Software system: Thermus · hosted"]
    hosted_portal["Container: user portal<br/>Browser JavaScript / HTML / CSS<br/>Connection instructions and account UI"]
    hosted_server["Container: Thermus server<br/>Node.js / TypeScript<br/>MCP tools, account routes, authentication"]
    hosted_renderer["Container: renderer child<br/>Lightpanda<br/>Renders one public page per fetch"]
  end
  hosted_workos["External system: WorkOS / AuthKit<br/>Identity and organization services"]
  hosted_public["External systems: public websites<br/>Includes Brave HTML search"]
  hosted_user -->|uses in browser| hosted_portal
  hosted_client -->|MCP over HTTP / bearer token| hosted_server
  hosted_portal -->|HTTP account routes| hosted_server
  hosted_server -->|serves portal assets over HTTP| hosted_portal
  hosted_server -->|SDK HTTPS / JWT key set| hosted_workos
  hosted_server -->|execFile / stdout JSON| hosted_renderer
  hosted_renderer -->|HTTP / HTTPS page requests| hosted_public
```

### C4 containers: local edition

Scope: Thermus self-hosted system. Better Auth is built into the server;
it is not an external service. Local authentication pages are server-generated
HTML responses, not a second browser application. The operator runs CLI
administration while the server is stopped, using the same installation data.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 260}}}%%
flowchart TB
  local_operator["Person: operator<br/>Manages the local installation"]
  local_browser["External software: browser<br/>Displays generated authentication pages"]
  local_client["External software: MCP client<br/>Calls Thermus tools"]
  subgraph local_system["Software system: Thermus · local"]
    local_server["Container: Thermus server<br/>Node.js / TypeScript + Better Auth<br/>MCP tools and generated auth pages"]
    local_cli["Container: administration CLI<br/>Node.js / TypeScript<br/>User and client commands"]
    local_renderer["Container: renderer child<br/>Lightpanda<br/>Renders one public page per fetch"]
    local_data["Container: installation datastore<br/>SQLite and files<br/>Accounts, keys, secret, installation identity"]
  end
  local_public["External systems: public websites<br/>Includes Brave HTML search"]
  local_operator -->|runs terminal commands| local_cli
  local_browser -->|HTTP auth requests / form submissions| local_server
  local_server -->|HTTP generated HTML / cookies| local_browser
  local_client -->|MCP over HTTP / bearer token| local_server
  local_server -->|SQLite / filesystem, locked installation| local_data
  local_cli -->|SQLite / filesystem, locked installation| local_data
  local_server -->|execFile / stdout JSON| local_renderer
  local_renderer -->|HTTP / HTTPS page requests| local_public
```

### Containers and source owners

This mapping lists principal contributors from the 19 stable registry IDs
without turning them into 19 containers. Owners are logical source boundaries;
some contribute code to both server and CLI. The [Ownership](#ownership) table retains the full source
roots, responsibilities, and public contracts.

| Container or artifact | Registry owners that contribute |
| --- | --- |
| Both Node server editions | `app`, `config`, `http`, `logging`, `mcp`, `web`, `identity`, `execution`, `page-fetch`, `search`, `html-processing`, `website-fetcher`, `search-engine` |
| Hosted server additions | `organizations`, `billing`, `workos` |
| Local server addition | `better-auth` |
| Local administration CLI | `app`, `cli`, `config`, `http` (client-address helper), `logging`, `identity`, `better-auth` |
| Hosted browser application and build assets | `user-portal`; app's `HostedPortal` loads its built files |
| Renderer process | External Lightpanda binary, controlled by `website-fetcher`; no new source owner |
| Local installation datastore | Opened and owned by `better-auth`; no new source owner |

### Selected C4 components: tool processing in the Node server

Scope: one Thermus Node server container, in either edition. Each component
box gives its stable owner ID, responsibility, and technology. Solid arrows
show selected collaborations through supplied roles or directly held objects;
they do not assert source imports of the selected implementation. Thick arrows
show app composition. The [review rules](../docs/implementation/pr-review-rules.yaml)
remain the complete source-import policy. Supporting process containers and
external systems sit outside the server boundary.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 260}}}%%
flowchart TB
  subgraph tool_server["Container: Thermus Node server · either edition"]
    tool_root["Component: app<br/>Construct and share tool collaborators<br/>TypeScript"]
    tool_mcp["Component: mcp<br/>Adapt authorized tool requests and results<br/>TypeScript"]
    tool_fetch["Component: page-fetch<br/>Check URL and permission, coordinate fetch<br/>TypeScript"]
    tool_search["Component: search<br/>Check query and permission, coordinate search<br/>TypeScript"]
    tool_execution["Component: execution<br/>Step roles, observation and execution records<br/>TypeScript"]
    tool_html["Component: html-processing<br/>Clean HTML and produce Markdown<br/>TypeScript"]
    tool_engine["Component: search-engine<br/>Build and validate Brave HTML search<br/>TypeScript"]
    tool_fetcher["Component: website-fetcher<br/>Validate destinations and bound rendering<br/>TypeScript"]
  end
  tool_child["Container: renderer child<br/>Render one public page<br/>Lightpanda"]
  tool_web["External systems: public websites<br/>Pages and Brave HTML search"]
  tool_root ==>|constructs / supplies tool operations| tool_mcp
  tool_root ==>|constructs / supplies fetch collaborators| tool_fetch
  tool_root ==>|constructs / supplies search collaborators| tool_search
  tool_mcp -->|calls supplied fetch operation| tool_fetch
  tool_mcp -->|calls supplied search operation| tool_search
  tool_fetch -->|uses outgoing observer / execution records| tool_execution
  tool_search -->|uses outgoing observer / execution records| tool_execution
  tool_fetch -->|calls supplied IncomingStep| tool_html
  tool_search -->|calls supplied IncomingStep| tool_html
  tool_fetch -->|calls supplied WebsiteFetcher| tool_fetcher
  tool_search -->|calls supplied SearchEngine| tool_engine
  tool_engine -->|calls supplied WebsiteFetcher| tool_fetcher
  tool_fetcher -->|execFile / stdout JSON| tool_child
  tool_child -->|HTTP / HTTPS page requests| tool_web
```

[Tool composition](../src/app/fetch-tool.ts) shares one fetcher, ad cleaner,
sanitizer, observer, record sink, and renderer-report closures between both
operations. Each tool has its own `ProcessHtmlStep`, HTML runner, and Markdown
converter. Fetch uses ads → sanitizer → Markdown; search inserts Brave
projection before Markdown. [PipelineStep](../src/pipelines/execution/pipeline-step.ts)
and [HtmlTransformation](../src/pipelines/html-processing/html-to-markdown-pipeline.ts)
are distinct protocols, not a generic pipeline engine. `ProcessHtmlStep`
implements the execution-owned incoming role; callers need not import its
concrete class. Each operation has fresh execution and HTML context. Hosted
composition wraps fetch and search in one application-wide capacity slot.

### Selected C4 components: hosted authentication in the Node server

Scope: one hosted Node server container. The browser application and WorkOS
service remain outside that boundary. Role use follows calls on supplied
collaborators; it does not reverse the source dependency from provider
implementations to neutral contracts.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 260}}}%%
flowchart TB
  hosted_portal["Container: user portal<br/>Account and connection UI<br/>Browser JavaScript / HTML / CSS"]
  subgraph account_server["Container: Thermus Node server · hosted"]
    account_root["Component: app<br/>Select edition and bind account roles<br/>TypeScript"]
    account_web["Component: web<br/>Account and provider-specific browser routes<br/>TypeScript"]
    account_mcp["Component: mcp<br/>Authenticate and bind request access<br/>TypeScript"]
    account_identity["Component: identity<br/>Trusted access records and neutral auth contracts<br/>TypeScript"]
    account_org["Component: organizations<br/>Check current customer roles and invitations<br/>TypeScript"]
    account_billing["Component: billing<br/>Free-plan state and seat-update role<br/>TypeScript"]
    account_workos["Component: workos<br/>Verify access, manage sessions and directory<br/>TypeScript / WorkOS SDK"]
  end
  hosted_workos["External system: WorkOS / AuthKit<br/>Remote identity and organization data"]
  hosted_portal -->|HTTP account routes| account_web
  account_root ==>|constructs / supplies session and account roles| account_web
  account_root ==>|constructs / supplies verification roles| account_mcp
  account_web -->|calls supplied BrowserSession / AccessResolver| account_workos
  account_mcp -->|calls supplied IdentityVerifier / AccessResolver| account_workos
  account_web -->|requests account administration| account_org
  account_org -->|calls supplied OrganizationDirectory| account_workos
  account_org -->|calls supplied Billing| account_billing
  account_workos -->|creates trusted access records| account_identity
  account_workos -->|SDK HTTPS / JWT key set| hosted_workos
```

[Hosted composition](../src/app/hosted-workos-application.ts) shares a WorkOS
SDK client, key-set resolver, and directory and selects `BillingFree`.
[WorkOSAuthProvider](../src/accounts/providers/workos/workos-auth-provider.ts)
implements identity-owned verifier/resolver contracts;
[WorkOSOrganizations](../src/accounts/providers/workos/workos-organizations.ts)
implements the organizations-owned directory role. `WorkOSBrowserSession`
implements the identity-owned `BrowserSessionControls`, including profile data
for display. Signup uses the organizations-owned `SignupActivation` contract.
The web routes use these neutral contracts; WorkOS cookie and document-validation
helpers remain provider-specific. Composition supplies the portal's allowed
form destinations. Profile data does not grant access.

### Selected C4 components: local authentication in the Node server

Scope: one local Node server container. Offline CLI administration belongs to
a separate process, shown in the container view and source-owner mapping.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 260}}}%%
flowchart TB
  local_browser["External software: browser<br/>Displays generated authentication HTML"]
  subgraph local_auth_server["Container: Thermus Node server · local"]
    local_root["Component: app<br/>Open installation and supply authentication roles<br/>TypeScript"]
    local_web["Component: web<br/>Generated sign-in and consent pages<br/>TypeScript"]
    local_mcp["Component: mcp<br/>Authenticate and bind request access<br/>TypeScript"]
    local_identity["Component: identity<br/>Trusted access records and neutral auth contracts<br/>TypeScript"]
    local_better["Component: better-auth<br/>Local verification, provider handler and installation<br/>TypeScript / Better Auth"]
  end
  local_data["Container: installation datastore<br/>Accounts, keys and installation identity<br/>SQLite / filesystem"]
  local_browser -->|HTTP auth requests / form submissions| local_web
  local_root ==>|binds runtime handler to web ProviderHandler| local_web
  local_root ==>|supplies verifier and resolver| local_mcp
  local_web -->|calls supplied ProviderHandler| local_better
  local_mcp -->|calls supplied IdentityVerifier / AccessResolver| local_better
  local_better -->|creates trusted access records| local_identity
  local_better -->|SQLite / filesystem reads and writes| local_data
```

[Application composition](../src/app/application.ts) uses edition-specific
dynamic imports. It supplies `runtime.auth.handler` to
[LocalAuthPages](../src/interfaces/web/auth/better-auth/local-auth-pages.ts)
through the web-owned [ProviderHandler](../src/interfaces/web/auth/better-auth/local-auth-provider-routes.ts)
function contract. The collaboration arrow above is that supplied call, not a
source import from web to Better Auth. The provider implements neutral
identity contracts. Local composition does not construct hosted organization
administration. The [Better Auth runtime](../src/accounts/providers/better-auth/better-auth-runtime.ts)
owns its database and data-directory lock until app or offline CLI closure.
App closes request work before provider resources. HTTP listener drain and
logging sinks retain their responsibilities in the source-owner mapping.

## Runtime view

arc42 section 6 describes runtime scenarios. The collaboration overview below
keeps the broad map; the sequences show selected request and failure paths.
They follow [arc42 runtime guidance](https://docs.arc42.org/section-6/).

### Collaboration overview

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

### Scenario: MCP page fetch and renderer cancellation

Scope: one authenticated MCP fetch in either server edition. The hosted server
adds a shared capacity slot after authentication and access resolution. Role
participants can be implemented by either selected provider. The incoming HTML
work runs only when rendering succeeds. Cancellation holds the hosted slot
until renderer completion and cleanup settle.

```mermaid
%%{init: {"sequence": {"wrap": true, "actorMargin": 20, "width": 140}}}%%
sequenceDiagram
  actor Client as MCP client
  participant MCP as mcp / request adapter
  participant Auth as Auth provider / identity roles
  participant Tools as app / tool operation
  participant Adapter as mcp / fetch projection
  participant Fetch as page-fetch / fetch operation
  participant Renderer as website-fetcher / renderer adapter
  participant Child as Lightpanda child process
  participant HTML as html-processing / IncomingStep
  Client->>MCP: HTTP MCP call with bearer token and URL
  MCP->>Auth: Verify identity and resolve current access
  alt Invalid token or access denied
    Auth-->>MCP: Reject / deny
    MCP-->>Client: Authentication or access error
  else Trusted access context
    MCP->>Tools: Fetch URL with context and AbortSignal
    Note over Tools: Hosted: acquire shared fetch/search capacity or return busy
    Tools->>Adapter: Invoke supplied fetch tool wrapper
    Adapter->>Fetch: Run fetch operation
    Fetch->>Fetch: Check permission and URL, run outgoing step
    Fetch->>Renderer: Fetch validated destination with signal
    Renderer->>Child: execFile fetch, capture JSON / HTML output
    alt Request cancellation or server shutdown
      MCP->>Renderer: Abort propagated through supplied signal
      Renderer->>Renderer: Remove timers and abort listener
      Renderer->>Child: Kill child with SIGKILL
      Child-->>Renderer: Process completion callback
      Renderer->>Renderer: Reject cancellation after callback
      Renderer-->>Fetch: Cancellation
      Fetch-->>Adapter: Cancellation
      Adapter-->>Tools: Operation settles
      Note over Tools: Hosted: release capacity in finally
      Tools-->>MCP: Cancellation error
      MCP->>MCP: Classify cancellation and record safe completion
    else Render completes
      Child-->>Renderer: Rendered page / completion callback
      Renderer->>Renderer: Remove timers/listeners
      Renderer-->>Fetch: WebsiteFetchResult
      Fetch->>HTML: IncomingStep.execute(page, signal)
      HTML-->>Fetch: Markdown or withheld outcome
      Fetch-->>Adapter: Released Markdown or withheld outcome
      Adapter->>Adapter: Map withheld to empty Markdown string
      Adapter-->>Tools: Markdown string, possibly empty
      Note over Tools: Hosted: release capacity in finally
      Tools-->>MCP: Markdown string
      MCP->>MCP: Record tool completion
      MCP-->>Client: Text success, including empty text
    end
  end
```

[Request authentication and shutdown](../src/interfaces/mcp/mcp-server.ts),
[tool adaptation](../src/interfaces/mcp/fetch-tool-server.ts),
[fetch ordering](../src/pipelines/page-fetch/fetch-page.ts), and
[renderer cleanup](../src/pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts)
provide the contracts. HTTP disconnect handling and MCP shutdown propagate
cancellation; a disconnected client cannot receive a final response. Ordinary
failures, invalid inputs, blocked content, and cancellation remain distinct
inside the pipeline. The MCP-owned fetch wrapper maps withheld content to empty
Markdown text success. MCP records the safe completion status in its finalizer.

### Scenario: hosted member read

Scope: GET `/members` in the hosted Node server. The WorkOS adapter participant
groups the session, access resolver, and shared directory; each return follows
the request through that adapter. A signed-in session alone does not authorize
the read. Organization administration checks current Admin authority before
reading the overview. This groups remote reads, not a remote transaction.

```mermaid
%%{init: {"sequence": {"wrap": true, "actorMargin": 20, "width": 140}}}%%
sequenceDiagram
  actor Browser as Customer browser
  participant Routes as web / account routes
  participant Provider as workos / auth and directory
  participant Admin as organizations / admin rules
  participant Remote as WorkOS service
  Browser->>Routes: GET /members with Cookie
  Routes->>Provider: Authenticate cookie
  Provider->>Remote: Session validation / refresh when needed
  Remote-->>Provider: Session facts
  alt Signed out
    Provider-->>Routes: Signed-out state and cookie effects
    Routes-->>Browser: Signed-out notice with cookie effects
  else Signed-in session
    Provider-->>Routes: User and cookie effects
    Routes->>Provider: Resolve current access
    Provider->>Remote: Read current organization grants
    Remote-->>Provider: Current membership and roles
    alt Access denied
      Provider-->>Routes: Deny
      Routes-->>Browser: Access notice with cookie effects
    else Access allowed
      Provider-->>Routes: Trusted organization context
      Routes->>Admin: memberOverview(actor, organization)
      Admin->>Provider: Read current memberships and managed roles
      Provider->>Remote: Read current membership / role state
      Remote-->>Provider: Current facts
      Provider-->>Admin: Memberships and roles
      alt Actor cannot manage organization
        Admin-->>Routes: Denied
        Routes-->>Browser: Refusal page with cookie effects
      else Actor authorized
        Admin->>Provider: Read member overview
        Provider->>Remote: Read memberships, roles and users
        Remote-->>Provider: Member data
        Provider-->>Admin: Member overview data
        Admin-->>Routes: Authorized overview
        Routes-->>Browser: HTML member overview with cookie effects
      end
    end
  end
```

[Account routes](../src/interfaces/web/account/account-routes.ts) authenticate
before access resolution. Signed-in route failures are reported and become a
request-failed page with the session cookie effects; a failure during initial
session authentication follows the outer failure handler instead.
[Administration routes](../src/interfaces/web/account/administration-routes.ts)
permit GET/HEAD reads without a CSRF check.
[OrganizationAdministration](../src/accounts/organizations/organization-administration.ts)
checks current Admin authority before reading the overview. The
[shared directory](../src/accounts/providers/workos/workos-organizations.ts)
reads current remote state. Privileged mutations and their recording rules
remain described under resource ownership and design choices below.
The former POST `/members/grants` route is absent. A request with current account
access reaches the existing 404 response after the session and access checks. The Members
page has no grant forms, and neither administration nor the directory exposes
a grant writer. Admin manages native invitations for User or Admin. Both roles
permit product and MCP access in their authorized organization. Unknown/default
grants give no access; invalid role catalogs fail closed. Browser sessions report
`mfaCompleted: false`, including retained cookies on read, refresh, and selection.
The member overview counts each active product-authorized membership once,
including Admin alone, and labels the count Active product members. These access
changes add no provider, process, datastore, or component boundary.

## Deployment view

C4 deployment view; scope: source-defined local topology and recorded hosted
target. This is not a live cloud inventory. The
[self-hosted Compose contract](../compose.yaml) runs one Docker container;
its Node server and per-fetch Lightpanda child are two C4 process containers
inside that same Docker boundary. An offline CLI uses the same image and data
volume while the server is stopped. A data-directory lock prevents concurrent
installation ownership.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 260}}}%%
flowchart TB
  subgraph deploy_local["Deployment alternative: self-hosted Compose"]
    deploy_loopback["Host endpoint<br/>127.0.0.1:8080"]
    subgraph deploy_local_docker["Docker container · Thermus image"]
      deploy_local_node["Node server process<br/>HTTP :8080 / local edition"]
      deploy_local_child["Lightpanda child process<br/>Per fetch / same image"]
    end
    deploy_volume["Named volume: thermus-data<br/>/var/lib/thermus · SQLite and secrets"]
    deploy_rules["Read-only bind mount<br/>/etc/thermus/ad-rules.txt"]
    deploy_loopback -->|published port| deploy_local_node
    deploy_local_node -->|execFile / stdout JSON| deploy_local_child
    deploy_local_node -->|SQLite / filesystem, locked directory| deploy_volume
    deploy_rules -->|startup rules read| deploy_local_node
  end
  subgraph deploy_hosted["Recorded target: hosted Render web service"]
    deploy_edge["Render HTTPS edge<br/>Recorded ingress target"]
    subgraph deploy_hosted_docker["Docker container · hosted image"]
      deploy_hosted_node["Node server process<br/>HTTP :8080 / portal + account + MCP"]
      deploy_hosted_child["Lightpanda child process<br/>Per fetch / same image"]
    end
    deploy_edge -->|HTTP forwarding to :8080| deploy_hosted_node
    deploy_hosted_node -->|execFile / stdout JSON| deploy_hosted_child
  end
  deploy_workos["External system: WorkOS / AuthKit<br/>HTTPS identity / organization services"]
  deploy_public["External systems: public websites<br/>HTTP / HTTPS pages and Brave HTML"]
  deploy_hosted_node -->|HTTPS SDK / key set| deploy_workos
  deploy_hosted_child -->|HTTP / HTTPS| deploy_public
  deploy_local_child -->|HTTP / HTTPS| deploy_public
```

[Dockerfile](../Dockerfile) pins Node and Lightpanda, runs as the `node` user,
and selects self-hosted operation. [Dockerfile.hosted](../Dockerfile.hosted)
includes the built portal and trusted rules and selects hosted operation.
The [recorded Render topology](../docs/implementation/render-hosted-docker-plan.md)
describes one service/process target with no separate frontend, database,
Redis, disk, or worker. The record is dated evidence, not current cloud
verification; current replica count and cloud configuration are unknown here.
Compose publishes only loopback HTTP. A different public address requires the
HTTPS reverse proxy described by the installation contract; this diagram does
not invent that infrastructure.

## Ownership

The 19 IDs below are stable logical component names. Each root owns its source
files recursively. `app` also owns exactly `src/index.ts`. The directories
`accounts`, `accounts/providers`, `interfaces`, `pipelines`,
`pipelines/providers`, and `runtime` group components; they do not own code.
Private subdirectories below an owner are implementation areas, not separate
components. These source owners are logical boundaries in the Thermus codebase.
They do not define deployment units.

Public boundaries use named modules, not a barrel. App has construction access
to concrete implementations. That access does not make every implementation
module a contract for other callers. The review rules define the exact checked
surface and the narrower file-context restrictions.

| Stable ID and source root | Responsibility and main parts | Boundary |
| --- | --- | --- |
| `app` — [`src/app/`](../src/app/), plus [`src/index.ts`](../src/index.ts) | Select hosted or self-hosted operation; construct providers, routes, tools, logs, and shared services; own startup, shutdown, capacity, portal loading, and hidden terminal input. | Entrypoint and application lifecycle; documented [tool composition](../src/app/fetch-tool.ts). Other components do not import app. |
| `identity` — [`src/accounts/identity/`](../src/accounts/identity/) | Define authenticated users, grants, immutable request contexts, permission checks, verification, browser sessions and profile controls, and local administration roles. | [Access context](../src/accounts/identity/access-context.ts), verifier, browser-session, browser-session-controls, and local-user-administration contracts. No provider or UI implementation belongs here. |
| `organizations` — [`src/accounts/organizations/`](../src/accounts/organizations/) | Customer roles, administration rules, member/invitation overviews, directory reads and native invitations, signup activation, seat calculations, and privileged change recording. | Directory, administration, overview, customer-role, change-record, and signup-activation modules. Directory-read helpers remain private. |
| `billing` — [`src/accounts/billing/`](../src/accounts/billing/) | Report plan state and accept seat updates. `BillingFree` is the current implementation. | [Billing roles](../src/accounts/billing/billing.ts); app selects the implementation. |
| `workos` — [`src/accounts/providers/workos/`](../src/accounts/providers/workos/) | Hosted token/access verification, sessions, organization operations, signup/onboarding, settings, cookies, and signup-document validation. | App constructs provider/SDK objects. Web uses neutral supplied session, signup, and account roles; its WorkOS auth area still uses provider cookie and document-validation helpers. |
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
and ordinary failures are distinct pipeline contract outcomes. The MCP fetch
[projection](../src/interfaces/mcp/get-url-as-markdown.ts) maps withheld content
to empty Markdown text success; clients cannot distinguish it from an ordinary
empty result. This baseline records that behavior; it does not change it.

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
  use neutral session controls but retain provider cookie helpers; signup uses
  a neutral activation contract with provider document validation. Local pages
  use a supplied Response-returning handler. A provider change must preserve each browser
  contract, cookie, Origin/CSRF, and return-path protection; a common provider
  interface alone does not cover this work.
- The application-wide hosted capacity slot bounds this process only. It rejects
  overlap instead of queuing work and does not coordinate multiple instances.
  A deployment change must account for that actual scope.

These statements identify source behavior and its effects. They do not assign
quality scores or claim that an unmeasured component needs a rewrite.
