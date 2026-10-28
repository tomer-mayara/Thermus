# Admin Quick start habit-hooks review

Date: 28 October 2026. Worker review of `ast-report/habit-hooks-complete.log`, with
the earlier `ast-report/habit-hooks.log` retained as history, against the current
working tree and its source diff. No source, test, scanner
configuration, or snooze entry was changed by this review. No scanner, test,
or metrics command was run. The manager must bind the final scan and retained
reasons to the completed candidate SHA.

## Result and evidence limit

The manager's complete-candidate scan completed with exit 1 and 83 retained findings:
8 high-complexity, 2 non-null-assertion, 6 too-many-parameters,
59 non-essential-comment, and 8 oversized-file findings. There are no snoozes.
The prior final scan had 81 findings. The live signup helper's addition to the
complete selection exposed two existing fixed-port lifetime comments; their
specific retained reasons are included below.
The earlier scan reported 90 findings, including nine new non-null assertions
that the page worker removed. Source inspection confirms explicit assertions
now guard the copy field, script, button, label, link destination, CSP, button
bounds, and disclosure ownership in the new Quick start tests and driver.
The final scan confirms those nine findings are resolved; the original counts
remain here as failure/fix history.

The remaining two non-null assertions are in an existing Members integration
test, described below. The other listed findings have specific retained
reasons below. None is accepted merely because it existed before this change.
The current `.habit-hooks/snooze.json` is `[]`; no finding was hidden. This
review does not waive the separate MI, CRAP, architecture, or test gates.

## High-complexity findings: 8 retained reasons

| Finding in the supplied log | Review and retained reason |
| --- | --- |
| `src/interfaces/web/account/members-page-layout.ts:21` | The changed shell has one responsibility: emit the common protected administration page and its matching CSP. Its branches select optional trusted Quick start/Audit links, the current-page marker and class, the workspace-name block, and optional source-owned style/script bytes. Dynamic titles, names, and navigation values pass through HTML escaping. The extra style and script are static source constants supplied by internal page renderers. Each response gets a fresh `Headers`; exact hashes cover the bytes emitted and do not mutate the shared base policy. Retain these visible presentation branches rather than move authorization or CSP ownership into several page-specific copies. No unsafe-inline/eval policy is added. |
| `src/interfaces/web/account/administration-routes.ts:182` | `changeOnPost` keeps the write admission and result sequence together: POST, same origin before body work, bounded/form-token parsing, selected-organization match, one service change, one recorded outcome, then fixed success/refusal/unknown recovery. The stale and unconfirmed paths must remain distinct so a navigation change cannot repeat a write. This candidate only adds the Quick start destination to rendered Members navigation; it does not change these branches. Retain this coherent security and outcome boundary. |
| `src/interfaces/web/account/logging-routes.ts:34` | The route closure admits only current Admin permission and the exact known read/save/test paths, records refused writes, and contains credential-bearing collaborator failures in a fixed unavailable page. Cancellation is rethrown. The candidate only adds a configured navigation path. Retain the guards at this one route boundary; combining them with page-only links would weaken the authority distinction. |
| `src/interfaces/web/account/logging-routes.ts:51` | `change` owns the Save-before-Test sequence. Method, origin, parsed token, selected tenant, service availability, Save outcome, and Test outcome choose materially different safe responses. An unsuccessful or unconfirmed Save sends no Test; a Test failure cannot undo the saved settings. The candidate changes none of that sequence. Retain the explicit branches so the guide's explanation still corresponds to the real operation. |
| `test/acceptance/auth/hosted-admin-journey.test.ts:13` | One independent creator/recipient journey deliberately spans creation, checked landing, invitation, provider-fake acceptance, browser selection, MCP authorization, and creator-only legal records. Role cases start a fresh site. The new assertions follow the creation redirect and read the protected guide before the existing cross-channel checks. Retain the scenario as an acceptance proof of one end-to-end requirement; splitting it into dependent tests would obscure which actor and organization retain authority. |
| `test/acceptance/auth/hosted-workos-signup.test.ts:458` | This production-bundle scenario compares the exact documents, legal hashes/versions, stale-bundle refusal, one creator acceptance, and first Admin access on one fresh composed site. Its short loops enumerate document parts or refused historical versions, not alternate production algorithms. Retain the complete legal provenance scenario. The candidate changes creation landing assertions elsewhere in this file and adds no legal or provider write rule here. |
| `test/acceptance/user-portal/portal.test.ts:183` | The setup-method scenario reads one server-supplied custom MCP endpoint, changes native selectors, and returns to CLI while asserting no additional requests. DOM predicates assert the required controls exist before use. Retain the sequential interaction because restoring the earlier selection is the behavior under test; splitting it would lose the interaction state. The candidate changes only the separate Admin navigation expectation. |
| `test/acceptance/user-portal/portal.test.ts:217` | Fresh User/Admin examples deliberately give a misleading profile role and a current product-access role, then verify the current server answer controls menu visibility, one navigation region, Connect's current marker, legal links, sign-out, and absence of privileged forms. The added first Quick start item is part of that same observable role contract. Retain the small role-dependent expected menu; it checks authority-dependent presentation rather than introduces production branching. |

## Non-null assertions: 9 resolved and 2 retained

The old log's nine new assertions in
`test/support/drivers/browser/quick-start-browser.ts`,
`test/unit/html/quick-start-copy.test.ts`, and
`test/unit/html/quick-start-page.test.ts` have been replaced by explicit,
descriptive `assert.ok` checks. Source inspection and the final scan confirm
their removal.

The retained sites are in
`test/integration/hosted-admin/account-routes-administration-pages.test.ts`:

- Line 53 dereferences the locally rendered `.member-lists` container to check
  the order of the active-members card, pending-invitations disclosure, and
  removal help. The page is produced from a complete local overview, and the
  immediately surrounding assertions check the expected disclosure and list
  contents. If the container disappears, the direct `.children` access throws
  synchronously and fails this test; it cannot silently skip the assertions or
  authorize production behavior. Retain it for this navigation-only edit,
  which changes only the separate header-menu expectation at line 129. An
  explicit container assertion would improve the failure message; that
  diagnostic limitation remains acknowledged.
- Line 67 indexes the two local invitation entries while iterating the two
  rendered invitation rows. The fixture slice/map creates those entries, and
  `assert.equal(rows.length, 2)` runs before indexing. A missing fixture entry
  fails on the next property access rather than making the test pass. Retain
  the local fixture-index assertion for the same navigation-only edit. It is
  not a nullable production dependency, shared mutable lifecycle, or recovery
  path. An explicit entry guard would improve diagnostics if this fixture is
  later changed.

The manager's final scan confirms that only these two non-null findings remain.
These are retained test-diagnostic limitations, not a claim that non-null
assertions are preferred or that a performance exception applies. They are
unchanged in the diff, but their actual fixture and failure behavior was read
before retaining them.

## Too-many-parameters findings: 6 retained reasons

| Finding | Review and retained reason |
| --- | --- |
| `src/app/application.ts:168` | `composeHostedApplication` receives four distinct owned roles: trusted route configuration, provider parts, account services/diagnostics, and optional shared storage with its close operation. Its purpose is their composition and lifetime. The candidate adds the existing configured MCP URL to the constructed web routes; it does not add a fifth role. Combining these values into a general options bag would hide which resource owns shutdown. Retain the explicit composition seam. |
| `src/interfaces/web/account/administration-routes.ts:205` | `keep` records a scoped actor/tenant, an action, its parsed target/role fields, and an outcome. The method converts the discriminated target once and captures audit failure without replaying the completed write. These are the event's necessary facts, not several callers repeatedly unpacking an unnamed domain object. The candidate adds only a page link. Retain the local event-assembly boundary. |
| `src/interfaces/web/account/logging-routes.ts:51` | Request/cancellation, the session's CSRF token, the trusted context, and the fixed save/test action have distinct admission and lifetime roles. The guard sequence uses each before the corresponding work. Retain this operation boundary; the candidate adds no parameter and does not change Save-before-Test. |
| `src/interfaces/web/account/logging-routes.ts:107` | `readPage` combines a trusted settings read with optional result feedback and a saved revision. The revision controls whether feedback can describe the version actually reread, while the token/context prepare the protected form. It returns unavailable state rather than guessed settings. Retain the feedback/version relationship as currently explicit; Quick start navigation introduces no new state into it. |
| `src/interfaces/web/account/logging-routes.ts:113` | `page` is the single adapter to the existing typed logging page: notice, public saved settings, CSRF token, tenant ID, and saved-feedback state describe separate presentation facts. The method builds the full render contract and fixed destinations in one place. The candidate only extends those destinations with Quick start. Retain this private adapter instead of introducing an arbitrary transport bag that hides which values are public and which protect a write. |
| `src/interfaces/web/auth/workos/workos-signup-routes.ts:141` | `openOrganization` needs the request signal, authenticated session, confirmed organization ID, and tracked request operation. It selects once, preserves cookie effects, checks cancellation, and redirects only after a successful switch. Keeping the tracked operation explicit preserves admission-slot accounting when requests disconnect. Only the success destination and its private name change. Retain the explicit contract. |

## Non-essential-comment findings: 59 retained reasons

The following groups account for every listed comment line. Several are short
descriptions, but they state authority, scope, ordering, or proof limits that
the adjacent TypeScript types do not express. No comment makes an obsolete
claim after the Quick start change.

| Comment sites from the supplied log | Retained reason after reading the code |
| --- | --- |
| `src/app/application.ts:16–17, 73` | Distinguish server-only environment settings from shared parsed deployment configuration and preserve explicit hosted selection. This explains why the composition does not infer deployment from the presence of provider variables. The new MCP URL is supplied from trusted parsed configuration. |
| `src/app/application.ts:30–32, 45–47, 117, 138–139` | Preserve route-order, endpoint allowlist, edition/tenant-role, and owned-resource boundaries. Internal/provider routes are not general public APIs; browser routes must run before signed-in account routes. Dynamic imports and the local path allowlist implement those limits. Quick start remains behind account-session/current-access checks. |
| `src/app/application.ts:59, 62, 149, 158, 163` | State the kind and scope of the composed services: privileged operator records versus customer audit export, the current free billing implementation, the shared MCP denial wording, one-line internal diagnostics, and deliberate audit discard when storage is absent. These comments give composition limits not encoded by broad interface names. They do not claim new billing, audit storage, or client authority. |
| `src/app/application.ts:84, 191, 236` | Explain resource/lifetime order: rules failure must precede opening local data; removal work must stop before shared SQL closes; listener-drain failure must be observed even if MCP cleanup is slower. The actual disposable stacks, close order, and eager drain observer implement those reasons. Retain them to protect cleanup/replay behavior during later composition edits. |
| `src/interfaces/user-portal/portal.ts:5–7, 22` | Explain that same-origin server session/access answers grant authority and browser display fields do not select tenants. The relative route table preserves the configured public path. Adding a menu link does not transfer any authorization to the browser. |
| `test/acceptance/auth/hosted-admin-journey.test.ts:56` | Explicitly limits the provider-fake invitation step: it proves application behavior, not native password or real-provider acceptance. Retain the evidence boundary even though the test then continues successfully. |
| `test/acceptance/auth/hosted-workos-signup.test.ts:542` | Explains why the fake is constructed before deliberately failed composition: its request history can establish that corrupt legal documents reached no provider operation. This is a test-order/proof reason, not a substitute for an assertion. |
| `src/interfaces/web/account/account-routes.ts:12–13, 100, 126` | Separate common session/current-access checks from each operation's own permission gate, keep protected known routes ahead of the optional operation, and state why the identity-only picker remains usable when its optional menu-access read fails. The new Quick start handler applies its own current-Admin check; a hidden link remains no authority. |
| `src/interfaces/web/account/account-routes.ts:81–82, 181–183` | Explain why error responses still preserve refreshed session cookies, why session-cookie effects precede later switch cookies, and why a new response is needed for immutable redirect headers. The current response reconstruction and ordered Set-Cookie append implement those rules for the new page as for existing routes. |
| `src/interfaces/web/account/account-routes.ts:151–152, 191, 205` | Explain origin-before-body work, current membership as selection authority, directory-URL normalization, and cloning/freezing resolver records to isolate a running operation from later mutation. The new page uses the same trusted snapshot and configured directory URL; no query value selects its workspace. |
| `src/interfaces/web/account/administration-pages.ts:25, 41` | Explain the whole-page completeness rule and why seats sit beside both active members and pending invitations. The route reads both complete overviews before rendering; seat facts include pending invitations. The candidate adds navigation only and does not change partial-read or seat semantics. |
| `src/interfaces/web/account/administration-routes.ts:26, 70–72, 117` | State the directory-URL input convention and the division between trusted account scope and service-side current actor/target checks. The code derives the actor and organization from the decided context, not submitted identity. The new link changes neither authority source nor service checks. |
| `src/interfaces/web/account/administration-routes.ts:179–181, 213` | Preserve origin-before-body work, the stale-form organization rule, removal of CSRF data before the service call, and the rule that failed audit capture cannot replace/repeat a completed write. These explain security and failure/replay choices not visible in method names. |
| `src/interfaces/web/account/logging-routes.ts:22, 45, 127` | Preserve trusted-tenant/Admin authority at entry, suppress credential-bearing collaborator causes from public/account failure reporting, and keep audit-capture failure from changing Save/Test or exposing an export cause. The fixed unavailable page and capture guard implement these limits. |
| `src/interfaces/web/account/members-page-layout.ts:14` | Keep emitted embedded styles and their exact CSP hashes under one owner so they cannot drift. The new optional style follows that same byte-based hash rule with a fresh response policy. Retain the coupling rationale. |
| `src/interfaces/web/auth/workos/workos-signup-routes.ts:20–21, 90` | Limit the admission guarantee to one process rather than a provider-global quota, and keep a disconnected POST's slot until its last provider operation settles. The pending counter, subject window, tracked outstanding promise, and finally path implement these limits. Changing the successful redirect does not free capacity early or change quota scope. |
| `test/acceptance/auth/hosted-live/signup-server.ts:36, 61` | The staging application has one registered localhost callback. Running the test-only signup composition last and opening it immediately after stopping the prior site keep that fixed port under the test run's intended ownership. These comments explain suite order and the race being avoided; an arbitrary ephemeral callback would not match provider configuration. The Quick start handoff changes no port or lifetime rule. |

## Oversized-file findings: 8 retained reasons

- `src/app/application.ts` remains the application composition/lifetime owner.
  The change supplies one existing trusted URL; provider implementations,
  portal rendering, and guide content stay outside it. Its public routing,
  construction, and cleanup roles were read above. Splitting at the size
  threshold would scatter those ownership rules without extracting a new role.
- `src/interfaces/web/account/account-routes.ts` remains the browser account
  boundary: session/cookie effects, selection, trusted access, known route
  dispatch, and safe failure. The new guide's small guard/name-read/render
  handler belongs behind that boundary; content, clipboard code, and styles
  already have focused modules. Retain the owner so selection and guide
  authority cannot diverge.
- `src/interfaces/web/account/administration-routes.ts` remains the dispatcher
  and admission/outcome adapter for member/invitation/billing operations.
  Parsed route definitions, trusted scope, one-write results, and audit capture
  form one boundary. The sole behavior increment is a navigation destination;
  no new administration algorithm is placed here.
- `test/acceptance/auth/hosted-signup-recovery.test.ts` groups independent
  lost-response, delayed-write, concurrent-create, restart, and failed-switch
  recovery scenarios with private fresh fixtures. The changed assertion is in
  the failed-switch/restart scenario and still checks no extra grant or legal
  acceptance write. Retain this coherent recovery inventory; do not split a
  scenario's lifetime merely to meet a line count.
- `test/acceptance/auth/hosted-workos-signup.test.ts` groups composed hosted
  signup acceptance and exact production-document proofs. The scenarios start
  fresh sites and keep policy-byte/provider-call assertions together. The
  increment changes the expected creation destination while those assertions
  remain present; no test is removed or made conditional to avoid a failure.
- `test/acceptance/user-portal/portal.test.ts` groups public-entry, current
  access, client setup, and role-controlled navigation through the public portal
  interface, using independent DOM/server-answer fixtures. The changed case
  adds the first Admin link while retaining User visibility, current-link,
  request-count, and no-privileged-form checks. Retain the behavior inventory.
- `test/integration/auth/workos-signup-routes.test.ts` groups the provider-
  neutral signup route contract: documents, methods/forms, refreshed cookies,
  activation results, selected organization, rate admission, and cancellation.
  The changed cases retain cookie/order/base-path checks and alter only the
  confirmed-creation destination. This is a focused integration boundary, not
  mixed production responsibility.
- `test/integration/hosted-admin/account-routes-administration-pages.test.ts`
  groups the combined Members-page contract: complete reads, labelled rows,
  pending state, protected forms, escaping, current roles, failure, and base
  paths. The one diff adds Quick start to the expected trusted header. Retain
  the independent scenario inventory and record the two test-diagnostic
  limitations separately above.

These retention reasons are specific to the inspected increment. A future
feature that adds unrelated behavior or changes a listed invariant must review
cohesion again. No habit-hooks suppression or human approval was added. Separate
MI exceptions for the two new guide rendering/content files are recorded in
`quick-start-quality-note.md`; they do not suppress habit-hooks findings.

## Concise text for Quality review

The complete-candidate habit-hooks scan completed with exit 1 and 83 retained findings:
8 complexity, 2 non-null, 6 parameter, 59 comment, and 8 size findings, with no
snoozes. Nine new non-null assertions from the earlier 90-finding scan were
removed and now have explicit checks. The two retained assertions are local Members test-DOM/
fixture dereferences whose failure stops the test; their diagnostic limits are
recorded. Shared-shell complexity preserves one owner for optional navigation,
page bytes, and exact CSP hashes. Retained route complexity/parameters preserve
current authority, one-write Save/Test/invitation outcomes, cancellation,
cookie effects, and cleanup ownership. The large source files remain cohesive
composition/account boundaries; the large test files retain independent
behavior inventories. All 59 comment findings were read and grouped by their
security, lifetime, configuration, layout-count, or evidence-limit reason.
The snooze file remains empty. This assessment supplies reasons, not a waiver
of final tests, metrics, independent T2 approval, or checker blockers.
