# PR255 unchanged-input hosted-live retry

Candidate `1a3e5a6638d71e03485e0280848ee5e025335382`, actual parent `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`, selection main `8c6d204e8588a664438ba8934ab36670b802525f`. Same source/input identity, Node24.20.0, renderer and designated staging launcher as attempt2. Exact command, cwd, start/end and log hash remain in commands.json. No source, helper, assertion, deadline or configuration changed. No automatic per-test retries. This is the one manager-authorized full retry, not a replacement of attempt2.

Full command exited1. Raw Node summary:30 tests,26 pass,4 fail,8 suites,0 cancelled/skip/todo. The top-level after-hook failure adds a synthetic test to the ordinary29-case inventory; preserve the raw summary rather than normalizing it. The report prints three test-body failures and two teardown failures. Public Connect did not start.

## Exact current failures

- Scoped removal proof now fails at AuthKit `/` email-step navigation (`page.waitForURL`,30000ms) in `authorizeWithConnect`, emitted hosted-removal.live.js107. It has completed the three portal visits, then stops during one of two grant preparations; the test does not record which identity. It never reaches the initial portal/access check that returned500 in attempt2. Therefore the original500 is neither reproduced nor resolved by this run, and no removal operation was reached.
- Invitation acceptance repeats the same `/invite failed after /invite` email-step navigation timeout30000ms, emitted administration-server.js212. The helper requires a changed href. Same-URL DOM transition is a possible unsupported path but current errors contain no visible-form observation to establish it.
- Signup second-workspace scenario reaches MCP client version negotiation and receives HTTP500 before the first real fetch for that token, emitted signup-server.js118. The public MCP response is the fixed server_error/Internal Server Error object. The subsequent revocation/repeat-activation assertions were not reached.
- Signup teardown reports one exact owned user DELETE failed with GenericServerException HTTP502. A single later exact GET returns200, so this user remains. Its ID is retained privately in the raw log and owned-users-readback.json; no new DELETE/list call was made.
- Outer legacy teardown fails `getOrganizationByExternalId` in personalOrganizations before the deletion loop. Error status502 and api.workos.com Cloudflare origin_bad_gateway metadata are preserved in the original log. This is direct evidence of provider/API502 during cleanup, not proof that all browser failures or the original500 share that cause. The loop may leave its legacy fixtures; there is no complete per-ID creation journal for that older helper, so no blanket cleanup claim is made.

The former sign-out failure now passes actual logout/session-count checks. The former expiry case now passes its real311-second refresh/ended-session/revoked-grant checks. Other password, role, directory, selection and MCP cases passed. These mixed outcomes support keeping each failure phase separate. No common cause or production defect is established. Production source equals the actual parent.

## Exact owned cleanup and ports

The scoped proof journal s25-02-mvp18jhg-41d08a.jsonl records cleanup-complete with no failures and404 for its seven created resources plus five memberships. Its original and copied hashes match. This does not cover the legacy suite-owned residual user or aborted outer cleanup above.

Post-failure lsof confirms no LISTEN on46443,46480,46481. No process was killed. Worker retains fixed-port reservation pending manager decision. Named branch remains stable and clean. No third unchanged retry or Public Connect is authorized by this report.

## Proposed input-changed diagnostic, pending manager review

Only test support would change. Label the three baseline portal visits; make the same single GET and record actor label, HTTP status, elapsed milliseconds and a fixed response classification if it fails, plus only allowlisted categories from new LocalHttpsSite.log lines. Keep the immediate expected200 assertion and every later assertion/deadline. Never copy raw bodies, headers, cookies, tokens or arbitrary error causes. For AuthKit failure, append only visible-email/password/Continue/Sign-in/alert booleans plus whether the click completed; no values, text or URL query. Do not change leavePage wait semantics or dispatch before observing the DOM. A diagnostic run would be explicitly an input-changed probe, not a passing check for the current committed candidate. Implement nothing until manager approval.
