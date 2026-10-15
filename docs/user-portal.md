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

A deployment serves the portal build at the public base path and sends each
other request to the server:

- `GET` and `HEAD` of the base path itself give `index.html`.
- `GET` and `HEAD` of `assets/<file>` give the files of the build.
- Each other request goes unchanged to the Thermus server, also `login`,
  `callback`, `logout`, `session`, `portal/access`, the account pages, `mcp`,
  and the protected-resource metadata at the root.

The Vite build uses absolute asset paths, so the base path must be `/`. Send
the portal pages with a Content Security Policy whose `form-action` allows each
redirect of the sign-out. Chrome applies `form-action` also to the redirects
after a form post, and stops the browser at the first redirect that the policy
does not allow. The sign-out form goes to `logout` of the server. The server
sends the browser to the WorkOS logout URL at `https://api.workos.com`. WorkOS
sends it to the logout of the AuthKit domain, `<AuthKit domain>/api/logout`,
which clears the AuthKit cookies. AuthKit then sends it to the Sign-out URI of
the portal. For the AuthKit domain of `WORKOS_AUTHKIT_ISSUER`, for example
`https://auth.example.com`, use
`default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.workos.com https://auth.example.com`.

The hosted live gate uses this layout at `https://localhost:46443/`. Its local
HTTPS test server, `test/support/hosted-live/local-https-site.ts`, makes a
self-signed certificate for each run, serves the portal build, and forwards
each other request to the real hosted composition. The
[auth WorkOS MCP URL fetch work slice](../test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md)
runs the same local HTTPS site at the same origin, with a certificate that
stays, so that a person trusts it one time. Its hosted composition also has the
fetch tool. The gate and the slice cannot run at the same time. The WorkOS
staging environment has these settings for both:

- Redirect URI (the default): `https://localhost:46443/callback`.
- Default Sign-out URI: `https://localhost:46443/`.
- Initiate login URI: `https://localhost:46443/login`. A visit to the AuthKit
  domain without a sign-in request goes through
  `https://api.workos.com/user_management/initiate_login` to this route, which
  starts the sign-in.
- MCP resource indicator: `https://localhost:46443/mcp`.
- CORS origins: none. The portal makes no request to WorkOS.

The test server sends the portal pages with the Content Security Policy above,
with the AuthKit domain of the staging environment.

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

The Node server has a separate TypeScript build. Its image excludes portal
source and browser output.
