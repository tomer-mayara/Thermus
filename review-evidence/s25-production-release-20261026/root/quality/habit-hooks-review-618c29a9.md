# Habit Hooks review — 618c29a9

Candidate `618c29a94a80c94a9e0396ed07a8b727c10febde`; actual base `9f07c04bba0813358274212b21316165dc3e308b`. Read-only review of every reported location against current source and the base diff. The hook completed with **exit 1 and 47 findings**: four complexity, 21 non-null assertions, one parameter count, 18 comments and three file sizes. All are retained for the reasons below. No required source fix was found. This is a disposition of the findings, not a zero-finding hook pass or human approval. `.habit-hooks/snooze.json` remains `[]`.

[Machine-readable review](habit-hooks-review-618c29a9.json) has one record for each of all 47 locations, its exact reason and corresponding base line where present. [Raw hook log](../validation/habit-hooks.log) retains the enforced findings.

## Complexity: all four locations

| Location | Retained reason |
| --- | --- |
| `src/app/hosted-workos-application.ts:97` | `composeWorkOSApplication` owns optional snapshots, explicit override precedence, shared audit/tool wiring and resource closure in one composition lifetime. Its entire body is byte-identical to base. The change supplies a new immutable document input in the other startup function. Splitting this lifetime only for the score would obscure its owner. |
| `src/interfaces/web/account/logging-page.ts:74` | `destinationForm` owns one atomic settings form. Saved destination/dataset/revision, token-presence and legacy-auth guidance, enabled state and feedback drive the visible input/label conditions. Its entire body is byte-identical to base; new help sits outside it. A score-only split would separate related accessible controls and saved-state rules. |
| `test/acceptance/auth/hosted-member-removal.test.ts:27` | The independent invalid-request variants each change one authority, tenant, target, revision, method, Origin or CSRF condition and check the same no-DELETE/no-applied result on a fresh site. The flagged scenario body is unchanged. Keeping the mutations visible shows which security boundary each case proves. The separate uncertain-result case retains durable-hold and no-replay assertions. |
| `test/acceptance/auth/hosted-workos-signup.test.ts:457` | One real-production signup journey binds the public Privacy reader, eligible creator Terms/Privacy, unchecked agreement, stale-form rejection, first Admin and exact saved legal identifiers. This increment updates canonical expectations and adds the second historical stale-bundle case. Keeping presentation and persisted acceptance together makes their correspondence reviewable; helpers should not hide those assertions. |

## Non-null assertions: all 21 locations

All 21 expressions are unchanged from base; the machine report maps each current line to its actual base line. They are confined to existing tests. Retention is based on their concrete failure behavior and fixture ownership, not only their age.

| Locations | Retained reason |
| --- | --- |
| `test/unit/html/logging-page.test.ts:30,31,32,33,35,36` | These selectors immediately query the scenario's fixed rendered dataset/group/endpoint/token/radio nodes. Each node is immediately used for a property or method, so a missing control throws and fails the test rather than silently passing. No nullable production state or circular lifetime is concealed. The new help scenario uses explicit `assert.ok`. |
| `test/unit/html/logging-page.test.ts:54,57` | CSP is supplied by the deterministic layout owner. Missing headers fail through the immediate `includes` access or Node assertion input validation. Retaining these fixture-local reads does not bypass a production fallback or change the tested CSP guarantee. |
| `test/unit/html/logging-routes.test.ts:20,26,36,45,60,66,71,77,85,94,96,100,116` | Every lookup uses a literal supported route on a fresh `LoggingRoutes` fixture and then calls the handler. A missing handler fails the test. These direct calls keep the route, trust, Save, failure and abort outcomes visible; an extra route-owner wrapper or a guard at every fixed lookup would add no behavior evidence. No new production non-null assertion was added. |

## Parameter count: one location

`test/support/drivers/browser/member-removal-browser.ts:5` now takes four distinct fixture roles: test cleanup owner, isolated HTTP transport, authenticated cookie text and one optional Playwright JavaScript capability. The fourth selects the no-JavaScript native-help proof; its default preserves the existing removal browser. Both callers and cleanup/routing were inspected. These values do not form a repeated business entity or travel as a group through several APIs. A new transport/auth/lifetime bag would hide separate seams rather than remove coupling. This is a test-driver API, with no changed production contract.

## Comments: all 18 locations

| Locations | Retained reason |
| --- | --- |
| `src/app/hosted-workos-application.ts:28,29` | Identify the one-environment SDK/settings/key-set connection and the allowed transport seam. This prevents treating test transport substitution as production identity configuration. |
| `src/app/hosted-workos-application.ts:36,37` | Distinguish shared production tool operations from a development request-scoped server override. The types alone do not establish that lifetime; confusing them can share request state. |
| `src/app/hosted-workos-application.ts:41` | State explicit audit/tool override precedence, which optional fields alone do not explain. |
| `src/app/hosted-workos-application.ts:44` | Bound the dispatch substitution to the development seam; it is not a production delivery guarantee. |
| `src/app/hosted-workos-application.ts:48` | Keep the authority rule that production omits Google onboarding and a slice must select its enrollment organization explicitly. |
| `src/app/hosted-workos-application.ts:50` | Updated provenance names the actual approved production bundle and separates it from explicitly supplied development documents. This is a legal version/authority boundary, not new acceptance logic. |
| `src/app/hosted-workos-application.ts:54` | Explain the request-lifetime reason for zero SDK retries and the short WorkOS timeout. |
| `src/app/hosted-workos-application.ts:78,79` | Preserve fail-closed startup and lazy key-fetch timing: invalid settings confer no local/anonymous fallback, and connection construction does not fetch remote keys. |
| `src/app/hosted-workos-application.ts:140,141` | Explain why current access resolution and organization/member/invitation routes share one directory owner instead of independent grant mirrors. |
| `test/acceptance/auth/hosted-image.test.ts:21` | State the dedicated gate's Docker/Linux AMD64 prerequisite and placeholder identity scope, so its result is not mistaken for live-provider proof. |
| `test/acceptance/auth/hosted-workos-signup.test.ts:541` | Explain why the fake starts before composition: rejected document bytes must still leave an observer that proves no provider request occurred. |
| `src/accounts/providers/workos/workos-organization-removal-documents.ts:3` | Preserve approval/history provenance for an intentionally separate immutable successor; future edits must not replace earlier frozen bytes. |
| `src/interfaces/web/account/administration-help-documents.ts:1` | State the exact-byte versus presentation boundary. HTML heading levels can change while approved Markdown bytes/version/hash remain fixed. |
| `src/interfaces/web/account/administration-pages.ts:25` | Preserve the complete-read invariant before current Members/invitations/counts render. New static help does not permit partial current-access information. |

## File size: all three locations

| File | Retained reason |
| --- | --- |
| `src/accounts/providers/workos/workos-organization-removal-documents.ts` — 351 lines | One complete approved immutable Terms/Privacy/agreement bundle, with no local functions or branching owner. Startup validation and byte contracts bind one approval unit. Splitting literals or loading them from disk adds drift/packaging seams; trimming text changes approved bytes. |
| `test/acceptance/auth/hosted-workos-signup.test.ts` — 549 lines | Independent scenarios for one signup HTTP surface keep default closure, creator eligibility/authority, full documents, recovery and fail-before-provider guarantees together. Existing site/driver layers already own transport. The current canonical changes belong to that same acceptance contract; a mechanical split supplies no clearer responsibility. |
| `test/acceptance/logging/hosted-destination-settings.test.ts` — 241 lines | One Admin settings HTTP contract groups protected form/help, atomic Save, tenant/revision checks, write-only credentials, forged-input refusal and uncertain saves. Each test owns a fresh site. Complete help is visibly tied to unchanged controls and no-write-on-read; a size-only split would disperse the review surface. |

## Final notice/help risk review

Independently decoded the TypeScript template-literal escapes and compared all five evaluated source documents with canonical bytes and fixed hashes. All match. Manifest SHA remains `7528832b4e2baf055d4be35ec2d12fe3d00a9681d0a7684dc5f246e830c4071e`; all 15 registry Mermaid blocks match base. The selector switch uses the existing purpose/hash validator, and the agreement remains the approved earlier version. No acceptance-store, authority, removal, sender or recovery semantics changed.

The two new render calls consume only frozen approved help, with no request-data parser API. Installed micromark code keeps raw HTML and unsafe protocols disabled unless explicit dangerous options are set; neither call sets them. Data attributes use fixed version/hash literals. Native help remains outside forms; it adds no input, script or write and stays available with scripts disabled or settings unavailable. Heading changes preserve text, and the existing layout computes the updated CSS CSP hash. Static help does not report an operation result: the repaired uncertain-removal test excludes only that identified help region, retains target absence across the response, requires the current Members heading, and keeps all durable/no-replay checks.

No required fix or behavior risk was found from the hook findings. The manager retains the final ordinary/type/build/container results and is running staging live separately. This review ran no tests/builds and changed no source, packet, snooze entry or commit. It does not replace complete-candidate metrics, tier/eligibility checks or required human approval.
