# Independent Quick start review

Reviewed the source and test working-tree changes on `codex/admin-quick-start`, against base `feeaad4d5f04212f033366c232180be4bd40da4c`. The observed committed HEAD was `d256c620c7dc8c6d928b9426d1819c293fcfa52c`; implementation changes were still uncommitted and workers were active. This report covers the files read during this review, including the added Audit log details disclosure. It is not final committed-candidate approval.

## Result

No confirmed production defect found. Two browser-evidence gaps should be corrected or reported with the stated limits. Neither is evidence that the product behavior fails.

1. **Keyboard coverage is claimed but absent.** `docs/testing/test-list.md:27-28` says the Quick start browser test checks keyboard use. `test/support/drivers/browser/quick-start-browser.ts:37`, `:41`, `:48`, `:59`, and `:66` activate controls through pointer clicks. The driver contains no keyboard actions or focus assertions. Add keyboard navigation and Enter/Space activation for provider/audit/manual disclosures and Copy, and assert that the denied-clipboard fallback receives focus. If this is deferred, remove the claim and record manual keyboard evidence. Native HTML controls and shared focus CSS look correct by inspection; the current test does not prove their keyboard behavior.
2. **Narrow expanded content is not checked.** `test/support/drivers/browser/quick-start-browser.ts:28-36` checks 320px, 390px, and 1024px with disclosures closed. Provider and audit details open after that loop, at 1024px (`:37-43`), and the manual guide opens later (`:49-50`, `:65-69`). Add overflow checks with these details open at 320px and 390px, including the textarea. This matters because these are the new long content and copy-fallback paths. The stylesheet appears to constrain these elements correctly, but closed-card measurements do not verify them.

## Security and behavior checked

- `HostedAccountRoutes` authenticates the session, resolves current access, and requires a trusted tenant before it dispatches Quick start. `currentAdminAccess` binds the resolved authority, subject, and selected organization to the signed-in user, requires product permission and an Admin grant, and rejects a missing selected organization.
- The name lookup uses the authorized organization ID. Query hints cannot select an organization or supply its name. A mismatched lookup result, absent result, blank name, or provider failure yields no guide. Cancellation follows the existing request cancellation behavior. GET/HEAD are accepted; mutation methods are refused before the name read.
- `WorkOSSignupRoutes` changes only the destination after successful activation and successful organization selection. Existing-access inspection and activation outcomes continue to the organization selector, with the portal-root return destination. The normal WorkOS session-login routes are unchanged. Refreshed and selected cookie ordering stays intact.
- `composeHostedApplication` passes the configured MCP resource URL. The guide uses this URL independently of the normalized portal base URL. Page links, server navigation links, and the signup destination preserve portal base paths. There are only two `HostedAccountRoutes` construction sites, and both supply the new option.
- Navigation places Quick start before Connect for Admins in Connect, the selector, Members, and Audit Log. User navigation stays unchanged. Connect remains the active item on Connect; Quick start is active on its page. Updated shared browser-driver expectations account for the added item rather than retaining the old index assumption.
- Organization HTML is escaped in the workspace header and textarea. Markdown substitution normalizes line breaks and escapes syntax and entities. No organization text enters the copy script. Internal Markdown links encode parentheses. Trusted configured destinations reject non-HTTP(S) schemes, credentials, queries, and fragments.
- Provider link data and setup instructions have one production owner. The complete copied guide includes collapsed content and uses the approved template's substantive wording. The copy operation sends only that guide to the clipboard; it includes no member list, credentials, cookies, audit event, or invitation links.
- The page starts with Copy hidden and exposes it only when script execution starts. It reports success only after `writeText` resolves. Rejection or absence of the clipboard API opens, focuses, and selects the manual textarea without a success claim. JavaScript-off readers retain the native manual disclosure.
- The layout hashes the exact added style and copy script. The inherited CSP keeps default sources closed, frame protection, no-store, and same-origin forms/assets. No unsafe-inline or unsafe-eval allowance was added. Style and script inputs here are source constants, not request data.
- The refreshed audit disclosure uses the canonical switch effects, save-before-test recovery, and delivery/redaction limits. The visible initial sequence still states Test's save side effect. Planned identity-provider enrollment has explanatory text and no setup action. No provider setting, enrollment implementation, audit mutation, or deployment was added.

## Test design and policy limits

The new acceptance tests reach composed application behavior over the HTTP driver, with external-provider doubles. Integration tests focus the account route, current access, selected organization, config, and failures. HTML/copy tests remain in the web-interface package and exercise production modules; micromark/linkedom/VM are test infrastructure. The browser runtime exercises the actual page in Chromium with JavaScript on and off. These test subjects are production behavior, not tooling or documentation. The runtime filename keeps the browser gate outside the ordinary globs, and the inventory gives its explicit command.

Useful existing coverage includes new-organization activation and cookies, existing-access continuation, selector changes, lost access, arbitrary names, separate configured MCP and portal hosts, base paths, precise CSP hashes, safe errors, method handling, and cancellation. The updated hosted admin journey follows the new redirect and requires a 200 page. Its body regex uses an OR, but the separate Quick start acceptance case checks the heading and organization name directly, so this does not leave the overall requirement untested.

No source or test files were edited by this reviewer. No builds, suites, live gates, head snapshots, or coverage collections ran during this review. Passing test results, final metrics, architecture declaration, human approval, and merge eligibility must come from the manager's checks of the final committed candidate. Provider links were reviewed for data flow and safety here; this reviewer did not independently revalidate external vendor pages. Native clipboard permission is not established by a stubbed write.

## File identities at report save

Read-only review completed 2026-10-28T16:40:14.140Z. These hashes identify the reviewed working-tree files; later edits need a refreshed review.

- `src/interfaces/web/account/account-routes.ts`: `5666a939c0363ce964134bd4d7bf11b0da3a00855a89ba37a09a9be24fd9cdf3`
- `src/interfaces/web/account/quick-start-content.ts`: `1c824acef43f2d02a1d92bffb27bd1b87f52e4e03f0d69ee60ddba7ea5c5b171`
- `src/interfaces/web/account/quick-start-page.ts`: `22399669dc297d000b52068fa84e22acb8747fb5351e490ff36971e4e862627f`
- `src/interfaces/web/account/quick-start-copy.ts`: `eb61b5872d21d94a21898c58dd3db2e8c3add46a414ac6c552104903ce10c133`
- `src/interfaces/web/account/quick-start-style.ts`: `3eb9a858b27591509567b31a562941bff78211ebf4bf48b84d0de552ea8565f4`
- `src/interfaces/web/account/members-page-layout.ts`: `d2e5c547cca4dd1468fbb324bc0674c4ace64201cabe23359bbab96099ba03f0`
- `src/interfaces/web/auth/workos/workos-signup-routes.ts`: `0ccdf00ed932bc544bf8c1df1260a87127a860c77afcb0f193680aba1e5ccb82`
- `test/support/drivers/browser/quick-start-browser.ts`: `5f43dfd7db8af5166f3f4fc485e2a0a6d1315536d49ec4b4121502f9b46b8cec`
- `test/acceptance/auth/hosted-quick-start-browser.runtime.ts`: `9c010ba54cba1467078a87ce4129bad5fdbd159679bcef32795a49c9951d794d`

## Updated prerequisite evidence

The manager subsequently verified Linux AMD64 runtime execution: `docker run --rm --platform linux/amd64 alpine:3.22 uname -m` returned `x86_64`, exit 0. The earlier prerequisite-worker inference of an AMD64 blocker from the Buildx platform listing is withdrawn. The final hosted AMD64 image gate remains pending its actual run; this isolated smoke does not establish the final image, build, renderer, or HTTPS behavior. The manager also safely confirmed the WorkOS launcher's staging test credential, client, and issuer settings. No credential values are recorded. See `ast-report/validation-prerequisites.md` for current prerequisite status.
