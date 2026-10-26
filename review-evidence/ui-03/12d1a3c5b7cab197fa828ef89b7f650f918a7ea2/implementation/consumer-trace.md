# UI-03 invitation-label consumer trace

All exact `Invite` submit-label consumers in source/test were searched and migrated to `Send invitation`. Existing send, role, outcome and audit assertions remain.

- Direct ordinary cases: every `.test.ts` in `label-consumers.txt`, plus both changed hosted-admin page/removal cases. The existing invitation route guard/outcome cases ran too.
- Shared `hosted-audit-snapshot-site.ts` -> integration `hosted-audit-snapshot-lifecycle.test.ts`, acceptance `hosted-snapshot-composition.test.ts`, and direct/indirect `hosted-customer-export.test.ts` through `hosted-audit-export-site.ts`. All ran in the focused ordinary command.
- Shared `hosted-audit-journey-site.ts` -> `hosted-audit-journey-probe.ts` -> container `audit-sender-site.ts` -> dedicated Collector gate. Root runs this gate.
- Direct `hosted-storage-failure.runtime.ts` -> dedicated SQL/logging gate. Root runs this gate.
- `hosted-live/administration-server.ts` -> hosted-live entry -> staging gate. Root runs this gate.
- Shared `admin-shell-browser.ts` and `member-removal-browser.ts` -> only `hosted-member-removal-browser.runtime.ts`. The complete Members browser group ran.

The browser driver now uses a local HTTPS front so Chromium follows real 303 responses. It needs OpenSSL, through the existing `selfSignedCertificate` support function. It preserves response status, Location, headers and separate Set-Cookie values. It forwards browser headers and body to the existing transport, which reaches the real HTTP server. Teardown fails with captured causes if the HTTPS front fails.

Collector follow-up: `audit-sender-site.ts` is now also changed. Its only case consumers are `integration/logging/audit/audit-sender.runtime.ts` and `acceptance/logging/audit/hosted-audit-journey.runtime.ts`. The full `npm run test:logging:collector` command covers all ten cases and passed after the saved-destination workspace-mount fix. The previous 8/10 failure and the 10/10 retry are retained in implementation evidence.

Staging diagnostic follow-up: the existing redirect assertion for the third send in `hosted-live/administration-server.ts` now runs before the next form lookup. Its consumer remains `hosted.live.ts`; no ordinary tests or production behavior changed. The full invitation describe group was selected through the existing staging launcher, but all three cases failed in shared fixture setup with WorkOS sandbox invitation-email quota HTTP 429. The full gate still needs a green rerun after quota recovery.
