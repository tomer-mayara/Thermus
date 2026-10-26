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

The source change selects the full ordinary suite, typecheck, portal build,
native container and hosted Linux AMD64 image gates under the test gate policy.
The hosted build checks run inside that image. Complete quality metrics,
Habit Hooks, declaration verification and independent review are recorded in
the draft pull request. A live staging gate needs the manager's separate fixture
authorization; this work makes no production or staging changes.

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
