# WorkOS staging invitation gate

The full hosted staging run with the pinned renderer passed 28 of 29 tests.
The invitation lifecycle case could not find the Revoke form after its third
send. The test checked that send result too late, so that run does not establish
why the third invitation was absent. The send assertion now runs immediately
after the send, before reading its Revoke form. Its expected status and target
are unchanged.

A focused diagnostic rerun of the invitation group failed in shared fixture
setup, before any of the three cases ran. WorkOS returned HTTP 429 with:
`Sandbox environment email quota reached for invitation emails.`
Request ID: `8477b401-c63c-48ec-a234-d3b5d6ce6759`. Retry-After was absent.
This proves a provider quota blocks the rerun; it does not retrospectively
prove the cause of the earlier missing form.

Official sources checked on 2026-10-26:

- https://workos.com/docs/reference/rate-limits describes additional email
  delivery limits for the shared provider, separate from request limits.
- https://workos.com/docs/email describes provider configuration and delivery
  history. It gives no reset time for this sandbox quota.

The connected WorkOS operation index has no quota reset operation. No
configuration was changed, no paid service was enabled, and no support message
was sent. A custom email provider would change the staging delivery setup and
is outside this UI ticket. The required live gate remains blocked until the
existing sandbox can send test invitations and the selected group passes.

Retained evidence: hosted-live.log, hosted-live-missing-renderer.log,
hosted-live-missing-third-invite.log, staging fixture ledgers, and
../implementation/staging-invitations-diagnostic.log. The diagnostic run has
its own input hashes and build log. Original failures are not overwritten.
