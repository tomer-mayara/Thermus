# User portal

The browser portal is in `src/interfaces/user-portal/`. It uses TypeScript and Vite. It
shares `package.json` and `pnpm-lock.yaml` with the server. Install and build
it from the repository root with Node 24 and pnpm 12.10.1.

```sh
pnpm install
pnpm typecheck:user-portal
pnpm test:user-portal
pnpm build:user-portal
```

The build writes `src/interfaces/user-portal/dist/`: `index.html` and the files in
`assets/`. The portal reads no build setting and keeps no secret.

## Public entry

The portal reads the session before it shows the public entry or workspace.
The public entry uses the [approved design](design/portal-design.md) and its
exact product copy. Sign in opens `login`. Start free access opens `signup`.
These are native links. The signup route decides whether activation is open
and whether the user can activate access. The public page does not grant access.
The **Start free** link of the marketing site opens
`https://app.thermus.ai/signup?tier=free`. Only the free tier exists, so the
route ignores the `tier` value (SO-07). The
[free subscription guide](free-subscription-guide.md) gives the switch and a
test signup.

The desktop page shows a static flow with three nodes. Agents send Request +
reason to Thermus, and Thermus sends Approved requests to the web. Raw pages
return from the web to Thermus. Clean content returns from Thermus to the
agents. The flow has an accessible text description. It describes the product;
it does not add an approval step to the server.

Below 960px, the page stacks the brand copy above the welcome card and hides
the diagram. The copy remains complete. Each primary action is at least 48px
high. A skip link moves keyboard focus to the main content. Links and buttons
have a visible focus ring. Session errors retain their safe message and offer
Try again, which reloads the entry through its normal server route.

The header uses the exact Thermus dark logo. The logo opens the portal, and
`thermus.ai` opens the marketing website. Footer links open that website's
Privacy Notice and Terms of Service at `https://thermus.ai/privacy` and
`https://thermus.ai/terms`. The product activation documents remain on signup.

The logo, favicon, and IBM Plex Sans, Serif, and Mono font files are in
`src/interfaces/user-portal/public/assets/`. Vite copies them into the flat output asset
directory. The fonts use the SIL Open Font License. The unmodified license is
shipped beside them as `assets/plex-OFL.txt`. The logo and font files come from
the existing Thermus marketing design kit. No third-party font request is made.

## Server-owned session

The hosted Thermus server owns the browser session. The portal keeps no
session and no token of its own. The server signs in through WorkOS AuthKit,
keeps the session in a sealed `HttpOnly`, `Secure`, `SameSite=Lax` cookie, and
signs out. The [authentication design](design/authentication-design.md#hosted-browser-sessions)
gives the rules of the session.

The portal must be on the same origin as the server, at the public base path
of the server. It uses these server paths, relative to the base path:

| Path | Use in the portal |
| --- | --- |
| `session` | `GET` on load. `401` shows the signed-out page. `200` gives the profile, the organization of the session, the MFA evidence, and the form token of the session. |
| `portal/access` | `GET` after a sign-in: the protected portal request. The server checks the session and reads the current grants of the selected organization. `200` gives the organization, its roles, its plan, and the configured `mcpUrl` when the user has User. Since SO-08, the plan is `"free"` with `memberLimit`, a whole number of 1 or more (5 today), or `"team"` without a limit; the portal refuses another plan, or a free plan without a valid limit, with the safe error. On the free plan, the portal shows free access, no card requirement, and no automatic charge; the team plan has no free-access line. Both show the native MCP connection steps. `403` shows signup and organization selection links. Signup can remain closed. |
| `workspace/status` | `GET` after a `200` of `portal/access`: the state of the tenant of the selected organization (SO-07). `200` gives `state`, `ready`, and the words of the server in `message`: while the workspace is not ready, and for a paused workspace, the notice of the pause (SO-10). The portal shows the connection guide only when `ready` is `true`, after the notice when there is one; else it shows the words. The read can request a missing tenant, so the server needs current product access in the organization that the session selected; without it, the answer is the `403` of `portal/access`. Another answer gives the safe error. |
| `login` | The Sign in link opens it. The server starts the AuthKit sign-in. |
| `logout` | The Sign Out button posts a form with the `csrf_token` field. The server checks the origin and the token, clears the session cookie, and sends the browser to the WorkOS logout URL. |
| `organizations` | The organization page of the server: onboarding guidance or the organization selection. |
| `quick-start` | The server-owned setup guide for a current Admin of the selected organization. The server checks the session, current product access, and Admin role before it renders the guide. |

The profile and the organization ID that the portal shows are display data.
They never select a tenant or give access. Each protected request uses the
verified server session and a current read of the grants. A sign-in alone
gives no User access.

Organization selection returns to Connect at the public base path by default,
including when the user chooses the selected workspace again. An explicit safe
return destination keeps its exact path. This selection affects only
this browser. To connect a native MCP client, add the displayed endpoint as a
remote HTTP server, sign in, choose the intended workspace in client consent,
approve the connection, and fetch a page. The client's verified Connect token
sets the MCP workspace through its `org_id`. A browser workspace change does
not change that token or move an existing client connection.

The signed-in Admin header uses compact underline links in this order: Quick
start, Connect, Switch Workspace, Members, Audit Log. Quick start, Members, and
Audit Log appear only when the current product access response includes the
exact `admin` role. The current page link has `aria-current="page"`.
The links wrap on narrow screens and keep
48px targets and visible keyboard focus. The protected routes still check access
independently. Members keeps the trusted workspace name above the same menu.
The organization picker keeps that menu with Switch Workspace active. It reads
current access only to decide whether to show Admin links. A failed lookup or
missing current access leaves the picker available with Connect and Switch
Workspace. Roles in another workspace cannot show Admin links.

## Admin Quick start

After successful organization creation and selection, the first Admin opens
Quick start with the new organization's name. Later sign-ins and normal
workspace choices keep the Connect destination. Quick start remains the first
Admin menu item after the first visit.

The page gives three steps: restrict direct Internet access in the agents and
connect Thermus, configure audit logs, and invite users. It links to the
existing Connect, Audit Log, and Members pages. Provider guidance explains that
web, shell, cloud, and connector controls have different scopes. Thermus does
not enforce those external settings or show setup completion. Identity-provider
enrollment is marked Planned and has no configuration action.

Copy guide as Markdown copies the full approved
[guide](design/admin-quick-start/guide.md), including provider details when
closed, with the current organization name and trusted absolute portal and MCP
URLs. The copy contains no credentials, session values, member list, invitation
links, or log records. A status region reports Copied only after the clipboard
write succeeds. When a write fails or the clipboard is unavailable, the page
shows selectable Markdown for manual copy.

The server resolves the selected organization from the authorized session and
checks current Admin access on every request. Navigation visibility gives no
access. A User, a stale Admin, or an Admin of another workspace cannot read the
selected organization's Admin guide by opening its URL directly.

## Workspace setup state

With `MCP_TENANTS_ENABLED` on, each organization gets its own tenant container
([self on-boarding plan](implementation/self-onboarding-plan.md#42-flows)).
Signup requests the tenant of a new organization, and the first deploy is live
about one and a half minutes after its create call. Until the tenant is live,
Connect shows the state of the workspace in place of the connection guide:

| State of the tenant | Connect shows |
| --- | --- |
| `requested`, `creating`, `deploying` | "Setting up your workspace. This takes about two minutes." |
| `failed` | "Workspace setup failed. We have been notified and will fix it." The first read of the state writes one `Workspace setup failed:` line at the level ERROR for the operator. |
| No tenant and a full free-tenant cap | "All free workspaces are in use. Try again later." Each read requests the tenant again, until a place frees. |
| `deleted` | "Your workspace is not available. Contact Thermus support." |
| The registry cannot be read | "The service is temporarily unavailable. Try again in 15 seconds." |
| `live` | The connection guide. |
| `suspended` | The notice "Your workspace was paused after 14 days without use. It restarts on the next request, which can take about a minute." above the connection guide (SO-10). The number is that of `FREE_TENANT_IDLE_DAYS`, 14 by default. The gateway resumes the tenant at the next MCP call; while the resume deploys, for about a minute, the row is `deploying`, so Connect shows the words of the setup. |

The words of a workspace that is not ready are a status region. While they
show, the page has a meta refresh of 5 s, so the browser reloads it without a
script timer and reads the state again. The notice of a paused workspace has no
refresh, because the workspace restarts only at the next MCP call. The words are
those of the MCP gateway for the same states, except the words of the setup and
the notice of the pause. With `MCP_TENANTS_ENABLED` off, the control plane serves the tools
itself, so each workspace is `live` and Connect shows the connection guide.

Quick start stays as approved. Its step 1 sends the Admin to Connect for the
connection guide, so the first Admin sees the setup state there and the guide
when the tenant is live. Steps 2 and 3, the audit logs and the members, need no
tenant.

## MCP setup guides

Choose CLI or Desktop and Web Apps above the client list. CLI starts with Claude Code
and also offers Codex CLI. Desktop and Web Apps starts with Claude (web / desktop)
and also offers Codex app, ChatGPT (web setup), Cursor, VS Code, and Other MCP
client. Each method keeps its last app selection while the page is open.
Changing a method or app makes no server request.

Desktop guides use the app's connector or MCP settings and the displayed
server URL. Cursor uses its documented `~/.cursor/mcp.json` configuration.
ChatGPT setup and its Work chat instructions explicitly use the web app.
Each guide links to the official instructions, gives the browser consent
steps, and includes a prompt to try Thermus. The endpoint comes from the
server. Copy buttons announce success after the clipboard write completes,
or show how to copy manually if the write fails.

## Deployment

The production hosted application serves `src/interfaces/user-portal/dist/` itself. Run
`pnpm build:user-portal` before startup. Its package import
`#hosted-portal/*` resolves the build in source and emitted server layouts.
The public base path must be `/`, because the Vite build uses absolute asset
paths. There is no portal path setting or SPA catch-all.

At startup, the application loads `index.html` and its flat `assets/` directory
into memory. Each asset must be a nonempty regular file with an ASCII name that
starts with a letter or digit and contains only letters, digits, `.`, `_`, or
`-`. Directories and symlinks are refused. The index must reference a built
JavaScript module. Every script and stylesheet reference must name a loaded
asset. A missing or invalid build stops startup before listening and asks for
`npm run build:user-portal`. A changed build takes effect after restart.

- `GET` and `HEAD /` give `index.html`.
- `GET` and `HEAD /assets/<file>` give only loaded assets. A path under
  `/assets/` outside the loaded map gives `404`; the server does no request-time
  file lookup.
- `GET` and `HEAD /healthz` give constant `200` after local startup checks;
  other methods give `405` with `Allow: GET, HEAD`. Health calls no provider
  and renders no page.
- Each other request goes unchanged to the existing application, including
  non-read requests to `/` and asset paths, auth, account, `/mcp`, and root
  protected-resource metadata. The wrapper retains request bodies, abort
  signals, and application cleanup.

Portal and asset responses have their content type and length,
`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and
`X-Frame-Options: DENY`. Their Content Security Policy allows each redirect of
the sign-out. Chrome also applies `form-action` to redirects after a form post.
The sign-out form posts to `logout`. The server redirects to the WorkOS logout
URL at `https://api.workos.com`, then to `<AuthKit origin>/api/logout`, then to
the portal Sign-out URI. With AuthKit origin `https://auth.example.com`, the
server sends:

```text
default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.workos.com https://auth.example.com
```

The CSP uses the origin of `WORKOS_AUTHKIT_ISSUER`. It adds no broad CORS
policy. Hosted MCP separately permits an absent `Origin` for native clients
or the exact serialized public origin; other values get `403` before
authentication. Browser CSRF checks keep their existing rules.

Hosted MFA evidence follows `WORKOS_MFA_POLICY`. The default `optional`
policy gives false evidence for every method and ignores older cookie
evidence. Product access still needs User; members, invitations, billing, and
administration changes stay refused without MFA evidence. No step-up UI is
added. Required can infer evidence from Password only under its explicit,
live-verified provider requirement. The work slice always keeps evidence false.

The hosted live gate uses this layout at `https://localhost:24443/`. Its local
HTTPS test server, `test/support/hosted-live/local-https-site.ts`, makes a
self-signed certificate for each run and forwards every request to the
production hosted application. Thus the live browser checks use the production
portal responses and CSP. The command needs the actual pinned renderer at an
absolute `LIGHTPANDA_BIN` path for the local startup check. The
[auth WorkOS MCP URL fetch work slice](../test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md)
runs the same local HTTPS site at the same origin, with a certificate that
stays, so that a person trusts it one time. The custom development composition
keeps a portal served by the HTTPS front. Its hosted composition also has the
fetch tool and an opt-in onboarding policy. Only the slice enrolls an absent
membership as User after a trusted WorkOS `GoogleOAuth` sign-in with a verified
email whose domain is exactly `thermus.ai`. The callback selects the configured
`THERMUS_SLICE_ORGANIZATION_ID` in the browser session; existing roles and
membership status are preserved. Normal hosted startup has no such policy.
Sign in to the portal first, then open the client's separate Connect browser
authorization. The portal cookie is not an MCP credential. The gate and the
slice cannot run at the same time. The WorkOS
staging environment has these settings for both:

- Redirect URI (the default): `https://localhost:24443/callback`.
- Default Sign-out URI: `https://localhost:24443/`.
- Initiate login URI: `https://localhost:24443/login`. A visit to the AuthKit
  domain without a sign-in request goes through
  `https://api.workos.com/user_management/initiate_login` to this route, which
  starts the sign-in.
- MCP resource indicator: `https://localhost:24443/mcp`.
- CORS origins: none. The portal makes no request to WorkOS.

The production application sends the Content Security Policy above with the
AuthKit origin of staging. The custom development front uses the same policy.

For another deployment, replace the origin in each of these settings and in
`PUBLIC_BASE_URL` and `WORKOS_REDIRECT_URI`.

## Tests

`pnpm check` checks portal types, runs its unit and acceptance tests, and
builds its browser bundle. `pnpm test`, `pnpm test:unit`, and
`pnpm test:acceptance` include the applicable portal tests. These tests use a
double of the server and a local DOM. Public entry cases cover the exact copy,
action and footer destinations, the flow's accessible description, native
links, and error recovery. Existing cases cover signed-in profile display,
access, workspace selection, safe server values, and the sign-out form. Setup
cases cover method-specific apps, app selection without new requests, the
configured endpoint, saved selections, and copy results after a selection
change. Workspace setup cases cover the words of each state, the meta refresh,
the connection guide only when the workspace is ready, the notice of a paused
workspace above the guide, and the safe error for a status answer that is not
valid. The hosted live gate,
`npm run test:hosted-live`, builds the portal and proves the sign-in, the
callback, the sign-out, the external sign-in through `/login`, and the
protected portal request with WorkOS. Its SO-07 scenario also proves the setup
state of a new free organization, with its reload, until the tenant is live
through an in-process Render fake. See the
[test gate policy](implementation/test-gate-policy.md#hosted-live-gate-auth-06).

`pnpm dev:user-portal` and `pnpm preview:user-portal` serve the portal alone on
port 5173, without the server. The portal then shows the error page, because
it has no server session there. Use them only for layout work.

The Node server has a separate TypeScript build. The current self-hosted image
excludes portal source and browser output. The hosted image is planned in
[RHD-03](implementation/render-hosted-docker-plan.md#rhd-03--build-and-prove-the-hosted-image).
