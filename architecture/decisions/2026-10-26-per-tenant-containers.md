# One container for each tenant, behind one public origin

Date: 26 October 2026. The owner made these decisions on that date, in the
answers D-1 to D-15 of the
[self on-boarding plan](../../docs/implementation/self-onboarding-plan.md)
([PR #259](https://github.com/tomer-mayara/Thermus/pull/259)). The
[tiers and billing record](2026-10-26-tiers-and-billing.md) keeps the tier and
price rules. This record changes no code. Later tickets of the plan implement
it and update the [component registry](../components.md).

## Context

The owner wants free self on-boarding: a visitor creates an organization and
gets its own Render container, the tenant. An Admin can later upgrade to a paid
tier.

Today, one Render web service on `1c-2g` serves `app.thermus.ai`. One Node
process runs sign-in, signup, the account routes, and the MCP tools for every
organization. It runs one fetch or search at a time for all of them. In the
RHD-05 capacity run, one render of a 9 MiB page reached about 631 MiB of
memory.

This process holds credentials that reach every organization. WorkOS has one
API key for each environment. The database role `thermus_logging` reads and
writes the row of every organization.

WorkOS facts, read on 26 October 2026:

- Each environment has one initiate-login URI. Invitation links go through it.
- Redirect URIs are set only in the dashboard. A wildcard is allowed only in
  the left-most label, and never on a public suffix such as `onrender.com`.
- OAuth resources have an API to list, add, and delete them.
- An organization has at most 10 metadata keys, and the signup record uses all
  10.

## Decision

Each item gives the choice, the reason, and the alternative that lost.

1. **One public origin, with the MCP gateway inside `MCPServer` (D-1).**
   `https://app.thermus.ai` stays the only public origin. It becomes the
   control plane: signup, portal, billing, provisioning, the audit export, and
   the gateway. MCP clients keep `https://app.thermus.ai/mcp`. The gateway
   replaces the local dispatch, after the bearer check and the access check.
   All checks and denials of today stay.
   - Why: invitations and AuthKit sign-ins come to the one initiate-login URI
     anyway. One origin needs no DNS record, certificate, redirect URI, or
     OAuth resource for each tenant. A token without product access starts no
     container.
   - Rejected: one hostname for each tenant. Each tenant would need a browser
     session, and so a cookie password, a redirect URI, and the WorkOS API key,
     which D-14 forbids. A wildcard cannot be on `onrender.com`, so the
     hostnames would also need a domain under `app.thermus.ai`.
2. **Render private services from a prebuilt image (D-1, D-7).** Each tenant
   is a Render private service in the workspace and region of the control
   plane. It has no public address; only the control plane reaches it, over the
   private network. GitHub Actions builds the hosted image for `linux/amd64`,
   runs the offline gate, and pushes the image to GHCR by digest. A fleet script
   deploys that digest to the tenants in batches.
   - Why: one build, one gate on a native AMD64 runner, and one release path.
     An image-backed service never redeploys on its own, so each tenant runs a
     known digest.
   - Rejected: Git-backed builds, as today, where each tenant builds the image
     again after each commit.
3. **One image with two roles.** `THERMUS_ROLE` selects `control-plane`, the
   default, or `tenant`. A tenant serves only `/healthz` and `/mcp`, for one
   organization. It keeps the public `PUBLIC_BASE_URL`, so the token audience
   does not change.
   - Why: one artifact to check and deploy.
4. **No credential in a tenant (D-14).** A tenant holds no WorkOS, database,
   Stripe, or Render credential. The control plane signs an access context
   with an Ed25519 private key. The context holds the organization, the user,
   the grants, a hash of the bearer token, and an expiry of a few minutes. A
   tenant holds only the public key. It checks the signature, its
   organization, the expiry, and the token. The tenant sends its audit events
   to the control plane through the audit relay, with the same context. The
   control plane accepts them only for that organization, drops a repeated
   operation ID, and exports them.
   - Why: a tenant renders untrusted pages. A compromised tenant reaches only
     its own organization, and it cannot forge a context.
   - Rejected: the shared WorkOS API key and database role in each tenant.
5. **Tenant on first need.** The control plane requests a tenant after signup,
   at the workspace status read, or at an MCP call with product access. The
   request is one idempotent insert of a `tenants` row. A bounded loop then
   provisions one tenant at a time, and it looks for the service by name before
   it creates one.
   - Why: each existing organization gets a tenant on first use (D-10). A
     restart never creates a second service.
   - Rejected: a migration script for the existing organizations.
6. **Instance and capacity of each tier (D-2, D-12, D-15).** A free tenant runs
   on `0.5c-512mb` with today's page limits, a team tenant on `1c-2g`. A tier
   change resizes the container. `OPERATION_CAPACITY` allows 10 calls at a time
   by default, not 1.
   - Why: `0.5c-512mb` is the smallest paid plan, at about 7 USD a month. The
     team subscription pays for more memory.
   - Rejected: a page-limit setting for free tenants, and one call at a time.
   - Caveat: one render reached about 631 MiB, so 10 renders can exceed 512 MB
     and also 2 GB. Probe SO-01e must measure the real peak on both plans. The
     owner then confirms both values or lowers the free one.
7. **Cost caps (D-6).** `FREE_TENANT_LIMIT` is 25; a full cap closes signup.
   `FREE_TENANT_IDLE_DAYS` is 14; an idle free tenant is suspended, and the
   next call resumes it. Team tenants are never suspended.
   - Why: signup needs only a verified email. The caps keep live free tenants
     at about 175 USD a month or less.
8. **State in Supabase PostgreSQL, and free plans for now (D-8, D-9).** The
   `tenants`, `subscriptions`, and `billing_events` tables go into the existing
   `thermus_admin` schema, with a new role for the control plane. Supabase
   stays on Free, and the Render workspace stays on Hobby.
   - Why: WorkOS metadata is full, and both plans cost nothing.
   - Rejected for now: paid plans. The owner looks at Supabase again at the
     first paying customer, and at Render when the fleet grows.
9. **A rollout switch.** `MCP_TENANTS_ENABLED`, default `false`, turns the
   gateway on. While it is off, the control plane serves the tools, as today.
   - Why: the rollout can go step by step, and a rollback turns the gateway
     off with one setting.

The owners of plan section 4.5 are the target, with the new owners `tenants`,
`render`, `sql`, and `stripe`. Each code ticket makes its owners and edges final
in the rules file.

## Consequences

- Only the control plane holds credentials. A tenant cannot reach another
  organization.
- Each MCP call crosses one more private hop. The control plane stays one
  instance, with the registry copy, the provisioner, and the sweeps in its
  process.
- The control plane costs about 25 USD a month, and each team tenant about
  25 USD. Each live free tenant costs about 7 USD a month, and a suspended one
  costs nothing.
- Accepted risks:
  - Memory kills. A large page or many renders can exceed the memory. Render
    restarts the container, and the active calls fail.
  - Render rate limits. Creates, plan changes, suspends, and resumes share 20
    writes an hour for each Render user. The control plane has its own Render
    user, and the provisioner is a queue.
  - Plain HTTP on the private network. Only Thermus services are there, the
    bearer token is short-lived, and the context is signed.
  - A paused Supabase project stops provisioning, billing, and the audit
    export until the operator resumes it. The daily billing reconciliation
    makes a pause unlikely.
- One hostname for each tenant stays possible later (plan section 9). WorkOS
  accepts the wildcard redirect URI `https://*.app.thermus.ai/callback` and the
  wildcard OAuth resource `https://*.app.thermus.ai/mcp`. That design needs its
  own plan and a new answer to D-14.
