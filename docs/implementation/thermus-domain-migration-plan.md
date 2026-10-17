# Thermus app domain migration plan

Date: October 16, 2026, America/Denver. Status: rollout in progress.
The owner authorized implementation on October 16 local time (October 17 UTC).
Paid WorkOS features remain outside the authorized scope.

## Goal and scope

Keep marketing at `https://thermus.ai` on Netlify. Move the existing Render
portal, signup, login routes, and MCP endpoint to `https://app.thermus.ai`.
The owner confirmed the free WorkOS domain for the initial migration:
`https://spontaneous-mountain-26.authkit.app`. Keep that domain. No paid WorkOS
custom-domain add-on or `auth.thermus.ai` setup is in the initial scope.
Browser authentication will still visit WorkOS-hosted pages; this plan does not
keep every page on the app hostname.

Use a configuration-only app cutover. Existing source derives public URLs from
`PUBLIC_BASE_URL`; the hosted portal requires base path `/`. See
[public URL configuration](../../src/config/deployment-config.ts) and
[hosted composition](../../src/hosted-workos-application.ts).
Update marketing links and maintained connection guidance. Do not add a proxy,
shared cookies, broad CORS rules, or redirect code by default.

Preserve existing identities, organizations, memberships, grants, MFA policy,
and the live `SELF_SERVE_SIGNUP_ENABLED` value. Moving the hostname does not open
activation or publish replacement policies. New browser sessions and fresh MCP
authorization are expected.

## Recorded baseline and rollout progress

The investigation on this date found:

| Item | Observed state |
| --- | --- |
| Marketing | `thermus.ai` is live on Netlify. |
| App service | Thermus AI workspace, Render service Thermus; `main`, Docker, `Dockerfile.hosted`. |
| Deployment | Auto-deploy is enabled. The live baseline commit is `64c1bdd7870088484d8ce18c4113e809ed7656a0`; this documentation branch starts from it. |
| WorkOS Production | Callback `https://thermus.onrender.com/callback`, sign-out `https://thermus.onrender.com/`, initiate login `https://thermus.onrender.com/login`, MCP resource `https://thermus.onrender.com/mcp`. |
| AuthKit | `https://spontaneous-mountain-26.authkit.app`; no AuthKit custom domain. |
| DNS | Cloudflare is authoritative. The initial read contained 14 records and no explicit `app` record. |

Recorded progress on October 17 UTC:

- Added and read back the DNS-only `app` CNAME to `thermus.onrender.com`.
- Added the Render custom domain. Domain verification passed; Render reports
  certificate issuance pending. HTTPS `/healthz` returned 200. These observations
  do not establish completed TLS provisioning or new-origin authentication.
- Added and read back new WorkOS callback, sign-out, and MCP resource entries as
  nondefaults. Existing IDs and defaults are preserved.
- Saved public-setting and DNS rollback evidence privately in
  `/Users/tomermayara/.codex/thermus-domain-cutover-2026-10-17`.
  Unchanged secrets were not copied.

Canonical runtime changes, provider default changes, full acceptance,
publication, and old-host retirement remain pending. Older release records
describe auto-deploy as disabled; use the current read-back. The target table
below describes the intended final state, not completed work.

## Exact target settings

| System | Setting | Target |
| --- | --- | --- |
| Netlify | Marketing origin | Keep `https://thermus.ai`. |
| Render | Custom domain | `app.thermus.ai` on existing Thermus service. |
| Cloudflare | App record | CNAME `app` to `thermus.onrender.com`, DNS only. |
| Render runtime | `PUBLIC_BASE_URL` | `https://app.thermus.ai/` |
| Render runtime | `WORKOS_REDIRECT_URI` | `https://app.thermus.ai/callback` |
| Render runtime | `WORKOS_AUTHKIT_ISSUER` | Keep `https://spontaneous-mountain-26.authkit.app`, without a final slash. |
| WorkOS Production | Default redirect URI | `https://app.thermus.ai/callback` |
| WorkOS Production | Default sign-out URI | `https://app.thermus.ai/` |
| WorkOS Production | Initiate login URI | `https://app.thermus.ai/login` |
| WorkOS Production | New/default MCP resource | `https://app.thermus.ai/mcp` |
| Marketing | Signup and login navigation | `https://app.thermus.ai/signup` and `https://app.thermus.ai/login` |

Keep the WorkOS production client, API key, Authentication API host
`api.workos.com`, cookie secret, and `WORKOS_AUTHKIT_ISSUER` unchanged. Match the
selected WorkOS application's client ID to the app configuration before writes.
No WorkOS CORS addition is needed. Application callbacks, sign-out destinations,
and initiate-login routes have different purposes; follow the
[WorkOS setup guide](https://workos.com/docs/authkit/vanilla/nodejs) and
[session guide](https://workos.com/docs/authkit/sessions).

## Execution order

### 1. Save the starting state and prepare the handoff

Save complete DNS records, Render settings, deployment/build identifiers,
WorkOS URL lists and defaults, initiate-login value, and MCP resource IDs/URIs
in a private operator record. Keep secrets in protected storage. Confirm the
activation switch and any linked environment groups without printing secrets.

Identify active users and clients that use the old URL. The default retirement
will break old bookmarks. If continued old-link navigation is required, stop
this default plan and define a narrow redirect change as separate source work.
Do not add generic callback or MCP redirects.

Prepare marketing and [connection-guide](../free-subscription-guide.md) link
changes for publication after the new flow passes. Preserve historical evidence.
Review how current guidance will identify the replacement service URLs. Keep the
frozen legal bundle: its terms name replacement URLs, and runtime validation
does not require their hostname to match the deployment. This is not a legal
sufficiency finding. If the owner chooses text changes, use new versions,
hashes, retained bytes, and approval under the
[signup document policy](hosted-user-onboarding.md). Do not rewrite approved
text or hashes as a routine URL replacement.

### 2. Establish the app hostname

Add only `app.thermus.ai` to the existing Render service. Inspect the actual
Cloudflare records, then add the app CNAME above. Remove or replace only records
that conflict at that exact name. Do not remove all zone AAAA records, move the
apex or `www`, change nameservers/MX, add a wildcard, or change zone-wide rules.
Keep the CNAME DNS only as described in
[Render's Cloudflare guide](https://render.com/docs/configure-cloudflare-dns).

Wait for Render domain verification, valid TLS, and correct routing. Check any
certificate block before proceeding. Keep the old hostname enabled. Before the
canonical setting changes, use TLS and `/healthz` probes only; these do not
prove new-origin authentication.

### 3. Prepare WorkOS without removing working records

Add the new callback and sign-out URIs while preserving the complete existing
lists and defaults. Read back both lists. Prepare the new MCP resource as
nondefault, preserving the old resource's ID and URI. Prefer a documented add
operation. If using `setAuthkitOauthResources`, it replaces the full list:
read every entry and supply the complete merged list of
`{ id?, isDefault?, uri }` records, preserving existing IDs and defaults.
Do not rename or drop the old resource.

Read back the saved resources. Resource deletion removes associated application
consents, so deletion is neither cleanup nor rollback in this plan. See the
[OAuth resource reference](https://workos.com/docs/reference/authkit/oauth-resource).

### 4. Switch the canonical origin

Use a controlled window and block unrelated `main` auto-deploys during it.
Record any temporary auto-deploy change and the conditions for restoring it.
The application and provider changes are not atomic; allow a short interruption.

Save the two Render runtime URL changes together and deploy once. Render's
**Save and deploy** reuses the existing build; **Save only** does not change the
running process. Use the supported path and verify the deployment commit and
resulting runtime values. A rebuild is unnecessary for these settings alone.
See [Render environment variables](https://render.com/docs/configure-environment-variables).

After the deployment is Live, switch WorkOS's redirect and sign-out defaults,
initiate-login URI, and MCP default to the target values. Preserve all old
records. Read back each setting, then run the browser checks immediately.
Do not leave mixed defaults as the final state.

The app creates host-only `__Host-` cookies. A cookie set on the old hostname
cannot complete a callback on the new hostname. The server also reconstructs
request URLs from the configured canonical origin. Thus, serving both hostnames
does not create two working auth origins. See
[cookie rules](../../src/auth/hosted-auth/workos/session-cookies.ts) and
[HTTP URL construction](../../src/http/fetch-exchange.ts).

### 5. Publish links and retire old entry points

After the new flow passes, publish the marketing navigation and maintained
guide changes. Links must work without JavaScript. Marketing navigates to the
app; it does not POST activation or fetch sessions across origins.

Give native users the new endpoint and require fresh authorization. Adding a
resource or changing its default does not migrate an existing refresh token's
audience. The default applies to CIMD/DCR clients that omit the resource, not to
every OAuth or M2M application. Check the actual clients and preserve any
required explicit resource configuration. Keep the original resource through
the rollback window. See
[WorkOS MCP authorization](https://workos.com/docs/authkit/mcp).

After all new checks and publications pass, disable the Render subdomain.
Render then returns platform 404 responses for the old hostname, while the
custom domain remains available. This changes HTTP routing; keep the app CNAME
target `thermus.onrender.com`. Verify both outcomes after the change. See
[Render custom domains](https://render.com/docs/custom-domains).
Do not leave the old hostname serving mismatched auth indefinitely.

After acceptance and publication pass, verify the linked branch and saved
runtime settings, restore the recorded auto-deploy policy, and read it back.

## Acceptance and rollback

Record results against the deployed commit and saved settings. Use approved
accounts and test paths. Do not open signup to run a migration test.

| Given | When | Then |
| --- | --- | --- |
| New DNS and verified Render domain | Check HTTPS and `/healthz` | Certificate and routing are valid; health returns 200. Marketing still works. |
| JavaScript disabled on marketing; a fresh browser | Follow signup/login; complete sign-in | Navigation reaches the app; AuthKit returns to its app callback; session cookies are host-only, Secure and HttpOnly; session refresh and logout work; logout lands on the app. |
| The preserved activation switch; a fresh signed-out browser | GET `/signup` and follow its allowed flow | Off shows Activation is closed. On shows Start free access; sign-in returns to signup. |
| Approved external AuthKit test paths | Start at AuthKit, or use a supported reset/invitation flow | Initiate login reaches app `/login` and completes without loops or a wrong-host callback. |
| New MCP endpoint | Read metadata and an unauthenticated challenge | Resource/metadata URLs use the app origin; authorization server remains the current AuthKit issuer. |
| A client with intended access | Authorize the new endpoint, fetch, then refresh after access-token expiry | Tool access and refresh work in the intended workspace; an old-audience token is refused. |
| Existing access and origin controls | Check protected routes and foreign-origin POST/MCP requests | Grants and CSRF/origin rules remain enforced; marketing receives no new cross-origin session access. |
| Published links and retired Render hostname | Visit old and new endpoints | Old hostname returns platform 404; app and marketing still work. |

If activation is enabled, use an approved eligible test account for the
activation check. Explicit agreement must create the intended personal workspace
and access. An account that already has access must continue without another
activation or agreement.

This repository change contains documentation only. Run document/link checks,
`npm run check`, and `habit-hooks` on the complete pull request candidate. The
live rollout still needs the acceptance checks above; repository checks cannot
prove production DNS, provider settings, or authentication. If source behavior
becomes necessary, first write the failing acceptance case, use TDD, and follow
the [test gate policy](test-gate-policy.md), including focused tests and
applicable suites. Record unavailable live checks explicitly.

If a required flow fails, restore the saved canonical Render URL pair and
WorkOS defaults/initiate-login settings, enable the old Render hostname, and
restore published links. Keep both MCP resources. New-origin clients may need
to reconnect to the old endpoint. Do not delete consents to undo the cutover.

Render deployment rollback can use the target deployment's older environment
for that deployment, but it does not restore current saved settings. Restore
those settings explicitly. Dashboard rollback disables auto-deploy; API rollback
does not. Verify saved settings and the linked branch before restoring the
original auto-deploy policy. See [Render rollbacks](https://render.com/docs/rollbacks).

DNS need not change because the same service remains the target. Withdraw new
entry links while the old origin is canonical; direct new-domain bookmarks can
fail during rollback. If withdrawal also requires DNS restoration, use the
saved app-record snapshot. Do not describe both origins as working. Keep the
rollback window open until the acceptance record is reviewed. Any later removal
of old WorkOS resources needs a separate consent-impact decision.

## Deferred AuthKit branding

The initial migration uses the confirmed free WorkOS domain. Any later
`auth.thermus.ai` setup needs a separate proposal, current pricing, approval of
the paid add-on, and an issuer migration plan. It is not part of this rollout.
