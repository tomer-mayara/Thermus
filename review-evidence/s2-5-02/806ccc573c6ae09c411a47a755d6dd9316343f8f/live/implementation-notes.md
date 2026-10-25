# Scoped S2.5-02 live removal proof

The entry is `test/acceptance/auth/hosted-removal.live.ts`. It must run with a freshly built `dist/` and real portal build, a pinned Lightpanda executable, existing password-only WorkOS staging settings, Docker, OpenSSL, Playwright Chromium, and exclusive use of 46443 and 46480. The manager owns builds and execution. No test or build was run by the worker.

The test never calls `run.fixtures()`, `organizationFixtures()`, or `administrationFixtures()`. Thus it does not execute the broad stale-fixture scan. It creates only three fresh organizations, three fresh password users, five memberships, and one OAuth application. The run records exact IDs for cleanup. The private journal contains no passwords, API keys, OAuth tokens, invitation tokens, or links. After cleanup, the test reads exact resource and membership IDs and requires 404. It creates no SSO, directory, factor, or paid resource, and changes no provider setting.

The real production application uses disposable migrated TLS PostgreSQL. The test uses the existing AuthKit browser driver, real Members controls, SDK reads, and real MCP protocol requests. It checks explicit raw `directory_managed: false` before using the production adapter's ordinary classification. It checks stale-revision, foreign-membership, User-actor, form-token, and last-Admin refusals. External/unknown management refusal remains controlled-only because this run does not create or change IdP resources.

Rejoin sends the invitation through the app and accepts it with the privileged WorkOS SDK API. Fresh browser sign-in and a new MCP authorization prove the new Admin-only membership. This does not prove invitation recipient identity or link semantics.

No fresh identity has an existing factor available for observation. No MFA API is called. Live account and other membership preservation are proved with exact-ID WorkOS reads, password reauthentication, organization selection, portal access, and MCP access. Factor sentinel coverage is separate controlled evidence.

Default helper behavior is preserved. `LiveRun` accepts an optional site factory, and `LocalHttpsSite` accepts only the three SQL environment fields. Relevant actual consumers of `local-https-site.ts` include the integration group through `test/integration/auth/hosted-live-site.test.ts` (including `hosted-live-site/mcp.ts`), the hosted live gate, the public script live gate, and the manual auth-workos-mcp-url-fetch work slice. `LiveRun` is used by the hosted live gate and the new scoped live proof. The manager must combine these groups with complete-candidate test selection and preserve the nested-run limit. The read-only `git diff --check` passed.

Official documentation checked on 2026-10-25:
- https://workos.com/docs/reference/authkit/organization-membership (membership deletion is permanent; directory-managed memberships are refused)
- https://workos.com/docs/reference/authkit/invitation/accept

The installed SDK 11.0.0 declaration and implementation confirm `acceptInvitation(invitationId)`, `getApplication({ id })`, and list-invitation organization/email filters. The production adapter reads raw membership management evidence before SDK defaulting.
