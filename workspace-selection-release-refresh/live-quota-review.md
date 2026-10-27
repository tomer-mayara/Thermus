# Hosted live quota failure review

Candidate: `44753a72a7c1cecbf076e1448c26a4ae4b93a9f2`.
Actual base: `a421afc056ce3e400f2779c75683ea45270b96cb`.
Input: `ast-report/workspace-selection-release-refresh/hosted-live.log`.

The live gate failed because WorkOS refused invitation-email fixture setup with
its sandbox quota. The direct evidence covers six AUTH-08W failures. The separate
removal case's invitation POST returned 503; the same quota is a supported
inference for that failure, not a separately observed provider error.

The runner finished at 2026-10-27 22:52:30.445 UTC with exit 1: 29 tests, 8 suites,
22 passes, 7 failures, 0 cancelled, 0 skipped, 0 todo; duration 614699.394 ms.
AUTH-07W operator, selection and expired-selection cases passed. All AUTH-06 cases
and both organization-creation/native MCP handoff cases passed. These results
do not make the complete gate a pass.

## Direct six-case evidence

At log lines 124–142, the first AUTH-08W provider proof fails with:

`RateLimitExceededException: Sandbox environment email quota reached for invitation emails.`

The recorded fields are HTTP status 429, rawData {}, request ID
`ad077443-8aa6-41ce-a23b-e73848ec010d`, code undefined, retryAfter null.
All six AUTH-08W failures repeat that same exception, request ID and stack.
No quota size, reset time or Retry-After can be inferred from this evidence.

The stack reaches WorkOS SDK sendInvitation, then invitedMembership in
test/support/hosted-live/administration-fixtures.ts:37, Promise.allSettled index 5,
and createAdministrationFixtures at lines 77–85. The operation creates the pending
membership fixture in D before either directory proof executes its subject.
The later pending-membership read at lines 38–40 was not the reported failure.
This is not evidence of eventual-consistency failure or a picker role defect.

LiveRun caches the administrationFixtures promise at live-run.ts:15–17,58.
The first provider proof awaits it at administration-proofs.ts:149. Its rejection
therefore fails the second provider proof, the retired-grant case, and all three
invitation server cases through the same rejected setup. The first failure takes
2108.38 ms; the dependent failures take 0.13–1.44 ms. Those cases did not establish
their intended live behavior in this run.

## Separate removal failure and cleanup

Log lines 107–122 report only an assertion: 503 did not equal expected 303 at
emitted hosted-removal.live.js:215. This maps to source
test/acceptance/auth/hosted-removal.live.ts:225–226, the fresh Admin invitation
send after removal. It does not expose that request's underlying WorkOS error.

The quota is the likely cause because a provider send error propagates from
workos-organizations.ts:209–216, a started directory change is wrapped as
UnconfirmedChangeError by change-records.ts:63–75, and administration-routes.ts:
191–197 returns the existing unconfirmed invitation page, whose status is 503
in account-pages.ts:74–82. That explains the observed safe response. It does not
prove which exception caused this particular 503. Preserve this distinction.

The scoped removal journal is
`.cache/s25-02/live/s25-02-mvr9tf6e-955a5c.jsonl`. It records successful unsafe-form
refusals, User removal, acting-Admin removal, last-Admin protection, usable other
workspace selection, and both accounts' other-workspace access before the rejoin
invitation stage. It records no fresh-invitation-rejoin-confirmed or proof-complete.
Do not call the whole removal journey passed.

The same journal records cleanup-complete at 22:44:22.854 UTC. Exact-ID verification
records HTTP 404 for all three owned organizations, three users, one application
and five original memberships. No cleanup-failed event appears. Cleanup is owned
by removal-fixtures.ts:103–138; it deletes only recorded resources and verifies
their exact IDs. The main live run's after hook at hosted.live.ts:77 uses
LiveRun.end and FixtureRegistry.deleteAll. No main-run cleanup hook error appears
in the final report; this review did not independently query remote inventory.

## Safe next step and scope

Keep this failed run and its exact final-candidate pin in Validation. The complete
gate remains unsatisfied. PR status remains Draft and blocked by the environment
gate plus human approval of current head 44753a72, as the manager reports.

Do not retry immediately, loop invitation writes, change product code, lower an
assertion, increase a timeout, suppress these cases, bypass email, or change the
provider's production settings. The error is a sandbox invitation-email quota,
not a proved transient request-rate window. It supplies no safe wait duration.

A retry is appropriate only after an independent confirmation that the staging
invitation-email quota is available again, and after the prior runner and cleanup
are finished. Run one complete `npm run test:hosted-live` on the clean exact
candidate with the existing staging settings and normal fixtures. Preserve both
the failure and the retry result. FixtureRegistry states that only one live run
may use this staging environment at a time; overlapping runs can delete fixtures.
If quota recovery requires an owner/provider action, obtain that action through
the existing owner process. This review performs none and assumes no reset time.

No source fix is indicated by the direct six-case evidence. Better reporting of
cached fixture setup failure could be separate test-support work; it is not
required to diagnose this run and would not restore email quota. Any such change
would need its own applicable checks and evidence.

Production feaddbde is separate: the manager reports it is live and both real
roles are verified. This failed refreshed staging gate does not undo that exact
approved production evidence, and that production proof does not pass the new
44753a72 gate or approve its PR. Prior reports and approvals remain preserved.

This reviewer read logs, source and the WorkOS skill/API reference only. No gate,
build, MCP, WorkOS operation, account change, production action or new agent was
started. Only the requested ignored diagnosis files were written.
