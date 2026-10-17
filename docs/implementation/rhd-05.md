# RHD-05: first deployment and release proof

Status: requested first-release operational checks completed in the later
October 16, 2026 restricted release checkpoint. PR #119 merged after review.
Git auto-deploy, browser cookie continuity, rollback and restoration, Google
production publication and branding, and fresh sign-in passed. The owner accepted
the first operational release. Capacity evidence keeps its recorded bounds.
The incomplete states and specifications below are historical checkpoints.
This is not a full public-launch record. Hosted-product policy coverage and
self-serve opening remain separate [FS-05](fs-05.md) work.

## Manual first-deployment acceptance

**Given** checked `main`, the approved Render configuration, and the owner's
explicit deferral of public privacy/terms pages and Google publication,

**When** Render builds and deploys the exact checked revision below,

**Then** deployment status is live, and the initial public remote smoke confirms:

- `GET` and `HEAD /healthz` return `200`.
- The portal and its assets load with the required CSP.
- Protected resource and authorization metadata name the exact production MCP
  resource and issuer below.
- MCP without a token returns `401`; foreign, malformed, and opaque `null`
  Origin values return `403` before authentication.
- Protected account requests without a session cookie return `401`.
- Runtime logs show the expected listener port and no startup errors.

These initial public checks passed. The deferral does not block this deployment or
public smoke. It does not prove Google publication or any authenticated journey.
Keep auto-deploy off until authenticated remote smoke passes.

## Checked revision and review evidence

The owner authorized review and merge of PRs #115–117 and the first deployment.
The manager reviewed the code with no blockers and audited the recorded required
gate evidence. This record adds no code or tests. Retained `habit-hooks` findings
are documented in the [RHD-03 record](rhd-03.md#retained-habit-hooks-findings).
There are no Actions workflows or jobs for these changes.

| Pull request | Merge commit |
| --- | --- |
| #115 | `2d01d55da88e9034e2119a9d49a8434d487ca23f` |
| #116 | `3e054b7e5b1666e0dd0467b7a887a759e819b4d3` |
| #117 | `3736b78d18f34c0b559870b00f90bd2bab3cbe31` |

The initial revision `3736b78d18f34c0b559870b00f90bd2bab3cbe31` had whole tree
`b8a9df79fd46e1e1aabc179138c016a357b3ecb0`, exactly matching reviewed PR #117
head `c3a2734144a043b1d184f8531a59d4f2dafe41b1`.

The first intended deploy, `dep-db8pua7f3r2c73f0b3ag`, failed its build at
`2026-10-16T03:53:10Z` (October 15 client date). Unit tests passed 2533 of 2534;
the CSS selector child exceeded its unchanged 3000 ms deadline. Runtime was not
reached.

The manager reviewed and merged [PR #120](https://github.com/tomer-mayara/Thermus/pull/120).
It adds `--test-concurrency=1` for backend unit test files and updates the test
policy. Tests, deadlines, and runtime behavior are unchanged. Host
`build:hosted` passed its groups of 2534, 8, 10, 4, 424, 90, and 9 tests;
the selector checks passed 4/4. Final Linux AMD64 hosted image checks passed 8/8
on a 2 CPU / 4 GiB Rosetta runtime; self-hosted container checks passed 13/13.
Changed-file `habit-hooks` reported zero findings, with snooze `[]`. The prior
180 root findings remain retained for the RHD-03 reasons.

Current `main` is `1c2fa0440b41df534d7a077c55411e7fc4113b3f`, merging #120.
Its whole tree exactly matches tested fix head
`08c9676201bbe42996b7b58a5641810aa4e2c096`.
Retry `dep-db8qf4mq1p3s7391cm1g` started at `2026-10-16T04:26:58Z` from this
exact `main`. It became live at `2026-10-16T04:31:50.782873Z` (October 15 client
date), with that exact commit.

## Public smoke results and limits

All 15 public checks passed: health GET/HEAD `200`; portal `200` with exact CSP,
`nosniff`, and `DENY`; JavaScript/CSS `200`; anonymous MCP `401` with same-origin
protected metadata; foreign, malformed, `null`, and path-bearing Origin `403`
before authentication; valid same-origin MCP `401`; exact resource and production
issuer; AuthKit metadata `200` with CIMD, S256, and no DCR endpoint; account
without a session cookie `401`; and login `303` to `api.workos.com` with the
matching production client and callback. The temporary probe first expected
`302`; the existing application contract is `303`. Correcting that probe yielded
15/15 without an application change.

The browser showed Welcome and Sign in, with no console errors or warnings.
Safe results are `/tmp/thermus-rhd05/public-smoke-results.json` and
`/tmp/thermus-rhd05/public-smoke.log`; the screenshot is
`/tmp/thermus-rhd05/portal-live.jpg`.

The listener logged `http://0.0.0.0:8080` at `04:31:47Z`; Render reports open port
8080 and one `1c-2g` instance. The unpaginated error query for
`04:31:40–04:34:05Z` returned zero errors. One memory sample was 110174210 bytes;
there was no CPU data. These samples do not prove capacity or authenticated
WorkOS API-key use. Auto-deploy remains `no`, trigger `off`, and previews off.

Both Colima and Lima configurations were restored exactly to their originals:
4 CPU / 4 GiB, QEMU, no Rosetta. Scoped gates left no owned containers.

## Approved target

Reuse Render `Thermus`, service `srv-db8mnqg473hc739d529g`, in Thermus AI workspace
`tea-db8i6ceq1p3s73dev9og`. The origin is `https://thermus.onrender.com`;
the MCP resource is `https://thermus.onrender.com/mcp` and production issuer is
`https://spontaneous-mountain-26.authkit.app`.

The service uses Oregon, one `1c-2g` instance at $25/month plus usage, Docker,
`main`, context `.`, `Dockerfile.hosted`, and `/healthz`. Auto-deploy and previews
are off. The canonical repository is `https://github.com/tomer-mayara/Thermus`.
The [RHD-04 record](rhd-04.md) gives saved runtime and identity settings,
their read-back limits, and the two earlier failed setup attempts.

## Remaining release work

Both initial identities are now provider-verified and have explicit User-only
grants read back, as recorded below. Ungranted access stays denied. RHD-04
remains incomplete; Google publication is still deferred.

Full RHD-05 still needs Google publication and remaining release proofs,
deployment cookie continuity, On Commit proof, rollback, and restoration.
Bounded capacity evidence is complete within the limits below.
Native configuration, CIMD registration, login, and tool discovery are verified.
Real native fetch and actual native refresh passed. Public policy
pages remain owner-deferred.
No release or complete RHD-05 pass is recorded.

## Manual authenticated acceptance specification

Initial status: all checks below were pending. This specification preceded
authentication and grants. The owner authorized checks of both existing intended identities and
explicit User access. Public policy pages and Google publication remain deferred;
these checks use the configured Testing app and do not establish a public launch.

**Given** the live checked deployment, both intended existing identities without
product grants, and the saved production browser and native client configuration,

**When** each person completes real provider sign-in, the operator reads back
provider verification, and each initially ungranted account is checked,

**Then** both identities are provider-verified through sign-in, with no manual
verification override, and neither account has product access before its grant.

**When** the operator grants only `user` in the intended organization and reads
back both active memberships,

**Then** each membership has the explicit User grant and no Admin or Super Admin
grant. Browser account and product status show the expected access. Logout ends
the session, and protected browser access without that session is denied.

**When** the separate Claude Code client completes CIMD login, lists tools, runs
a real fetch, and refreshes its credential,

**Then** each operation succeeds under the intended production identity and User
grant. Browser session success alone does not satisfy this native client proof.

**When** the operator revokes User from the designated account and reads the
membership again,

**Then** protected product and MCP requests are refused despite existing
credentials. Restore only User, read it back, and confirm access returns.

Record safe outcomes only: no tokens, personal emails, or fetched page contents
belong in this repository. Auto-deploy stays off until authenticated smoke passes.

## Authenticated checks: partial results

Both existing intended identities completed real Google sign-in using the
configured Testing app. No manual verified override was used. Provider reads:

| Identity | User ID | Verified at (UTC, 2026-10-16) |
| --- | --- | --- |
| Business | `user_01M515Z5V41GQ2E2KMHT3T4WST` | `04:45:26.306Z` |
| Personal | `user_01M515ZBGTVTR46WP7SXV0QMZJ` | `04:47:23.416Z` |

Both browsers showed no product access before grants. The operator then added
only User role `role_01M5113VYK46GWNZWQHBF7808W`, mapped solely to
`product:access`. Independent reads confirm active memberships with sole role
`user`, no Admin or Super Admin:

| Identity | Membership ID | Created at (UTC, 2026-10-16) |
| --- | --- | --- |
| Business | `om_01M51GKZ24PBKDMCJW2NQWCJ3X` | `04:48:10.301Z` |
| Personal | `om_01M51GMCR2XN0A33Q39GFKRKBD` | `04:48:24.316Z` |

The personal pre-grant session initially had no selected organization. Choosing
Thermus AI through the organizations flow then showed product access and
`Roles: user`. A reload around `04:55Z`, beyond the configured 300-second
access-token lifetime after organization selection at `04:49:18Z`, retained
product access without a new login. This proves browser session renewal, not
native token refresh.

Business post-grant Google sign-in showed product access in
`org_01M515XQD27ZTRYZ546RSWBMY8` with `Roles: user`. Its screenshot is
`/tmp/thermus-rhd05/authenticated/business-user-access.jpg`. Both post-grant
Sign Out actions returned the public portal, then `/portal/access` showed
Sign-in required. The business pre-grant logout also returned the public portal;
`/account` showed Sign-in required. Provider reads after both post-grant logouts
confirm Revoked sessions: personal ended at `04:56:19.971Z` and business at
`04:57:43.903Z`. Both User grants remain intact.

Successful callback, session, organization-selection, and current-grant flows
prove live runtime WorkOS API use; the production key's `lastUsedAt` was
`2026-10-16T04:49:18.234Z`. Error logs for `04:44:00–04:58:25Z` were empty.
Operator records were updated outside the repository. Safe screenshots are in
`/tmp/thermus-rhd05/authenticated/`; no personal emails or credentials are
recorded here.

Claude Code reached consent and registered CIMD client
`https://claude.ai/oauth/claude-code-client-metadata` as application
`app_01M51GQSBBXX3WX66ZYR1GN6K0`. Read-back confirms
`isClientIdMetadataDocument: true`, Public, and `credentials: []`; DCR stays off.
The earlier CLI timeout occurred while consent approval was pending. The owner
then approved the exact designated personal account's native consent, and
`claude mcp login thermus-production` succeeded around `2026-10-16T05:19Z`.
The provider recorded
`authentication.oauth_succeeded` at `05:19:02.376Z`; the CLI completed seconds
later.
The initial probe connected and discovered
`mcp__thermus-production__getURLAsMarkdown`; safe results are in
`/tmp/thermus-rhd05/authenticated/initial-native-claude-signin-blocked.json`.
No tool was called in that initial blocked attempt:
Claude Code's separate Anthropic model-account OAuth had expired. Thermus MCP
authentication succeeded. The owner later restored Claude account sign-in;
the model-account blocker is resolved.
This is not a Thermus OAuth failure.

The operator changed only the personal active membership from sole User to
default Member at `2026-10-16T05:22:13.053Z`. The same browser session was denied
and `/portal/access` showed access denied. Native `claude mcp get` changed from
Connected before revocation to Needs authentication during revocation. The
operator restored sole User at `05:22:48.294Z`; an independent read confirmed
active `user`. The same browser then showed the exact organization and
`roles: [user]`, and the native connection returned Connected without a new
native login. Business membership was untouched. Both writes checked the exact
expected sole role and were recorded outside the repository. No Admin or Super
Admin grant was made.

Browser revocation/restoration and native connection revocation/recovery passed.
The later persistent-client check below proves tools/call denial; actual native
refresh was unproved at that point. Refresh
must be tested against the Connect token lifetime; the 300-second AuthKit browser
lifetime is not a native refresh deadline. Privacy/terms and Google publication
remain deferred, Testing is unchanged, and auto-deploy stays off. Full RHD-04 and
RHD-05 completion is not claimed.

## Successful native fetch

After the owner restored Claude account sign-in, the native probe ran from
`2026-10-16T12:28:34.216616Z` to `12:28:43.263418Z` and exited 0. It connected,
listed the fetch tool, and made exactly one `getURLAsMarkdown` call to
`https://example.com/` with reason `RHD-05 initial production MCP check`.
The result had `isError: false`, meaningful expected content, and no permission
denials. No fetched page contents are recorded here. The safe summary is
`/tmp/thermus-rhd05/authenticated/initial-native-summary.json`.

Render recorded `mcp.tool.completed` success at `12:28:41.154378536Z`, duration
346 ms, for subject `user_01M515ZBGTVTR46WP7SXV0QMZJ` and tenant
`workos:client_01M4VDKC291XX3CDEFP5ZKY5KP:org_01M515XQD27ZTRYZ546RSWBMY8`,
with the exact URL and reason above. A fresh membership read confirmed active
User only. The unpaginated application-error query for `12:28–12:36Z` was empty.

There was no further Thermus MCP login after approximately `05:19Z`. Continued
native access for more than seven hours was proved; that alone did not prove
refresh. The
Connect token lifetime and refresh event were unavailable through the then-inspected
safe diagnostics. Neither the AuthKit 300-second lifetime nor a documentation
example establishes this native credential's expiry. Native connection
revocation/recovery remains proved; explicit tools/call denial is proved below.

## Persistent native revocation check

One native CLI process handled all three phases without a restart on 2026-10-16.
The tool was discovered before User removal. Each phase made exactly one
expected tools/call:

| Phase (UTC) | Result |
| --- | --- |
| Initial, `12:32:59–12:33:07` | Real fetch passed with meaningful expected content. |
| Revoked, `12:34:01–12:34:09` | `isError: true`, access denied, and no expected page content. |
| Restored, `12:34:29–12:34:35` | Real fetch passed with meaningful expected content. |

A guarded update changed personal User to default Member at `12:33:59.083Z`;
read-back confirmed active Member. A cleanup safeguard restored sole User at
`12:34:17.210Z`, independently read back. There was no login or consent between
phases. The CLI closed cleanly with exit 0. This proves actual tool-call denial
and recovery in the same native client. Prior browser checks were not repeated.

Render recorded successful initial and restored completions at `12:33:03Z`
and `12:34:33Z`, taking 174 ms and 91 ms, with the same expected subject and
tenant recorded above. Reasons were `RHD-05 persistent initial production MCP
check` and `RHD-05 persistent restored production MCP check`. Safe phase summaries
are `/tmp/thermus-rhd05/authenticated/initial-native-session-summary.json`,
`revoked-native-session-summary.json`, and `restored-native-session-summary.json`
in that directory. No fetched page contents are recorded here.

Final provider reads confirm both memberships active with sole User. Business
membership is unchanged (`updatedAt: 04:48:10.301Z`); personal membership has
`updatedAt: 12:34:17.210Z`. Auto-deploy remains off. Google Testing and the owner's
privacy/terms deferral are unchanged. At that point native refresh was unverified;
the expired-token proof below now establishes it.


## Expired-token native refresh proof

The baseline native access token had issued-at `2026-10-16T12:34:32Z` and expiry
`12:39:32Z`. A normal native fetch at `13:18:40–13:18:50Z` succeeded with exactly
one tool call to `https://example.com/`, without login, consent, or credential
edits. The subsequent token had issued-at `13:18:47Z` and expiry `13:23:47Z`.
A refresh token was present, and expected issuer, resource, client, and user
matched before and after. No credential values are recorded here.

Render recorded successful `mcp.tool.completed` at `13:18:48Z`, taking 118 ms.
Decoded metadata alone does not verify a signature; the successful fetch used
production token validation. This proves actual native refresh after expiry.

## Manual capacity and deployment acceptance specifications

Initial status: all checks in this section were pending. These specifications
preceded production capacity and deployment work; capacity results follow below. Public policy pages and Google
publication remain owner-deferred; owner review is still required.

**Given** the checked live service, one `1c-2g` instance, fixed fetch cap of one,
a designated User account, and controlled representative and near-limit pages,
**when** bounded fetch runs exercise both workloads, **then** record CPU, memory,
response time, health responsiveness, and outcomes against existing safety and
timeout limits. Use the results for owner review before broader enrollment;
no new latency or throughput target is implied.

**Given** one admitted fetch still owns the slot, **when** an excess request
arrives, **then** it is refused promptly with the safe busy tool result. Health
remains responsive. After the admitted work and cleanup settle, another request
succeeds. Record cancellation or failure recovery if exercised; do not free the
slot while its child still runs.

**Given** a designated browser session and a stable cookie key, **when** a healthy
replacement deploy or restart completes, **then** that session retains the same
intended organization and User access without a new login. Verify protected
behavior after the change; never record the cookie value.

**Given** authenticated smoke has passed and a reviewed harmless change is ready,
**when** On Commit is enabled and that change reaches `main`, **then** Render
starts the Git-triggered deployment of its exact checked commit. The deployment
becomes healthy and public/authenticated smoke passes. Do not inject production
build or startup failures.

**Given** two healthy retained versions with compatible cookie keys, **when** the
operator rolls back to the earlier artifact, **then** its revision and health
match expectations and public/authenticated smoke passes. **When** the latest
checked `main` is restored, **then** smoke passes again and On Commit is enabled.
Read back relevant settings: rollback can change the retained deployment's
service environment, command, health path, and instance count; external WorkOS,
domains, compute plan, and environment-group settings need separate inspection.
Record deploy IDs, commits, measurements, cookie continuity, and recovery results.
Full RHD-05 remains incomplete until the required release evidence and owner
review are complete.


## Bounded capacity results

Representative and near-limit probes passed. The representative page was 14845
bytes with a JavaScript marker; server time was 848 ms. The near-limit page had
9 MiB of inert JSON hydration input and passed its marker; server time was
12.783 seconds and the native result envelope contained 73 characters. This is
not large-DOM stress or a throughput proof.

The native pair serialized about 6.1 seconds apart and could not prove overlap.
A direct pinned MCP SDK probe then exercised overlap and recovery:

| Request | Server time | Client time | Outcome |
| --- | --- | --- | --- |
| Admitted slow fetch | 5.505 s | 6.047 s | Success |
| Excess fetch | 0.419 ms | 321 ms | Safe busy refusal |
| Recovery fetch | 309 ms | 1.101 s | Success |

The fixture saw only seven origin requests; rejected excess never fetched.
The native process closed and the fixture and tunnel stopped at `13:32:20Z`.
Thirty-second CPU samples reached 0.181 cores against a one-core limit. Memory
samples reached 661315600 bytes (about 631 MiB) against 2 GiB, then fell to
111345660 bytes. These are sampled maxima, not instantaneous peaks or sustained
capacity evidence. Retain the fixed one-slot cap.

Initial health checks were 60/60 `200`, maximum 4.403 seconds. Four direct overlap
and recovery samples were all `200`, taking 116–237 ms. A follow-up window was
19/20: one unclassified client request failed at `13:31:34.98Z`, after the probe
ended at `13:31:29.33Z`. Subsequent requests returned `200`; no application log
errors or restarts were visible. The failure has no established cause and is
not omitted from the results. Health request logs were empty/unavailable, so
they do not establish its cause. Fresh post-capacity public smoke exited 0 with
15/15 checks passed; safe results are
`/tmp/thermus-rhd05/release/public-post-capacity-results.json`.

Safe summaries and sampled logs/metrics are under `/tmp/thermus-rhd05/release/`:
`representative-native-session-summary.json`, `near-limit-native-session-summary.json`,
`pair-native-session-summary.json` (inconclusive), `direct-capacity-summary.json`,
`capacity-health.json`, `direct-health.json`, `render-capacity-metrics.json`,
`render-capacity-initial-logs.json`, `render-capacity-direct-logs.json`, and
`render-capacity-followup-metrics.json`. Cookie continuity, Git-triggered deploy,
healthy rollback/restoration, and owner review remain pending. Full RHD-05 is
incomplete.

The same personal browser session reloaded at `13:31–13:32Z` with User access
in the intended organization, without a new login. The baseline screenshot is
`/tmp/thermus-rhd05/release/browser-continuity-baseline.png`; no deployment cookie
continuity is proved yet. Render read-back shows empty included/ignored build
filters, `main`, auto-deploy/previews off, and one instance. No configuration or
environment mutation was made for these reads. Memory returning to about 111 MB
does not establish absence of leaks.
