# Slice 2 prepared runtime notice

Status: unapproved development candidate, 24 October 2026. This record does not
approve the legal package or authorize publication, deployment, or signup opening.

The hosted composition now selects
[`organizationAuditDocuments`](../../src/accounts/providers/workos/workos-organization-audit-documents.ts)
from the [version 3 review package](../legal/organization-audit-2026-10-24-proposal-v3/README.md).
The frozen module contains the exact UTF-8 Terms, Privacy, and agreement bytes.
It uses the package's bundle, document, and agreement versions and review hashes.
The approved organization and earlier personal source modules stay unchanged.
The new module has a neutral name because owner approval is still pending.

Signup stays off by default. When an explicit development setting enables it,
the signed-out page shows the new Privacy Notice. An eligible creator sees the
full new Terms and Privacy, one unchecked agreement, and the new bundle version.
A form with the previous bundle version is refused without organization or
membership creation. Accepted creation stores the new Terms and Privacy versions
and hashes with the unchanged agreement version and hash. Existing sign-in and
Continue flows do not record a new agreement.

## Local evidence

The acceptance specification failed first: startup served the old 23 October
Terms where the test required the prepared 24 October Audit Terms. The focused
module contract then failed because the new runtime module did not exist.
After implementation, a clean backend build and these four complete test files
passed: 37 tests, 0 failures, 0 skips, and 0 todos.

```sh
pnpm run build
pnpm exec node --test dist/test/unit/auth-workos/workos-organization-audit-documents.test.js dist/test/unit/auth-workos/workos-signup-documents.test.js dist/test/unit/auth-workos/workos-approved-organization-documents.test.js dist/test/acceptance/auth/hosted-workos-signup.test.js
```

The new module contract verifies exact bytes, review hashes, versions, purpose,
and freezing. The production-composition acceptance test verifies the rendered
Privacy before sign-in, both rendered documents after sign-in, the unchecked
agreement, old-version refusal, saved legal identifiers, and first-Admin access.
The unchanged approved-module contract verifies its historical bytes separately.
These tests exercise source behavior; they do not approve the document text.

The hosted image test now expects the new bundle. That gate is deferred to the
manager: its Docker build starts the wider hosted checks. No image-gate pass is
claimed here. No external service was changed by this work.

## Impact and remaining work

The affected registry view is **Selected C4 components: hosted authentication in
the Node server**. The existing app-to-WorkOS composition, web signup route,
organization-creation contract, WorkOS writes, and replay barriers stay in place.
The change selects new legal content inside the same owners. There is no new
component, dependency between components, public module, callable contract,
container, datastore, or deployment boundary. The registry drawing remains
accurate; no diagram or L4 detail is needed for this part. The new module is used
only by app composition and its contract test. No declaration snapshot changes
are required for this part.

The manager must classify the complete committed candidate and run its required
checks, habit-hooks, and production metrics. Source changes select the full
ordinary suite, typecheck, portal build, self-hosted container, hosted offline
build and Linux AMD64 image gates. The hosted live gate applies when staging
settings are available. Other Slice 2 source changes select their own gates.
This worker result does not establish merge eligibility or human approval.

Before release, obtain exact-byte owner approval for the final complete package
and its publication/runtime scope. Confirm the effective date if release is
later than 24 October 2026. Complete the separate existing-organization notice
or agreement decision, public policy publication and readback, provider and
selected-destination review, and remaining Slice 1/Slice 2 release evidence.
The help copy is coordinated separately with the Audit destination UI; changes
to that copy do not change this module's Terms, Privacy, or agreement bytes.
