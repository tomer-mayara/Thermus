# PR255 selected runtime failure and read-only diagnosis

Candidate `1a3e5a6638d71e03485e0280848ee5e025335382`; actual parent `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`; selection main `8c6d204e8588a664438ba8934ab36670b802525f`. Actual working directory and runtime/input hashes remain in candidate-pin.json, commands.json and post-failure-input-binding.json. Source is byte-identical to the actual parent. Source-free Ready selection remains prospective until parent integration and a fresh complete-candidate comparison.

Fresh integration passed 1149/1149. PG26/26 is reused only through the accepted exact precommit input bridge in postgres-reuse.json. Hosted-live failed: 29 tests, 25 pass, 4 fail, no skip/todo. Public Connect did not start. The full original log is retained unchanged.

## Four distinct failures

1. Scoped removal proof: initial authenticated `portal/access` baseline returned HTTP500, expected200 (`hosted-removal.live.ts:133`, emitted JS124). All three password visits and two Connect grants had completed; preceding password and session-MFA checks passed for the current loop element. The assertion does not identify which of the three visits failed and does not persist the response body or operator log. No unsafe-request, removal, restoration, final-admin or later account assertions were reached. This is an unexplained baseline request failure, not evidence that a removal operation failed.
2. Existing invitation acceptance: sanitized observation `/invite failed after /invite`, `page.waitForURL: Timeout 30000ms exceeded`. `enterEmail` fills the email, then awaits changed URL together with Continue-with-email click. It did not reach the password/callback completion for that invitee. Invitation token/query and credentials remain private.
3. Existing sign-out scenario: timed out waiting for `.product-access` excluding `Checking` during `signInThroughPortal`, before the sign-out action. It reached the root page and Welcome heading before the final readiness wait. It does not prove that logout failed.
4. Existing expiry/revocation scenario: sanitized observation `/ failed after /`, `page.waitForURL: Timeout 30000ms exceeded`, during `authorizeWithConnect` email step. It failed before its 300-second expiry and revocation assertions. It does not prove a token-expiry failure.

Two navigation failures occurred at AuthKit email steps. The other two involved portal access readiness. Other real staging scenarios passed in the same run, including password roles, Connect grant/MCP, external sign-in, onboarding, and later post-expiry refused selection. A provider/network transient is plausible, but neither a common cause nor a source defect is established by these observations. There is no production source change in this increment. The scoped500 has no saved response body/operator log, so it cannot honestly be attributed to AuthKit navigation. No screenshots, traces, HAR or video were produced by these helpers; none were invented after teardown.

## Cleanup and reservation

Original scoped journal ended `cleanup-failed`: generic teardown error and two unverified user IDs. It already confirmed404 for three organizations, one application, five memberships and the third user. Its bytes remain unchanged. After the whole group exited, one GET for each of the two exact remaining owned user IDs returned404 (`owned-users-readback.json`, no SDK retries). This separate receipt reconciles all12 scoped IDs without claiming original cleanup succeeded. The later legacy gate has prefix-based stale cleanup in its existing setup; it could explain removal of the two residuals, but no per-delete journal proves that causality. There were no new DELETE or list calls in diagnosis. The legacy gate ended without a reported teardown error; its helper does not provide a full per-ID journal, so no independent blanket absence claim is made.

Post-failure lsof confirms no LISTEN on46443/46480/46481. No process was killed. The fixed-port reservation stays with this worker pending manager decision; no retry or Public Connect starts without that decision. Named branch remains stable and clean.

## Proposed next step

With the two exact residual users absent and ports free, request one full hosted-live retry with unchanged source, tests, deadlines, runtime, renderer, launcher and selection. Preserve this first red run. If that retry passes, run the already selected sequential Public Connect pair. If it fails, stop again with the exact phase and cleanup evidence; do not weaken assertions or infer a cause from a test title. This is a proposal, not retry authorization or a green validation claim.
