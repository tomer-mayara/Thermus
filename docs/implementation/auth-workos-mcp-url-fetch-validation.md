# Auth WorkOS MCP URL fetch: validation record

Date: 2026-10-15. Runtime: Node 24.20.0.
PR: `3-headed-monkey/Thermus#108`. Validation complete; prepared for owner review.

The source candidate `975b2b10` on `codex/pr108-workos-onboarding` followed
the merge of main, commit `6cab980f`. The original PR head was
`b846e1a572c72edd29f15ee3e77bcff90c87759a`. The tables below preserve the
reviewed results for that earlier candidate. The Optional MFA revision is
implemented and its current verification is recorded below. The Google portal
portion, Claude OAuth, and an actual MCP fetch passed. Matching Axiom output
and the role-removal checks also passed. Renewal and consent removal are
recorded below. The post-expiry refusal and corrected launcher shutdown with
Axiom delivery passed. All requested final candidate gates passed, with
reviewed habit-hooks retention recorded below. This record gives no merge
approval.

## Current Optional MFA candidate

The final test-only path correction moves the shutdown probe path to
`test/support/processes/module-paths.ts` and adds it to the existing path
matrix. It changes no runtime behavior. Its focused source check passed
3/3 tests in 1 suite, with zero failures, cancellations, skips, or todo cases;
log `/tmp/thermus-pr108-path-refactor-focused.log`. The final check rerun
passed. Integration, acceptance, and container reruns also passed. The
WorkOS interface, renderer, and manual proofs remain valid for this path-only
change.

After that correction, `npm run check` completed with exit 0 under Node
24.20.0. Its reports are:

| Part | Tests | Suites | Passed | Failed / cancelled / skipped / todo |
| --- | ---: | ---: | ---: | --- |
| Node unit | 2,475 | 183 | 2,475 | 0 / 0 / 0 / 0 |
| Portal unit | 8 | 0 | 8 | 0 / 0 / 0 / 0 |
| Build | 10 | 0 | 10 | 0 / 0 / 0 / 0 |
| Portal acceptance | 4 | 0 | 4 | 0 / 0 / 0 / 0 |

Type checking and the portal build also completed. The unit run included all
six session MFA cases, the 32-case settings suite with ten MFA policy cases,
and all six hosted MFA-profile helper cases. No additional focused run was
needed for an omitted unit/helper file. This current run also includes the
three new slice stop-wait unit cases. Full output is in
`/tmp/thermus-final-path-candidate.KSExUs/check.log`. Durations were 13,819 ms
for Node unit, 168 ms for portal unit, 10,628 ms for build, and 160 ms for
portal acceptance. It supersedes the earlier 2,474-unit result in
`/tmp/thermus-final-candidate.HgG3GF/check.log` and the 2,471-unit results in
`/tmp/thermus-final-recheck.V0AXb9/check.log` and
`/tmp/thermus-pr108-final-check.ExahSe/check.log`.

The final integration, acceptance, and container results follow the path-only
correction. Each command exited 0. Every report has zero failures,
cancellations, skips, and todo cases:

| Command or scope | Tests | Suites | Passed | Duration |
| --- | ---: | ---: | ---: | ---: |
| `npm run test:integration` | 415 | 44 | 415 | 16,239 ms |
| `npm run test:acceptance`, Node cases | 303 | 42 | 303 | 28,051 ms |
| `npm run test:acceptance`, portal cases | 4 | 0 | 4 | 156 ms |
| Compiled WorkOS interface, `dist/test/interface/auth/workos.test.js` | 38 | 8 | 38 | 8,236 ms |
| `npm run test:container` | 12 | 1 | 12 | 86,256 ms |
| `npm run test:mcp:renderer` with pinned `LIGHTPANDA_BIN` | 7 | 1 | 7 | 10,315 ms |

The interface and renderer logs are
`/tmp/thermus-final-gates.dX8Dvd/workos-interface.log` and `renderer.log` in
that directory. The final container log is
`/tmp/thermus-final-path-candidate.KSExUs/container.log`. These current passes
supersede the older results for those scopes in the historical table. The
final integration and acceptance logs are
`/tmp/thermus-final-path-candidate.KSExUs/integration.log` and
`acceptance.log` in that directory. Both commands exited 0. These supersede
the earlier collision/failing integration runs and the earlier integration/
acceptance passes in `/tmp/thermus-final-candidate.HgG3GF/` and
`/tmp/thermus-final-recheck.V0AXb9/`.
The two corrected fixture files also passed their focused check: 15/15 tests
in 2 suites, zero failures, cancellations, skips, or todo cases, in 3,225 ms;
log `/tmp/thermus-final-recheck.V0AXb9/focused-acceptance.log`.

The final runtime source-focused run passed 132/132 tests in 17 suites, with
exit 0 and zero failures, cancellations, skips, or todo cases, in 3,781 ms.
Its log is `/tmp/thermus-mfa-policy-focused.log`. The wording source follow-up
passed 38/38 in 6 suites, exit 0 with the same zero counts, in 1,452 ms, in
`/tmp/thermus-mfa-policy-wording.log`. These are source executions and do not
replace the complete-candidate gates recorded above.

The latest `habit-hooks` run includes the final canonical probe-path
correction, the new shutdown helper, process probe, and test files. It exited 1 with 325 comment findings and 9 oversized-file
findings. `.habit-hooks/snooze.json` remains `[]`. The log is
`/tmp/thermus-pr108-path-habits.d3FaoW/habit-hooks.log`.

Against the preceding accepted 325-comment/9-size run, this recheck has no
new or removed comment text and no new size finding. The path-matrix portal
build comment moved from line 33 to line 34. All nine comments in
`test/support/processes/module-paths.ts` retain the accepted source/dist, D8,
preload/probe, and runtime-path validation reasons; all three in
`test/unit/test-support-paths.test.ts` retain the runtime-path and later
portal-build ordering reasons. All 325 comments and 9 sizes remain justified
under the manager's prior signoff. The preceding log is
`/tmp/thermus-pr108-shutdown-habits.rno5PQ/habit-hooks.log`.

Before those runs, the preceding run had 317 comments and 8 sizes, all signed off by the manager.
The shutdown change removed one stale entry-point comment about registering
handlers immediately before the instructions. The other 316 texts retain
their accepted reasons. Nine comments and one size are newly reported below;
the manager reviewed and signed off all retention reasons below. No finding was
snoozed or suppressed, and this is not a habit-hooks exit-0 claim.

### Latest comment findings: 9 retained

| File | Current lines | Count | Accepted reason to retain |
| --- | --- | ---: | --- |
| `test/support/processes/stop-signal.ts` | 1, 2 | 1 | An outer launcher can forward the terminal signal again. Keeping both handlers until site cleanup and logging flush prevents that repeated signal from terminating cleanup. This is an external process/lifetime constraint, not implied by the promise type. |
| `test/integration/auth/workos-provider-organizations.test.ts` | 25, 26, 27, 28 | 4 | The real SDK, session, directory, routes, and MCP server collaborate with a local WorkOS API fake and permission probes. These comments define the integration boundary and prevent an offline pass from becoming a real-provider claim. |
| `test/integration/auth/workos-provider-organizations.test.ts` | 38 | 1 | Billing uses a real administration route rather than a probe destination. This boundary determines what the positive Required-profile billing case proves. |
| `test/integration/auth/workos-provider-organizations.test.ts` | 50, 51 | 2 | The deliberate actor matrix distinguishes exact User/Admin/SuperAdmin grants, inactive membership, and the inert default role across organizations. It explains why selection and each protected destination must differ. |
| `test/integration/auth/workos-provider-organizations.test.ts` | 108 | 1 | Key-set reads belong to SDK token verification and are excluded from the organization-operation recorder. The filter keeps current-membership and selection assertions about their intended collaboration. |

The ninth size finding is
`test/integration/auth/workos-provider-organizations.test.ts`, 235 lines.
The manager retains this cohesive current-organization authorization
specification because it connects the real session, directory, account routes, and MCP
server with a shared actor, selection, and invalid-provider-response matrix.
The explicit Required billing fixture changes assurance configuration within
that same collaboration. A line-only split would duplicate that context or
hide the permission boundary in helpers.

For the preceding run, 255 original comment texts, 60 retained delta texts,
and 2 additional setup comments totaled 317. Three original texts had been
replaced by explicit MFA-policy comments. The current total is 317 minus the
removed startup-order comment plus the 9 additions, or 325. All 325 comment
findings and all 9 size findings have accepted retention reasons. The earlier
317-comment log and incremental delta are
`/tmp/thermus-pr108-final-habits.rabzy1/habit-hooks.log` and `delta.md` in that
directory. The earlier 60-comment delta is in
`/tmp/thermus-pr108-final-check.ExahSe/`. Of those 60, 53 texts already occur
at the same path on reviewed main `bb4afa8f`; 7 have new or changed text.
Provenance is context, not a reason for retention.

### Preceding comment findings: 2 retained

| File | Current line | Accepted retention reason |
| --- | ---: | --- |
| `test/acceptance/auth/hosted-live-setup.test.ts` | 54 | Retain: inherited `NODE_TEST_CONTEXT` changes the child reporter, and caller WorkOS settings must be removed. These runner/environment rules make the setup assertions independent and prevent accidental live access. |
| `test/acceptance/auth/hosted-live-setup.test.ts` | 61 | Retain: `--import` must precede `--test` so the network blocker loads in the test-file process and each outbound attempt is recorded. This process/loader ordering is required for isolation and is not implied by the argument names. |

### New or changed comment findings: 60

| File | Current reported lines | Count | Reason to retain |
| --- | --- | ---: | --- |
| `src/hosted-workos-application.ts` | 36 | 1 | The composition can discard MFA evidence, while only the provider policy can authorize Required inference. This direction of authority is a security contract that the optional field type alone does not explain. |
| `test/integration/auth/workos-browser-session.test.ts` | 22, 23 | 2 | These comments define the SDK collaboration and local-fake boundary. They prevent an offline integration pass from being reported as real WorkOS behavior. |
| `test/support/hosted-live/authkit-driver.ts` | 24, 65, 118, 119, 138, 139 | 6 | 24 protects URLs and typed values from Playwright errors. 65 records the organization choice at consent. 118–119 distinguish intercepted callbacks with no server from 138–139, where the real server answers. These are privacy and driver protocol constraints. |
| `test/support/hosted-live/browser-session.ts` | 31, 71 | 2 | 31 identifies ownership of the latest rotated seal. 71 states that this SDK proof intercepts the callback rather than exercising a server. Both facts determine the evidence scope. |
| `test/support/hosted-live/connect-grant.ts` | 21, 22 | 2 | 21–22 distinguish the selected AuthKit sign-in policy from consent, PKCE, the MCP resource, and an intercepted callback. The text prevents MFA or real-server claims beyond this driver. |
| `test/support/hosted-live/portal-visit.ts` | 23, 24, 36, 37, 38, 49, 50, 57, 63, 85, 91 | 11 | 23–24 require the real server callback and browser cookies. 36–38, 85, and 91 explain invitation authorization state and token/URL redaction. 49–50 exclude form tokens from messages; 57 and 63 define redirect and Origin handling. These are browser transport and privacy contracts. |
| `test/support/hosted-live/settings.ts` | 31 | 1 | A short timeout and no retry make a live failure belong to the case that caused it. A client type does not express that causal test constraint. |
| `test/support/doubles/workos/workos-fake.ts` | 188, 258 | 2 | 188 limits Password inference to explicit Required policy. 258 makes an MFA step conditional on provider policy. These comments define fake semantics and prevent the old staging requirement from becoming an assumed universal contract. |
| `test/acceptance/auth/hosted-live/hosted-server.ts` | 21, 88, 107, 108, 164, 199, 229 | 7 | 21 and 199 preserve the shared 300-second expiry timing. 88 and 107–108 isolate consent revocation and credential-type refusal. 164 distinguishes navigation from a redirect response. 229 identifies operator session termination. The ordered cases depend on these causes and lifetimes. |
| `test/acceptance/auth/hosted-live/organization-server.ts` | 15, 22, 47, 48, 51, 82, 165 | 7 | 15, 22, 47–48, and 51 explain session reuse and the later expiry case. 82 records provider membership ordering. 165 prevents an extra page read from refreshing before the tested post. These comments preserve causal sequencing. |
| `test/integration/auth/fixtures/workos-session-world.ts` | 9, 10, 39, 81, 95 | 5 | 9–10 and 39 define local API isolation and real SDK collaboration. 81 specifies Cookie-header reconstruction. 95 distinguishes a simulated AuthKit return from a real provider sign-in. These are fixture and evidence boundaries. |
| `test/unit/auth-workos/fixtures/workos-session-client-double.ts` | 30, 90, 96, 130 | 4 | 30 defines the narrow recorded SDK seam. 90 explains why unsigned decoding is safe only inside this double. 96 records browser cookie projection. 130 explains the pinned SDK’s separate jose error classes. These prevent false production or error-type assumptions. |
| `src/auth/hosted-auth/workos/workos-browser-session.ts` | 68 | 1 | Prior sealed-cookie evidence must be masked before a read, refresh, or organization change can use or preserve it. The comment records the security reason for this early conversion. |
| `src/auth/hosted-auth/workos/workos-settings.ts` | 3, 10, 27, 33, 38, 39, 71 | 7 | 3 separates provider settings from common deployment selection. 10 and 71 protect exact issuer identity. 27 requires secret-safe refusal messages. 33 and 38–39 distinguish the browser issuer and shared user authority from MCP client identity. These are validation and identity contracts. |
| `src/auth/hosted-auth/workos/workos-sign-in.ts` | 27, 89 | 2 | 27 limits Password inference to a provider-required second step. 89 records the absence of an MFA claim and the inability of Optional to prove completion. These explicit assurance constraints are not implied by the method name. |

The replaced historical texts are the WorkOS fake's sign-in-method comment
at old line 188 and authorization-code comment at old line 257, and the
sign-in MFA-inference comment at old line 83. Their current versions state the
explicit Required/Optional contract.

### Preceding oversized files: 8 of 8 retained

The manager retains the five earlier findings under their concrete
rationales in the historical table: the three hosted WorkOS acceptance files,
the auth work-slice acceptance file, and the pinned WorkOS interface file.
In the preceding run their sizes were 518, 264, 294, 248, and 1,181 lines.
The organization acceptance file is now 265 lines after the typed Required
fixture correction; its existing cohesive-flow rationale still applies.

| New or size-changed file | Current lines | Reason to retain |
| --- | ---: | --- |
| `test/acceptance/auth/hosted-live/hosted-server.ts` | 235 | One cohesive live scenario shares browser and Connect sessions, role changes, revocation, and ordered expiry checks. The visible sequence explains these dependencies. A split only for line count would obscure them. |
| `test/support/doubles/workos/workos-fake.ts` | 643 | The earlier stateful-provider rationale still applies: authentication, memberships, roles, invitations, and refresh share identities and state. The one-line growth expresses the explicit MFA policy within that same WorkOS contract; it adds no separate responsibility. |

The new eighth finding is
`test/acceptance/auth/hosted-live-setup.test.ts`, 204 lines. The manager
signs off retention: one cohesive executable setup
specification shares the child-runner, environment isolation, outbound
blocker, preflight report, and secret-redaction assertions. The correction
makes the global-preflight cancellation contract explicit. A split only for
the four-line excess would separate those related setup observations without
adding a clearer responsibility.

The seven preceding oversized findings retain their accepted reasons, with
the organization file's size updated to 265. The eighth is retained for the
accepted reason above. No finding was snoozed or suppressed; habit-hooks is
still recorded as exit 1.

## Current manual proof: passed, including corrected shutdown delivery

The baseline user was absent. WorkOS created
`user_01M504TC1EPP60DNH3FNE0MPNT` at `2026-10-15T16:02:42.827Z` and verified
its email at `16:02:42.862 UTC` during the first Google attempt. That attempt
stopped at Required MFA, with no membership or authorized browser session.
After the approved Optional configuration change, the same newly created
identity resumed the walk and completed its callback. This is a fresh-account
walk resumed after configuration changes, not an uninterrupted new-user login
entirely under the final Optional configuration.

The resumed `thermus.ai` Google sign-in completed the callback and reached the
portal without a required MFA challenge. WorkOS membership
`om_01M5067Q9YXK7WZMTDZ0B7PPNC` was created at
`2026-10-15T16:27:28.952Z` in
`org_01M4YYEQ6V2ZBM3RQEEV8CKFEA` with the User role (`user`). The browser's
`/session` confirmed `signedIn: true`, `mfaCompleted: false`, and that same
organization. This establishes the Google callback and selected browser
session portion, without claiming actual MFA proof.

Claude completed its separate OAuth flow. An actual authenticated MCP fetch
then succeeded and returned a Markdown body without a heading. The completed
OAuth and fetch are recorded as partial live proof; no heading/title assertion
is recorded for that response.

Axiom recorded the positive fetch at `2026-10-15 16:36:45 UTC`: 957
characters of Markdown with the matching fresh subject and target tenant.
The fetch body had no heading, as noted above.

The User role was removed at `16:39:35 UTC`. The CLI reported
`access_denied` after refreshing, and no new fetch appeared. The check does
not claim use of byte-identical access tokens before and after role removal.
A Google re-login at
`16:41:38 UTC` recorded `automatic-enrollment` with outcome `denied` and kept
the membership with `member` only. User was restored at `16:46:09 UTC`; the
organization page then selected Thermus AI. These checks show current access
refusal and no automatic restoration of the removed role.

After User was restored, Claude cached a needs-auth state. Explicit
`claude mcp login thermus-pr108-live` succeeded at `16:48:05 UTC` under the
existing approved grant, without new consent. The client refreshed several
times. The last observed refresh at `16:48:20.805 UTC` returned a 300-second
lifetime, and a fetch succeeded at `16:48:21.525 UTC`.

At `16:49:20.837 UTC`, the existing REST helper revoked only the fresh user's
Claude authorized application. The request returned HTTP 204, and the
read-back list was empty. The REST identifier was
`connect_app_01M5069TKYMR4ZDGYW3C6J7FZE`; it is distinct from the dashboard's
`app_…` identifier.

The post-expiry retry started at `16:53:25.010 UTC`, beyond the 300-second
window from the last observed refresh. The CLI reported that the token had
expired six seconds earlier. Refresh returned `invalid_grant` at
`16:53:26.832 UTC`, then HTTP Unauthorized at `16:53:27.104 UTC`. No MCP tool
ran, and no fallback was used. Claude refreshed proactively for each operation
in this walk; revoked consent can therefore fail on refresh even while a
prior JWT is unexpired. This later retry proves refusal after expiry. It does
not infer immediate JWT invalidation from a proactive refresh failure.

The final Axiom read at `16:56:38 UTC` showed only the two successful fetches,
at `16:36:45 UTC` and `16:48:21 UTC`, in the manual-run scope. No fetch
appeared after consent revocation. The membership read-back at `16:54 UTC`
confirmed that the intended User-only grant was restored.

Client cleanup completed: `claude mcp logout` and
`claude mcp remove --scope local thermus-pr108-live` both exited 0. Ctrl+C
stopped manual process 28027 with exit 1, no fatal record, and no remaining
listeners on the slice ports. However, repeated Axiom read-backs did not show
the expected `Stopping after SIGINT` record. At that point, shutdown log
delivery was an open gap; that run was not a clean-stop or logger-flush pass. A secret-free launcher
reproduction confirmed that repeated forwarded signals could interrupt
cleanup. The reviewed correction adds a slice-local first-signal wait before
asynchronous startup and retains its handlers through site cleanup and
logging flush. Production `src/index.ts` and the shell/pnpm launcher are
unchanged. The focused source run passed 20/20: 3 new helper unit cases,
2 real pnpm/tsx/outer-forwarder integration cases, 13 launcher cases, and
2 existing global stop cases. Log:
`/tmp/thermus-pr108-shutdown-final-focused.log`. The fixed manual slice
(PTY 11891) then stopped after Ctrl+C with exit 0. Its Axiom scope is
`thermus-work-slice-96e94394-3233-4a96-8d35-e8997445ec13`. Axiom then showed
the authentication and Listening records at `17:08:34 UTC` and
`Stopping after SIGINT` at `17:08:51 UTC`. This actual private launcher, pnpm,
and tsx run proves the corrected clean stop and Axiom delivery. Safe evidence
is in `/tmp/thermus-pr108-axiom-shutdown.txt` and the matching `.jpg`.

The [Required-profile selective-revocation case](../../test/acceptance/auth/hosted-live/administration-server.ts)
separately reused the exact JWT across role changes in the passing complete
Required profile. This automated real-provider proof is separate from the
manual CLI flow, which refreshed before role refusal. Both complete MFA
profiles passed.

The Google, Connect, fetch, Axiom, current-role refusal, renewal, and
post-expiry consent-refusal checks passed. The corrected shutdown and Axiom
delivery also passed. The manual walk and all requested complete-candidate
gates passed; the candidate is prepared for owner review.

## Historical checks for candidate 975b2b10

All passing test reports below have zero failures, cancellations, skips, and
todo tests. Counts are per command; repeated cases are not additional test
coverage. `npm run check` also completed type checking and the portal build.

| Command | Exit | Reported result |
| --- | ---: | --- |
| `npm run check` | 0 | Node unit: 2,449 tests in 183 suites, all passed; portal unit: 8/8; build: 10/10; portal acceptance: 4/4. |
| `npm run test:integration` | 0 | 411/411 tests in 44 suites passed. |
| `npm run test:acceptance` | 0 | 298/298 tests in 42 suites, then 4/4 portal acceptance tests passed. |
| `npm run test:container` | 0 | 12/12 tests in 1 suite passed in 105,520 ms; Docker 29.5.2, `linux/arm64`. |
| `habit-hooks` | 1 | 258 `non-essential-comment` and 6 oversized-file findings. The manager accepts retention for the exact locations and reasons below. The command did not exit 0. |
| `npm run test:mcp:renderer` with pinned `LIGHTPANDA_BIN` | 0 | Optional renderer gate: 7/7 tests in 1 suite passed in 9,468 ms with pinned Lightpanda 1.0.0. |
| `npm run test:hosted-live` through the staging launcher | 0 | 77/77 tests in 17 suites passed in 697,702 ms. This complete run includes the changed Google-only and DCR/CIMD configuration proofs. It preceded the Google OAuth restoration below; no second complete run is recorded for the restored settings. |
| Live slice, invalid Bearer request over trusted HTTPS | 0 | The running slice returned `401 invalid_token` and a Bearer challenge with `https://localhost:46443/.well-known/oauth-protected-resource/mcp`. |
| Manual Google → Connect → HTTPS MCP fetch → Axiom proof | Passed later | The user chose a fresh `thermus.ai` Google account. Restored Google OAuth reached AuthKit authenticator enrollment; shared Staging was later set to Optional for the revised runtime contract. Current Google, Claude OAuth, and fetch progress is recorded above. The matching Axiom output, role-removal checks, renewal, and post-expiry refusal later passed. The corrected launcher later stopped with exit 0 and delivered its stopping record to Axiom, completing the manual walk. |

Full check logs at the time of review:
`/tmp/thermus-pr108-checks.b4oEa2/check.log`, `integration.log`,
`acceptance.log`, `container.log`, `habit-hooks.log`, `hosted-live.log`, and
`slice-final-wording.log` in that directory.
These are local temporary evidence files; the results and retention decisions
are preserved in this repository record.

## Historical focused checks

| Scope | Result | Evidence limit |
| --- | --- | --- |
| Merge verification before the new onboarding work | 138/138 passed; the then-existing HTTPS site cases also passed 3/3. | Baseline after main integration; these runs do not certify the later source changes. |
| Final onboarding candidate | Exit 0; 82/82 tests in 9 suites passed. Breakdown: 34 onboarding integration, 2 callback unit, 3 new acceptance, 5 existing slice acceptance, and 38 WorkOS interface tests. | Compiled output from the shared build; local WorkOS API fake and renderer double. |
| Final HTTPS front | Exit 0; 11/11 passed. | Compiled integration cases; authenticated POST, token/current-role refusal, disconnect, streaming, and application/listener cleanup. |
| Final launcher | Exit 0; 13/13 passed. | Source and compiled unit cases use `pnpm` and `openssl` doubles; include the slice organization default, override, and secret-output checks. |
| Dee scenario wording correction after the complete checks | Exit 0; 5/5 source and 5/5 final compiled slice acceptance tests passed, with zero failures, cancellations, skips, or todo cases. | Only the title and comment changed: a non-`thermus.ai` Google identity has no automatic membership; a later external User grant is observed on the next MCP request. |

The compiled onboarding command selects these five files with `pnpm exec
node --test`:

```sh
pnpm exec node --test \
  dist/test/unit/auth-workos/workos-sign-in-onboarding.test.js \
  dist/test/integration/auth/workos-google-onboarding.test.js \
  dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-onboarding.test.js \
  dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.js \
  dist/test/interface/auth/workos.test.js
```

The HTTPS and launcher focused files are
`dist/test/integration/auth/hosted-live-site.test.js` and
`dist/test/unit/work-slice/auth-workos-mcp-url-fetch-script.test.js`.
The wording-only check ran the existing slice acceptance file from source,
then reran its final compiled output; both passed 5/5.
`bash -n` for the shell launcher and `git diff --check` also passed.

These historical offline passes establish application behavior and the tested
contracts. They do not replace the separate current manual evidence above or
establish the separate corrected-launcher Axiom delivery proof.

## Provider changes during the manual walk

The target organization changed outside this implementation. It is now named
"Thermus AI", with the same ID `org_01M4YYEQ6V2ZBM3RQEEV8CKFEA` and external
ID `thermus-work-slice`. It has a verified `thermus.ai` domain and an active
Google SAML connection. Those resources remain in place.

SSO enforcement and domain capture directed the manual sign-in to Google
SAML. The user reported `403 app_not_configured_for_user` and explicitly
chose to restore Google OAuth. The manager changed the following settings
through the WorkOS connector and read them back:

| Setting | Read-back |
| --- | --- |
| `isGoogleOauthEnabled` | `true` |
| `domainSsoRequired` | `false` |
| Domain capture (`setDomainCaptureEnabledDomains`) | `[]` |
| `isDomainJitProvisioningEnabled` | `false` |

The organization name, verified domain, SAML connection, and all other
settings were preserved. At that read-back, password MFA was still Required.
The restored Google OAuth flow reached AuthKit authenticator enrollment. The
user then explicitly chose shared Staging with MFA Optional and revision of
the runtime policy and tests. The manager applied
`updateAuthkitSettings { mfaEnabled: "Optional" }` to
`environment_01M4VDKATD5PXZT4H01EHCMR2A` and confirmed Optional, password
sign-in on, Google OAuth on, email verification required, DCR on, and CIMD on.
The manual slice was stopped before the new checks. The manager later set
only provider `mfaEnabled` to Required and verified the read-back for the
separate Required profile. The complete Required run later passed. The manager restored only
`mfaEnabled` to Optional and verified the final read-back at `17:23:59 UTC`.
At that stage, callback success and automatic membership were not yet
recorded. The later manual results are recorded above; post-expiry refusal
and corrected shutdown delivery passed. All requested candidate gates also
passed.

The 77/77 hosted live gate pass came before this restoration. The settings
read-back and progress to authenticator enrollment are not a second complete
gate pass or a completed end-to-end proof.

## Optional MFA follow-up: final gates passed

The accepted contract is `WORKOS_MFA_POLICY=optional` by default, or the exact
value `required` for an explicit provider requirement. The runtime validates
the enum; it does not read or change WorkOS MFA settings at startup. Optional
marks all sign-in methods unproven and ignores older cookie evidence on read,
refresh, and organization change. Product/MCP access remains available with
User, while administration pages and writes remain refused. No step-up UI
or actual Optional MFA proof is added. The slice always keeps evidence
unproven, even with Required settings.

The same `npm run test:hosted-live` command selects Optional by default or
Required with `WORKOS_MFA_POLICY=required`. Each profile must pass its provider
preflight before login. The Required profile retains positive administration
coverage; the Optional profile proves normal access and administration
refusal. Both profiles register 77 cases and keep operator/API contract
proofs separate from application session authority. The Optional profile
completed with exit 0: 77/77 tests in 16 suites, zero failures, cancellations,
skips, or todo cases, in 585,175 ms. Log:
`/tmp/thermus-integration-optional.RI6Dru/hosted-optional.log`. The Required
profile also completed with exit 0 under Node 24.20.0: 77/77 tests in
17 suites, zero failures, cancellations, skips, or todo cases, in 736,500 ms.
Log: `/tmp/thermus-final-required.ddMXRc/hosted-required.log`. Each profile
has its own complete passing result.

The final provider read-back at `17:23:59 UTC` confirmed environment MFA
Optional, Google and Password enabled, DCR and CIMD enabled, and email
verification required. For the slice organization it confirmed Google on,
Password off, domain and non-domain SSO enforcement off, domain and
non-domain MFA enforcement off, and domain JIT off. Only `mfaEnabled` was
changed for the final restoration. No provider changes remain. The fresh
membership `om_01M5067Q9YXK7WZMTDZ0B7PPNC` remained active with User only;
its update time stayed `16:46:09.797 UTC`.

| Follow-up evidence | Result | Limit |
| --- | --- | --- |
| Intermediate `npm run check` | Passed: 2,454 Node unit tests, 8 portal unit tests, 10 build tests, and 4 portal acceptance tests. | This preceded the final Optional/Required contract changes and is not a final-candidate pass. |
| Intermediate focused MFA checks | 9/9 passed. | Earlier slice/session regressions; later default-policy and profile changes still need final checks. |
| Intermediate integration command | 413 tests reported; 9 failed because port 46443 was occupied. | The port conflict was cleared. The failed command is not a gate pass; a completed rerun is required. |
| Earlier complete integration command | 412/413 passed; one positive SuperAdmin billing fixture failed. | The fixture now explicitly selects Required MFA. Its complete source file passed 7/7 in 1 suite, with no failures, skips, or todo cases; log `/tmp/thermus-workos-provider-organizations-mfa-focused.log`. The manager reviewed the correction. The later complete rerun passed 415/415, as recorded above. |
| Later complete integration command | 406/415 passed; fixed-port cases failed with `EADDRINUSE` during a brief manual-slice overlap. | This coordination/environment collision is not recorded as a source regression or a gate pass. The later rerun with exclusive port ownership passed 415/415; its log is recorded above. |
| Earlier check after shutdown correction | Exit 0; 2,474 Node unit, 8 portal unit, 10 build, and 4 portal acceptance tests passed. | Compiled Node unit: 183 suites, zero failures/cancellations/skips/todo. This earlier check is superseded by the 2,475-unit final path-candidate check at the start of this document. |
| Optional full hosted-live profile | Exit 0; 77/77 in 16 suites, all zero failure/cancellation/skip/todo counts; 585,175 ms. | Complete Optional run, including provider preflight and normal access/admin refusal. It does not establish the separate Required profile or the later shutdown correction. |
| Shutdown correction source focus | Exit 0; 20/20 passed. | Covers first-signal retention and real forwarded-signal cleanup, with launcher/global regressions. The later actual launcher run stopped with exit 0 and delivered `Stopping after SIGINT` to Axiom, as recorded above. |
| Local gates before final test-path correction | Passed. | Check, integration 415/415, acceptance 303/303 plus 4 portal cases, interface, container, and renderer results are recorded above. Habit-hooks retention is signed off with exit 1 and no snooze. |
| Final canonical-path correction | Focused source 3/3 and final check/integration/acceptance/container passed. | One canonical probe-path export, its integration import, and the existing path matrix changed. No runtime behavior changed. Latest habit-hooks remains exit 1 with the same retained 325 comments and 9 sizes. |
| Required hosted-live profile | Exit 0; 77/77 in 17 suites, all zero failure/cancellation/skip/todo counts; 736,500 ms. | Complete Required run, including exact-JWT role-removal refusal. Shared Staging Optional was restored and verified at 17:23:59 UTC. |
| Full fresh-account Google/Connect/HTTPS/Axiom walk | Passed. | Google callback, selected browser organization, and automatic User membership passed as recorded above. Claude OAuth and the actual fetch also passed. Matching Axiom output and role-removal refusal also passed. Renewal, consent removal, and post-expiry refusal passed as recorded above. The corrected launcher shutdown also passed with exit 0 and its stopping record in Axiom. |

The earlier 77/77 live gate pass and the retained habit-hooks review below
belong to the historical source and provider configuration. They do not
certify the new MFA source or either new profile run.

## Habit-hooks retention decision

`habit-hooks` exited 1. Its only findings are the 258 comment findings and the
6 oversized files below. For that historical candidate, the manager reviewed
and accepted each retention reason under [AGENTS.md](../../AGENTS.md) and the
[test gate policy](test-gate-policy.md#required-runs), which permit a reason
for a retained smell. This is not a claim that habit-hooks exited 0.
`.habit-hooks/snooze.json` remains `[]`; no suppression or snooze was added.

The source review is `/tmp/thermus-pr108-habit-hooks-retention.md`. Each row
lists every reported location in that file. The tables map 258/258 comment
findings across 26 files and 6/6 oversized-file findings. Exact stripped-text
provenance at the same path is 186 from main, 55 from the original PR head,
and 17 from this implementation, totaling 258. A moved equivalent comment can
appear under the original PR head in this comparison. Provenance is context;
the behavioral reason in each row is the retention decision.

### Comment findings: 258 of 258

| File and all reported lines | Findings | Reason to retain |
| --- | ---: | --- |
| `src/hosted-workos-application.ts`: 21, 22, 29, 30, 34, 38, 45, 46, 86, 87 | 10 | Retain the connection and composition comments (21–22, 29–30, 34): they define the opt-in test/slice seams and state that normal production has neither a fetch tool nor automatic enrollment. Retain 38, 45–46: timeout/retry and lazy network behavior are operational constraints, not promises visible in the types. Retain 86–87: the same directory must serve access checks and account operations, so changes cannot use a separate stale grant source. |
| `src/index.ts`: 38, 67, 69, 78 | 4 | Retain 38: it protects the edition boundary and the lazy-load constraint. Retain 67, 69, 78: shutdown order, early signal registration, and cleanup after failed startup prevent hangs and listener leaks; the order is a lifecycle rule. |
| `test/unit/stop-signal.test.ts`: 7 | 1 | Retain 7: EventEmitter is a deliberate substitute for process signals. Its emit call must include the signal argument, which is not implied by the event name; the comment records that contract. |
| `test/unit/test-support-paths.test.ts`: 12, 13, 33 | 3 | Retain 12–13: these checks exist because the compiler cannot validate runtime paths and the gates that consume them run less often. Retain 33: the portal build is absent at this stage of the check command, so this test must check its parent rather than require a completed portal build. |
| `src/organizations/change-records.ts`: 3, 4, 7, 8, 13, 15, 20, 21, 31, 34, 43, 44, 45, 71 | 14 | Retain 3–4, 7–8, 13, 15, 20–21, 31, 34: these define public outcome meanings, timestamp units, credential exclusion, and when the role becomes known. Retain 43–45 and 71: a failed write can have an unknown effect, must not be repeated, and records must select safe fields. These are audit and retry invariants. |
| `test/acceptance/auth/hosted-workos-administration.test.ts`: 11, 12, 13, 14, 20, 37, 38, 39, 107, 108, 134, 135, 142, 143, 172, 173 | 16 | Retain 11–14: the fake establishes application behavior only, not live WorkOS behavior. Retain 20, 37–39: the fixture includes an external-ID resource and an explicit seat/role matrix that explains the cases. Retain 107–108, 134–135, 142–143, 172–173: these distinguish safe CSRF token reads, actual writes, external-ID resource naming, and member-list reads from access reads. Removing these qualifications can make the assertions claim the wrong provider behavior. |
| `test/acceptance/auth/hosted-workos-organizations.test.ts`: 12, 13, 14, 32, 33, 34, 91 | 7 | Retain 12–14: the evidence boundary excludes proof of WorkOS itself. Retain 32–34: the fixture matrix explains inactive, default-role, cross-organization, and Super Admin cases. Retain 91: only refresh requests count as organization-switch evidence. |
| `test/acceptance/auth/hosted-workos.test.ts`: 15, 16, 17, 43, 44 | 5 | Retain 15–17: offline application checks cannot establish real WorkOS behavior. Retain 43–44: the role matrix explains why the same endpoint accepts or refuses each actor. |
| `test/acceptance/auth/hosted.live.ts`: 20, 53, 81, 113, 175, 176 | 6 | Retain 20 and 53: setup refusals must name no secret and all later settings must pass the same preflight. Retain 81: failed setup must fail the run without network activity or misleading skipped cases. Retain 113: metadata must satisfy the same jose contract as tokens. Retain 175–176: suite order deliberately reuses a 300-second expiry wait; reordering can invalidate the later expiry case. |
| `test/integration/auth/hosted-live-site.test.ts`: 18, 45, 46, 62, 63, 82, 89, 100, 101, 134, 147, 179 | 12 | Retain 18: placeholder settings must never call a real WorkOS environment. Retain 45–46: an absent PATH is not the same as an empty PATH for Node command lookup. Retain 62–63, 82, 134: cleanup must let a failing test exit, account for Node handle removal, and close MCP exactly once. Retain 89, 100–101: the two TLS observations deliberately use different certificate trust behavior and short-lived connections. Retain 147 and 179: fixed-port cases share the live/slice port and must be serialized. |
| `test/interface/auth/workos.test.ts`: 31, 32, 42, 162, 277 | 5 | Retain 31–32: pinned SDK proofs using a fake do not prove the real service. Retain 42: the type assertion deliberately detects SDK contract drift. Retain 162: omission of external_id differs from a present empty value. Retain 277: key-set, issuer, audience, and algorithm checks define the verifier boundary that these proofs must preserve. |
| `test/support/drivers/browser/https-client.ts`: 9 | 1 | Retain 9: trusting only the site certificate and using one connection per request are intentional TLS and resource-isolation properties of this test driver. |
| `test/support/hosted-live/local-https-site.ts`: 29, 46, 48, 50, 53, 54, 58, 59, 60, 61, 62, 66, 75, 81, 90, 99, 107 | 17 | Retain 29: generating a certificate also writes persistent filenames; the signature alone shows only returned buffers. Retain 46, 48, 50, 53–54: the exported options document defaults, ownership, logger routing, and the custom-application seam. Retain 58–62 and 75: the site is a specific two-listener deployment shared by a live gate and a manual slice, with different certificate/application lifetimes. Retain 66, 81, 90, 99, 107: resource order, preflight, independent listener ownership, early rejection observation, and partial-listen cleanup prevent leaked servers and deadlock. These comments explain why the disposal stack is registered in this order. |
| `test/support/hosted-live/portal-front.ts`: 7, 8, 23, 24, 25, 95 | 6 | Retain 7–8: HTTP routing owns no listener; the site owns the lifecycle. Retain 23–25: Chrome applies form-action to redirect targets after POST, which explains the WorkOS/AuthKit CSP origins. Retain 95: Set-Cookie must remain separate repeated fields, not a combined header; the flat array preserves that wire contract. |
| `test/support/processes/module-paths.ts`: 3, 4, 5, 6, 14, 17, 18, 21, 24 | 9 | Retain 3–6: D8 centralizes runtime path knowledge, and source and built modules have different depths. Retain 14 and 21: these exports deliberately name the repository containing package.json and the built program rather than a source entry. Retain 17–18: the portal build has a later build phase, so its parent alone is checked. Retain 24: --import requires URL preloads while the child probe is an executable path. These distinctions prevent path changes that compile but fail only at runtime. |
| `test/support/doubles/mcp/fetch-operation-spy.ts`: 5, 29 | 2 | Retain 5: the limit counts Unicode code points in the completed log line, not bytes or UTF-16 units and not the caller result. Retain 29: string iteration preserves surrogate pairs while the slice indices use UTF-16 offsets; this explains the otherwise non-obvious counting algorithm. |
| `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.ts`: 17, 18, 23, 29, 47, 73, 75, 84, 88, 115 | 10 | Retain 17–18: offline fakes cannot prove Google, client registration, or Axiom ingestion. Retain 23: the duplicated fixture is the second copy and follows the explicit DRY3 rule. Retain 29: the expected missing paragraph comes from a trusted selector fixture. Retain 47, 84, 88: listener URLs differ from public/audience URLs, close is idempotent, and shutdown preserves production order. Retain 73, 75: Google supplies no MFA evidence, and Dee’s example.com address must remain outside the automatic-enrollment domain so the manual membership case stays distinct. Retain 115: refused HTML pages are deliberately represented by an empty JSON body in this test driver. |
| `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts`: 1, 2, 3, 4, 5, 45, 46, 65, 82, 89 | 10 | Retain 1–5 and 45–46: the manual slice is a separate composition root with a direct-execution guard and a deliberate production boundary; it adds the fetch tool, full Markdown logs, and fixed verified-Google enrollment only to this slice. Retain 65: site cleanup must finish before the logger flushes. Retain 82: Ctrl+C can arrive immediately when instructions appear. Retain 89: WorkOS URIs require a root origin, so an otherwise valid URL with a path is refused. |
| `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts`: 1, 2, 3, 4, 27, 28 | 6 | Retain 1–4: this is a manual entry point and importable composition; its execution guard prevents side effects in acceptance tests. Retain 27–28: production deliberately excludes the mock provider and full page-text logging; this slice has neither OAuth nor browser pages, which explains its route behavior. |
| `test/support/doubles/workos/workos-fake.ts`: 12, 19, 31, 55, 62, 102, 119, 124, 137, 138, 156, 161, 162, 163, 164, 165, 172, 174, 175, 177, 179, 180, 182, 185, 186, 188, 190, 191, 196, 199, 200, 243, 244, 257, 264, 288, 301, 310, 311, 319, 320, 327, 328, 343, 344, 361, 389, 390, 391, 392, 405, 406, 411, 419, 426, 443, 444, 456, 457, 467, 476, 506, 528, 529, 543, 544, 558 | 67 | Retain all listed locations: they document the external WorkOS contract represented by this stateful fake, not merely the mechanics of its methods. The groups cover verified-email defaults (12, 172), default membership roles (19, 55, 62, 419), expiry and pagination behavior (31, 124, 137–138, 182, 185–186, 343–344, 426), revision/change semantics (102, 119, 199–200, 243–244, 301, 467, 558), error shapes (156, 190–191), fake scope and stable identities (161–165, 177, 196, 288, 327–328, 506), privacy canaries (174–175), external-ID resource naming (179–180, 389–392, 405–406), authentication and refresh behavior (188, 257, 264), non-idempotent/reactivating creation (361), single-role assignment semantics (411), and invitation side effects/status/roles (310–311, 319–320, 443–444, 456–457, 476, 528–529, 543–544). Tests rely on these provider-specific behaviors. Keeping the contract next to the fake avoids treating it as proof of unobserved live service behavior. |
| `test/integration/auth/fixtures/https-site-fixtures.ts`: 8 | 1 | Retain 8: the fixture settings explicitly cannot access a real WorkOS environment; this states the isolation boundary of the HTTP integration cases. |
| `test/unit/work-slice/fixtures/auth-workos-mcp-url-fetch-script-harness.ts`: 10, 11, 12, 24, 35, 36, 66, 97 | 8 | Retain 10–12: each launcher case runs in a temporary physical repository so it cannot change the real rules, certificate, or portal build. Retain 24: the openssl substitute preserves the base64 length contract without generating a real secret. Retain 35–36: the shell-to-JSON fixture has a restricted quoting domain and deliberately records no secret values. Retain 66: the physical path must match shell resolution through symlinks. Retain 97: an inherited shell setting could defeat isolation and make missing-setting cases falsely pass. |
| `src/auth/hosted-auth/workos/workos-browser-session.ts`: 14, 16, 26, 34, 43, 44, 79, 88, 93, 94, 95, 108, 116, 125, 152, 162, 163 | 17 | Retain 14, 16, 26, 34, 43–44, 79, 88: these define shared authority, clock units, display-only data, logout behavior, and the session/CSRF/MFA envelope across rotating seals. Retain 93–95, 108, 116, 125, 152, 162–163: the pinned SDK cannot distinguish some invalid/expired/new-key states, a rotated refresh seal must survive a refused organization switch, and only terminal failures clear the cookie. These are security and outage-preservation rules, not obvious from method names. |
| `src/auth/hosted-auth/workos/workos-google-onboarding.ts`: 29, 30, 31, 77 | 4 | Retain 29–31: enrollment is opt-in, retains existing grants/status, and has only an in-process queue; external writers and permanent deletion remain limitations. Retain 77: an unknown create outcome is reconciled by read and must never trigger a second create because WorkOS create can reactivate an account. |
| `src/auth/hosted-auth/workos/workos-session-client.ts`: 3, 16, 26, 37, 58, 59, 64, 69, 70, 75 | 10 | Retain 3, 26, 37: the types form the minimal adapter contract of the pinned SDK rather than generic domain session objects. Retain 16: verified email is trusted only from the code exchange, never from callback input or decoded token claims. Retain 58–59: the SDK embeds its own jose, so instanceof against the separately installed package fails. Retain 64, 69–70, 75: new signing keys, damaged seals, and 4xx OAuth refusals need different retry/session behavior; these comments state the SDK-specific classification reasons. |
| `src/auth/hosted-auth/workos/workos-sign-in.ts`: 43, 44, 72, 83, 89, 102, 122 | 7 | Retain 43–44, 72, 89, 122: PKCE state/verifier ownership, single-use cleanup, ordered pre-exchange validation, and rejecting duplicate callback values are trust-boundary requirements. Retain 83: WorkOS provides no MFA claim, so only the configured required-MFA password method supplies evidence. Retain 102: invalid, reused, and expired codes are terminal refusals, not provider outages. |

### Oversized files: 6 of 6

| File | Lines in final candidate | Reason to retain |
| --- | ---: | --- |
| `test/acceptance/auth/hosted-workos-administration.test.ts` | 518 | One application acceptance suite for hosted administration through real HTTP and a WorkOS fake. Its named scenario groups share the same actor/role matrix, request recorder, and grant/invitation assertions. Splitting by a line threshold would duplicate that scenario context or create a fixture module solely to distribute lines. This PR changes the composition call and retains the suite’s public behavioral scope. |
| `test/acceptance/auth/hosted-workos-organizations.test.ts` | 264 | One organization onboarding/selection acceptance suite. The actor matrix and switch-request evidence serve the same public flow. The existing file is cohesive; no additional concern was introduced by the composition-call update. |
| `test/acceptance/auth/hosted-workos.test.ts` | 294 | One hosted authentication acceptance suite with browser/session, Connect, and connection-startup groups using one HTTP site and identity matrix. The existing suite proves the same boundary after the composition seam change. Its groups are already named; a size-only split offers no clearer public contract. |
| `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.ts` | 248 | One offline acceptance specification of the slice composition in both MCP protocol eras, including refusal cases. The same fake site, renderer, logger, and actors make the observable fetch result and safe refusal assertions comparable. The file existed in b846e1a and remains a single coherent end-to-end composition suite. New automatic-enrollment acceptance cases live in a separate file rather than expanding this suite. |
| `test/interface/auth/workos.test.ts` | 1181 | One pinned WorkOS SDK/jose interface contract against the same fake API. It intentionally keeps request/response shapes, token/seal fixtures, error classification, and SDK behavior proofs together. It was already large before this change; the new verified-email assertion extends the same code-exchange contract. A future semantic split is possible, but this PR adds no unrelated responsibility and a threshold-only split would obscure shared SDK upgrade evidence. |
| `test/support/doubles/workos/workos-fake.ts` | 642 | One stateful external-provider fixture implementing WorkOS HTTP contracts. Memberships, authorization resources, role assignments, users, invitations, code exchange, and refresh share identities and state; separating route methods mechanically would hide these invariants or expose mutable state across files. The fake was already present and cohesive. The new behavior extends its existing membership and authentication contract; it adds no second external system. |

## Completed validation and review boundary

All requested final local gates, both complete MFA profiles, and the final
shared Staging Optional read-back passed. The candidate contains reviewed
main `bb4afa8f`; `HEAD..origin/main` is 0 after the final fetch. Validation is
complete and the candidate is prepared for owner review. No merge approval
is recorded here. The real browser-first walk in the [slice guide](../../test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md#the-walk) passed.
The fresh Google account has passed the callback and selected-organization
portion with explicit User membership. Claude OAuth and the actual fetch have
also passed, with matching Axiom output and role-removal refusal. Google
re-login did not restore User. Renewal and a later fetch also passed, and
consent revocation returned HTTP 204 with an empty read-back. The post-expiry
retry refused refresh and ran no MCP tool. Final Axiom read-back showed no
fetch after revocation. Client cleanup completed and the slice ports are free,
and the corrected launcher run stopped with exit 0 and delivered the SIGINT
stopping record to Axiom. Never print keys, tokens, cookies, authorization
codes, or complete authentication URLs.

A setup read-back is not this live proof. Missing credentials, an incomplete
walk, a filtered gate run, or skipped tests cannot count as a pass. Record any
new gate result here only after its command completes. After all required
local checks and the live proof are recorded, Ready still requires every
Actions job started for the final head to pass. A later source fix returns
the PR to Draft and requires the affected checks again.
