# S2-01b implementation record

This ticket adds the current Admin's Logging settings page and atomic Save to
the storage contract from S2-01a. The pull request is stacked on #237.

## Scope

- Read and save one destination for the current organization.
- Encrypt the optional Bearer token with the server key and tenant binding.
- Preserve the revision and ciphertext when settings do not change.
- Reject stale forms and show uncertain writes without an automatic retry.
- Keep current password, Admin, origin, CSRF, and tenant checks.

This ticket sends no Collector request and adds no MFA requirement. Live
Supabase setup and rollout checks remain in S2-04.

## Verification

Implementation is in progress. Write and run the acceptance specification
before production changes. Use focused failing tests for each source behavior,
then run the complete candidate's required checks and record the results here.
