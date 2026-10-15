# User portal

The browser portal is in `src/user-portal/`. It uses TypeScript and Vite. It
shares `package.json` and `pnpm-lock.yaml` with the server. Install and build
it from the repository root with Node 24 and pnpm 12.10.1.

```sh
pnpm install
pnpm typecheck:user-portal
pnpm test:user-portal
pnpm build:user-portal
```

The build writes `src/user-portal/dist/`: `index.html` and the files in
`assets/`. The portal reads no build setting and keeps no secret.

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
| `portal/access` | `GET` after a sign-in: the protected portal request. The server checks the session and reads the current grants of the selected organization. `200` gives the organization and its roles when the user has User; `403` shows that the account has no product access, with a link to `organizations`. |
| `login` | The Sign In button opens it. The server starts the AuthKit sign-in. |
| `logout` | The Sign Out button posts a form with the `csrf_token` field. The server checks the origin and the token, clears the session cookie, and sends the browser to the WorkOS logout URL. |
| `organizations` | The organization page of the server: onboarding guidance or the organization selection. |

The profile and the organization ID that the portal shows are display data.
They never select a tenant or give access. Each protected request uses the
verified server session and a current read of the grants. A sign-in alone
gives no User access.

## Deployment

The production hosted application serves `src/user-portal/dist/` itself. Run
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

The hosted live gate uses this layout at `https://localhost:46443/`. Its local
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

- Redirect URI (the default): `https://localhost:46443/callback`.
- Default Sign-out URI: `https://localhost:46443/`.
- Initiate login URI: `https://localhost:46443/login`. A visit to the AuthKit
  domain without a sign-in request goes through
  `https://api.workos.com/user_management/initiate_login` to this route, which
  starts the sign-in.
- MCP resource indicator: `https://localhost:46443/mcp`.
- CORS origins: none. The portal makes no request to WorkOS.

The production application sends the Content Security Policy above with the
AuthKit origin of staging. The custom development front uses the same policy.

For another deployment, replace the origin in each of these settings and in
`PUBLIC_BASE_URL` and `WORKOS_REDIRECT_URI`.

## Tests

`pnpm check` checks portal types, runs its unit and acceptance tests, and
builds its browser bundle. `pnpm test`, `pnpm test:unit`, and
`pnpm test:acceptance` include the applicable portal tests. These tests use a
double of the server and a local DOM. The hosted live gate,
`npm run test:hosted-live`, builds the portal and proves the sign-in, the
callback, the sign-out, the external sign-in through `/login`, and the
protected portal request with WorkOS. See the
[test gate policy](implementation/test-gate-policy.md#hosted-live-gate-auth-06).

`pnpm dev:user-portal` and `pnpm preview:user-portal` serve the portal alone on
port 5173, without the server. The portal then shows the error page, because
it has no server session there. Use them only for layout work.

The Node server has a separate TypeScript build. The current self-hosted image
excludes portal source and browser output. The hosted image is planned in
[RHD-03](implementation/render-hosted-docker-plan.md#rhd-03--build-and-prove-the-hosted-image).
