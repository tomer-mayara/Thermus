# Recovery after a selected membership is removed

Status: implemented for review on 26 October 2026. This candidate is not deployed.
The production removal proof at `c9da79e63406e71dd15032d4ab9dfb85f2766918`
found a browser recovery defect after successful removal. The durable removal
receipt and current MCP access denial remained correct.

## Failure and result

An unexpired browser session can still name its removed workspace. Current
authorization denies access there and allows the identity-only workspace chooser.
After the browser access token expires, the pinned WorkOS SDK refreshes in that
same workspace. WorkOS returns OAuth 400 `organization_membership_not_found`.
SDK 11.0.0 throws that error, so the previous adapter returned 500 for `/session`
and `/organizations`. Repeating the same request could not recover the session.

The adapter now treats only that exact error as a local signed-out result and
clears the Thermus session cookie. `/session` returns its existing 401 signed-out
JSON, and `/organizations` returns its existing sign-in-required response. A new
sign-in obtains current identity, after which the user can explicitly select a
remaining eligible workspace. It does not select another workspace automatically.

The error must have name `OauthException`, numeric status 400 and OAuth `error`
value `organization_membership_not_found`. Other errors and refresh refusal
results keep their existing handling. Retryable outages and unrecognized thrown
errors retain the cookie; existing terminal refusals still clear it.
An explicit refused workspace switch still retains its session. No role, MFA,
CSRF, acceptance, removal receipt, no-replay or MCP authorization rule changes.
No remote session revocation, membership write or new account is part of recovery.

## Executable evidence

Before the source change, both public regression cases returned 500 instead of
401. Focused unit and pinned-SDK integration cases also failed with the exact
WorkOS exception. After the change, 43 focused cases passed, including those
regressions, existing switch refusal, transient outage and self-removal behavior.

The public cases perform a hosted application removal through the local WorkOS
fake, then exercise each expired-cookie entry point independently. They require
a cleared cookie, new sign-in, explicit
selection of only retained access, continued refusal of the old MCP workspace,
and an unchanged durable removal receipt with no repeated provider deletion.
Unit near misses keep error identity for other names, statuses, codes and fields.

The source candidate `c8b12419a812534d93343eb24248d70de7cf828e` passed the full
ordinary suite (5,127 backend and 49 portal tests), typecheck and portal build.
The native container gate passed all 11 tests. Its first attempt passed 9 and
failed 2 because the private-evidence umask made copied test preloads unreadable
inside the container. The runner now gives builds their normal readable fixture
permissions and keeps evidence files private. The complete unchanged gate then
passed; the failed attempt remains in the evidence.

The hosted Linux AMD64 image gate passed all 7 tests. Its fresh build ran the
hosted checks with outbound network access disabled: groups of 3,301, 29, 20,
1,156, 119 and 13 tests passed. These are separate emitted counts, not unique
scenario counts. No earlier candidate's image check is used for this source fix.

The manager authorized the existing guarded staging suite. All 29 tests passed,
including real token expiry, and both expected fixture-ownership guards were
active. All 48 created roots had successful owned cleanup. One subsequent GET
per exact journaled root returned 404 for all 48, with no list, mutation or SDK
retry. This run changed only its owned staging fixtures; it changed no production
fixture, setting, credential or deployment.

Fresh quality coverage passed 3,301 emitted unit and 29 portal unit tests.
Review and CRAP passed; changed/new function scores are 4, about 3 and 3. The
complete process exits 1 only for the existing browser-session file MI of 62.6.
The narrow catch stays at its lifecycle owner; no wider refactor or metric
exception is added. Both low test-volume findings have retained reasons.
Habit Hooks exits 0 with 29 comment advisories, each with a retained reason, and
an empty snooze file. All 49 public declaration snapshots and 15 registry Mermaid
views remain unchanged. The checker selects T1 Team review with no local blocker.

The [draft PR #261](https://github.com/tomer-mayara/Thermus/pull/261) retains
the red/green cases, complete command provenance, failures and retries, metrics
and independent review. The final documentation-only commit adds the untouched
generated base record under `docs/metrics/` and this status update. Its source,
test, package and image inputs stay identical to the tested source candidate;
quality provenance is refreshed with the compatible measured coverage.

## Architecture and release limits

WorkOS owns this error translation inside its existing browser-session adapter.
The helper stays inside that component. All public callable signatures,
component relationships and registry Mermaid views remain unchanged. Registry
prose records the terminal branch; no new architecture decision is required.
The increment requires at least T1 Team review for sensitive session behavior.
The committed-candidate checker decides the final tier and blockers. Required
current-candidate human approval, deployment and production recovery proof remain
separate. The earlier removal proof must not be described as complete recovery
coverage until the repaired expired-session path is verified after deployment.
