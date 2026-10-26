# UI-02 manager review

Comparison: UI-02 against UI-01 at a017020ebe2448f5de6cc7d9cbb0700367fc80b1.
The final candidate and check pins are recorded in final-candidate.json.

## Behavior and scope

The existing Web renderer uses the complete overview to count active rows. It retains activeUserSeats as the separate product-access count. Native definition lists label Member, Role and Action. All active rows remain, including absent and unsupported roles. The existing removable decision controls the action. No displayed role count makes a last-Admin decision.

Trusted subject equality selects You and Leave. An email match cannot select either. All email and organization text, including accessible names, is escaped. Native disclosures and existing protected forms work without JavaScript. Only the final confirmation is red. Existing POST action, CSRF, organization, membership and revision fields, Cancel GET, consequence text and result recovery links remain. Provider and domain code do not change.

Manager inspected the normal desktop preview and expanded narrow preview, the production diff, route assertions and browser journeys. At desktop the three facts align. At narrow widths the facts stack and long names wrap. Independent review found cramped confirmation text at 481px; a failing browser case led to stacking through 860px. The retained gate checks 481, 600 and 860px as well as 320 and 1280px. Invite and pending-invitation presentation remain the separate UI-03/04 work.

## Architecture

All 15 Mermaid views and all prose in architecture/components.md are byte-identical to the parent. Checked context, hosted containers, source owners, hosted authentication, membership removal, Audit settings, member-read runtime, behavior/resource ownership and deployment. The existing Web owner renders the same overview and submits the same protected POST. No component, runtime/type import edge, public declaration, provider read, lifetime, store or security rule changes. No registry edit or L3 comparison drawing is needed. No production callable contract changed; L4 is not needed. The browser helper is test support only.

The test-gate inventory row now describes the implemented browser cases. Commands, path selection and decision authority remain unchanged. Its removed row mechanically selects T1 through the trusted read-path policy. The semantic policy flag remains false. Independent human approval of the current candidate is still required before merge; agent review is not that approval. The request permits Ready, not merge or deployment.

## Retained habit-hooks findings

The hook exits 1 with the findings below. This is not a clean hook pass. All are reviewed and retained for these reasons under AGENTS.md; no snooze or suppression is added.

- High complexity, hosted-member-removal.test.ts:27: the parameterized refusal specification names each independent invalid condition at the shared HTTP boundary and checks the same no-delete invariant. The explicit setup branches keep the defect under test visible; moving them into a generic mutation table would hide that input. UI-02 changes only a later heading assertion.
- Four parameters, member-removal-browser.ts:5: the driver needs test cleanup, its HTTP transport, the trusted session cookie and browser options. These are separate concerns at the browser setup seam. A catch-all options record would hide the same coupling. UI-02 adds only a focused style-reading helper below this function.
- Comments, administration-pages.ts:25: the complete-read constraint explains why the page cannot show a partial success. The comment preserves a failure guarantee.
- Comment, hosted-removal.live.ts:230: provider API acceptance proves replacement membership and role, but cannot prove invitation recipient/link rules. This evidence limit prevents an invalid security claim.
- Comments, hosted-workos-administration.test.ts:9-12: the real HTTP composition with a provider double and single-role assumption delimit what the test proves; staging remains required for provider behavior.
- Comment, same file:17: the fixture external ID must match the operator runbook.
- Comments, same file:35-36: the membership fixture explains why active product seats, unsupported roles, inactive rows and other-workspace rows differ.
- Comments, same file:82-83: a refused page has no form; the session response supplies the real CSRF token for the rejection scenario.
- Comments, same file:109-110: authentication calls are excluded from the mutation assertion so the test can prove no organization change.
- Comments, same file:137-138: user-specific access-resolution reads are excluded from the complete organization-read assertion.
- Size, hosted-member-removal-browser.runtime.ts: the dedicated gate keeps existing shared-shell/Audit regressions with fresh self/other Cancel/Confirm keyboard journeys. Coherent browser operations are already in its driver; splitting by line count would obscure the selected gate.
- Size, hosted-removal.live.ts: one fresh fixture lifecycle covers refusal, removal, retained access, reinvitation and verified cleanup. UI-02 changes only the exact final-button selector and its calls.
- Size, hosted-workos-administration.test.ts: the file holds one HTTP/provider composition and its request assertions. UI-02 migrates only displayed row/count assertions.
- Size, account-routes-administration-pages.test.ts: the file keeps the route/render contract, escape cases and read refusals together. The new identity and role cases use the same seam.

Metrics, final independent review and final sign-off follow after the complete-candidate checks.


## Maintainability inspection

The pinned file inspection reports administration-pages.ts at MI 59.469, compared with 61.251 at the parent (drop 1.783). This is an existing file, not a new file. membersPage remains 3 paths and 17 lines; removalForm has 4 paths and 13 lines, reflecting the three trusted-self display choices for label, accessible name and native summary. These decisions belong with the protected form markup and escaping. Splitting the template or creating a presentation abstraction would add indirection without removing a domain decision. Retain this low score; the final CRAP report must still meet its changed-function goals. members-style.ts is a literal-only style module with zero callable functions and no scored MI. No metric exception is proposed.

Independent reviewer /root/ui02_final_review signed off d742e14410a4e8ed0ccc9986a29d174936ffcf4b against a017020ebe2448f5de6cc7d9cbb0700367fc80b1 with no actionable findings. The root manager accepts that review. Final documentation or immutable metric-history changes will be checked separately.


The first complete metrics run used verified unit coverage. It assessed removalForm at 20.0 and membersPage at 12.0, within the changed-function goal. The changed member-map callback was classified new by token identity and had unknown coverage because renderer behavior is covered through real Web integration tests. This left one required assessment unresolved, so no passing CRAP claim is made for that run. Its process and coverage reports are retained. Collect coverage from the complete integration group, already selected and passed within npm test, to measure that callback. This does not expand test selection or change code.

Review retains one high test finding: hosted-member-removal-browser.runtime.ts MI 28.151 → 14.557. The file expresses fresh native keyboard journeys across actors, actions and widths beside the retained shared-shell/Audit regressions. Its setup is in the existing browser/site drivers; factoring expected outcome branches into more generic test machinery would hide the acceptance steps. Tests have no production MI goal. Two low Halstead estimates are retained: hosted-members.test.ts 1.80 → 2.44 and account-routes-administration-pages.test.ts 2.83 → 3.35. These reflect the added observable count, identity, escaping and role assertions at their existing test seams; they are size estimates, not demonstrated defects.


## Integration coverage result

All 1,158 integration tests passed under the verified coverage collector. The final normalized report uses this integration capture. It measures removalForm at 100% coverage, CRAP 4; membersPage at 98.1%, CRAP 3.00006; the changed member-map callback at 100%, CRAP 3; and the other callback classified new at 100%, CRAP 1. All changed/new goals pass, with no unknown functions or required metric exception. The earlier 3,301 emitted and 29 portal unit tests passed too; their capture is retained separately rather than relabelled as combined coverage.

The complete process has Delta and Review goal misses only for the retained MI/test findings above. CRAP and Architecture pass. The graph retains the unchanged unresolved local CSS import from user-portal/main.ts; it is a graph-parser limit, not proof of a complete global import graph. No immutable metric history is written for this stack parent: the tool reports a017020e is not on origin/main. Do not invent or hand-edit a history record. Base values based on head integration coverage are estimates, not measured base coverage.


## Image provenance correction

The manager started the first hosted-image build alongside metrics comparison. The native comparison command temporarily checks out its parent; this behavior is documented in script/code-quality/README.md. The image's integration count was 1,157 and the new labelled-member case was absent. The first image therefore cannot validate UI-02, even though its own seven runtime tests passed. Its logs are retained as invalid-comparison evidence. No source change or test waiver is used. All comparisons were stopped, final HEAD and 860 input hashes were verified, and the image gate was rerun from the stable final tree. A separate read-only probe checks the hashes of both compiled UI-02 production files in the final AMD64 image. Habit-hooks was also rerun after comparisons stopped.


## Final manager sign-off

Final candidate e8f097dacad194fd3d540dee2fd79b52563e50c2 is signed off for Ready. Its only change after the independent source review at d742e144 is the validation record; the manager read that delta and verified 860 tracked input hashes. All selected functional checks pass: 5,131 ordinary +49 portal, 123 focused, 19 browser, 29 staging, 11 self-hosted container and 7 final hosted-image runtime tests. The corrected fresh AMD64 offline build passes 3,301 unit +49 portal +1,158 integration +119 acceptance +13 renderer checks and includes the new labelled-member scenario. Both compiled UI-02 modules in the final image exactly match the stable local build. The first image result remains invalid and excluded.

The final checker reports T1 Team review, locally eligible, no technical blocker, no architecture fact and 49 unchanged public snapshots. Required CRAP goals pass; the documented MI/test findings and habit-hooks findings remain retained for their stated reasons. No metric exception or suppression is used. No CI checks/statuses were reported for this head. Overall merge status remains blocked pending independent current-candidate owner/team approval. This task stops at Ready; no merge or deployment is claimed.
