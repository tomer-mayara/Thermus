# User portal

The browser portal is in `src/user-portal/`. It uses TypeScript, Vite, and
`@workos-inc/authkit-js`. Install and run it from the repository root with
Node 24 and pnpm 12.10.1. It shares `package.json` and `pnpm-lock.yaml` with
the server.

```sh
pnpm install
cp src/user-portal/.env.example src/user-portal/.env.local
pnpm dev:user-portal
```

Set `VITE_WORKOS_CLIENT_ID` to the WorkOS application's public client ID.
Set `VITE_WORKOS_REDIRECT_URI` to its registered callback URL. Local development
uses `http://localhost:5173/callback`. Both values are required. Vite reads
portal environment files from `src/user-portal/`. `VITE_` values are public
browser configuration. Keep API keys and other server secrets out of these
files.

Use these WorkOS application settings for local development:

- Redirect URI: `http://localhost:5173/callback`.
- Default Sign-out URI: `http://localhost:5173/`.
- Initiate login URI: `http://localhost:5173/login`.
- Allowed browser origin, if required: `http://localhost:5173`.

The SDK handles the callback. `/login` starts SDK sign-in when AuthKit sends
an external sign-in to the application. The home page starts sign-in from the
Sign In button and shows the SDK user profile after sign-in. Sign Out uses the
SDK to end the session and goes to the application's configured Sign-out URI.
For a deployed portal, replace the local origin in the environment and all
application settings. Its host must serve `index.html` for `/callback` and
`/login` as well as `/`.

```sh
pnpm typecheck:user-portal
pnpm test:user-portal
pnpm build:user-portal
pnpm preview:user-portal
```

The build writes `src/user-portal/dist/`. The preview uses port 5173 so the
local URLs stay the same. Both dev and preview fail if that port is in use.
`pnpm check` checks portal types, runs its unit and acceptance tests, and
builds its browser bundle. `pnpm test`, `pnpm test:unit`, and
`pnpm test:acceptance` include the applicable portal tests. These tests use a
provider double and a local DOM. They do not verify saved WorkOS settings or
live sign-in and sign-out.

The Node server has a separate TypeScript build. Its image excludes portal
source, local environment files, and browser output. The portal does not
implement the server's hosted authentication provider or change the hosted
placeholder. Before using it with a WorkOS application, verify its saved URL
settings and test normal sign-in, callback, sign-out, and an external sign-in
through `/login`. See the [AuthKit JavaScript SDK](https://github.com/workos/authkit-js)
and [Sign-out URI documentation](https://workos.com/docs/authkit/sessions#sign-out-uris).
