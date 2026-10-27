## Quality review

Candidate `057434b9c3ad313f656b03e033866cdecab7ae51`; actual parent/merge base `aa8c56bb7e195e97d2362b2c661cc63a760a5cc9`; complete-candidate main `9507e751215fec32748bf4e944f2393928e61cf5`.

**T1 Team review. Architecture: T0: no architecture fact.** [Final checker](EVIDENCE_ROOT/validation/review-check-quality-057.json) has only trusted `read_paths: docs/implementation/test-gate-policy.md`, no facts/questions/mechanical blockers. Inventory text updates actual browser scope, not commands, gate selection or authority; all semantic flags remain false. No exception, baseline change or de-escalation.

**Overall blocked; Draft:** current local image, hosted-live and independent current-head human approval remain holds. Root accepted the current summary and all individual reasons; the independent raw audit is complete with no actionable evidence defect. [Independent audit](EVIDENCE_ROOT/review/ui04-evidence-review.md). Current source/architecture audit already signs off exact 057. [Manager record](EVIDENCE_ROOT/review/ui04-fresh-quality-manager.json). Gate verification and root's publication readback remain separate. Mechanical eligibility is not proof of gates or human identity.

### Metrics and retained findings

[Process](EVIDENCE_ROOT/ast-report/process.md), [JSON](EVIDENCE_ROOT/ast-report/process.json), [review](EVIDENCE_ROOT/ast-report/review.json), [CRAP](EVIDENCE_ROOT/ast-report/crap.json), [base](EVIDENCE_ROOT/ast-report/snapshot-base.json), [head](EVIDENCE_ROOT/ast-report/snapshot.json), [all reasons](EVIDENCE_ROOT/validation/retained-findings-quality-057.json). Process exit 1 for completed Delta's existing-file MI miss; Review/CRAP/Architecture pass. This is not a wholly green process.

Existing `administration-pages.ts` MI 59.2023→57.9066 (drop 1.2957): retain cohesive Members/invitation HTML with counted disclosure and compact escaped forms at one owner. Added template volume does not warrant a mechanical split; required functions have at most four paths and measured CRAP 1–4. No new low-MI file or five-point source drop. Static `members-style.ts` has no functions in complete snapshots; raw MI/function CRAP are N/A; real browser reflow/focus/contrast/targets cover it.

Three low Halstead volume notes remain; no high/medium/new-function >10-path finding:

- `test/acceptance/auth/hosted-invitations.test.ts`: Estimated bugs (Halstead): 0.82 -> 1.22. The public acceptance cases now check the counted pending disclosure, compact row facts and complete-read failures. The size-derived estimate rises with those specifications; no product failure is inferred.
- `test/acceptance/auth/hosted-members.test.ts`: Estimated bugs (Halstead): 2.44 -> 2.71. The updated assertions distinguish displayed active members and pending entries while retaining product seats and access rules. Keep the public behavior coverage; the estimate is not an observed defect.
- `test/integration/hosted-admin/account-routes-administration-pages.test.ts`: Estimated bugs (Halstead): 4.09 -> 5.08. New route cases check zero/nonzero disclosure state, protected action fields, accessible labels, section order and UTC expiry. Keep those related contract checks together.

Required functions all pass with known identities and measured coverage: `membersPage` 4.000221184 at 97.6%; `invitationRow` 1 at 100%; new callbacks 2 and 1 at 100%. Unchanged rows retain “unchanged by this PR.” Base CRAP from head coverage is an estimate. Global unchanged-function coverage remains incomplete, and unresolved `src/interfaces/user-portal/main.ts → ./style.css` remains on both revisions; edge/cycle comparisons requiring a complete graph are withheld. Registry/import review supports bounded unchanged ownership, not a complete graph proof. No new history record: parent aa8 is off main; inherited records remain unchanged.

Inherited UI03/02/01 dispositions stay in [current parent full evidence](UI03_EVIDENCE_ROOT/README.md); their cohesive template ownership, fixed recovery response and explicit test-matrix reasons remain, without repeating inherited whole-stack tables. Only top-level 057/aa8 reports support current quality; historical native 072 logs keep their own scope.

### Habit-hooks

Exit1:42 findings (7 non-null, 31 comments, 4 oversized files), each retained with reason; snooze [], no suppression. [Raw log](EVIDENCE_ROOT/validation/habit-hooks-quality-057.log), [all 42 reasons](EVIDENCE_ROOT/validation/retained-findings-quality-057.json).

<details><summary>Every retained finding and reason</summary>

- `test/integration/hosted-admin/account-routes-administration-pages.test.ts:41` (non-null-assertion): This test reads the rendered Members list container to check section order. A missing container throws at this line and fails the public-route specification; it cannot produce a silent pass. The assertion is local to test markup and creates no production nullable-state rule.
- `test/integration/hosted-admin/account-routes-administration-pages.test.ts:55` (non-null-assertion): The case builds two fixture entries, asserts exactly two rendered rows, then uses only their indices 0 and 1. A mismatched entry fails the test at the read. Keep this bounded test pairing; it is not production input handling.
- `test/support/drivers/browser/pending-invitations-browser.ts:17,48,56` (non-null-assertion): These evaluations run on elements attached to the real Chromium document. Its defaultView supplies computed styles. A missing view throws and fails the browser case; it cannot be accepted as a valid geometry result. No product lifecycle or circular owner is involved.
- `test/support/drivers/browser/pending-invitations-browser.ts:50` (non-null-assertion): The button is selected inside this.disclosure, so its details ancestor is the tested surface. If markup removes that ancestor, the browser evaluation fails immediately. This is a test-local DOM assumption, not a production fallback.
- `test/support/drivers/browser/pending-invitations-browser.ts:59` (non-null-assertion): The loaded Members fixture has the page heading whose doubled font is asserted as 64px. If the heading is missing, evaluation fails immediately. Keep the local observable check; no runtime null state or authority is hidden.
- `test/acceptance/auth/hosted-workos-administration.test.ts:10,11,12,13` (non-essential-comment): The comment states the real HTTP composition and controlled WorkOS seam, preventing application-side results from being presented as live provider evidence.
- `test/acceptance/auth/hosted-workos-administration.test.ts:18` (non-essential-comment): The comment connects the fixture external ID to the operator runbook constraint.
- `test/acceptance/auth/hosted-workos-administration.test.ts:36,37` (non-essential-comment): The fixture summary explains the two organizations, mixed roles/statuses and the six active product members.
- `test/acceptance/auth/hosted-workos-administration.test.ts:83,84` (non-essential-comment): The comment explains why refused pages read the session form token through the session endpoint rather than a missing page form.
- `test/acceptance/auth/hosted-workos-administration.test.ts:110,111` (non-essential-comment): The comment defines observed administration writes and excludes sign-in/refresh traffic from that evidence.
- `test/acceptance/auth/hosted-workos-administration.test.ts:138,139` (non-essential-comment): The comment distinguishes organization-wide member reads from access-resolution reads for the signed-in user.
- `src/interfaces/web/account/administration-pages.ts:25` (non-essential-comment): Keep the complete-read invariant explicit: both member and invitation reads must succeed before rendering, so a partial read cannot look like a correct count or page.
- `test/support/drivers/browser/hosted-browser.ts:23` (non-essential-comment): The comment distinguishes null, which omits Origin, from undefined, which uses the public origin. This matters to unsafe-request specifications.
- `test/support/drivers/browser/hosted-browser.ts:28,29,30` (non-essential-comment): The comment defines cookie handling, the no-auto-redirect behavior and the listening/in-process transport seam. These limits explain what this protocol driver proves.
- `test/support/drivers/browser/hosted-browser.ts:59` (non-essential-comment): The raw string-body path deliberately preserves duplicate form fields so boundary tests can send malformed input; normal URLSearchParams conversion would lose that case.
- `test/support/drivers/browser/hosted-browser.ts:95,96` (non-essential-comment): The comment records the loopback transport and public Host/raw-header behavior that origin and routing assertions depend on.
- `test/support/drivers/browser/hosted-browser.ts:118` (non-essential-comment): The form reader takes hidden fields, checked radios and accessible button names while callers fill visible fields. This is the contract used by the new short-label invitation markup and its consumers.
- `test/support/drivers/browser/hosted-browser.ts:131,132` (non-essential-comment): The comment limits missing-form diagnostics to button names because hidden fields contain the session form token. Keep that disclosure constraint explicit.
- `test/support/drivers/browser/pending-invitations-page.ts:3` (non-essential-comment): Keep this protocol-reader scope note: it reads displayed pending email/role facts, not provider state or action authority.
- `test/acceptance/auth/hosted-live/administration-server.ts:44,45` (non-essential-comment): The comment defines safe page-failure diagnostics: operator path/failure reports are allowed; credentials are not.
- `test/acceptance/auth/hosted-live/administration-server.ts:80` (non-essential-comment): The credential sentinel returns only a boolean. Keep the no-secret-output limit visible beside the test guard.
- `test/acceptance/auth/hosted-live/administration-server.ts:102` (non-essential-comment): The shared administrator session survives between cases. This lifetime explains the complete-group requirement and must stay explicit.
- `test/acceptance/auth/hosted-live/administration-server.ts:105` (non-essential-comment): The helper uses the current visible page form and its button name before posting. Keep the public interaction boundary clear for the live cases.
- `test/acceptance/auth/hosted-live/administration-server.ts:130` (non-essential-comment): Invitation tokens and links are test-only credentials. The comment identifies that sensitive scope and prevents treating their reads as safe public output.
- `test/acceptance/auth/hosted-live/administration-server.ts` (oversized-file): Keep the existing live administration journey with its shared session, provider observations and credential sentinels together. UI-04 updates form observations; it does not add provider operations. Splitting only to meet a line count would obscure that sequence.
- `test/acceptance/auth/hosted-member-removal-browser.runtime.ts` (oversized-file): The 71-case inventory states the combined user journey across viewports, JavaScript states, keyboard actions and safety outcomes. Existing drivers hold mechanics. The test file has no MI goal; keep the complete behavior inventory.
- `test/acceptance/auth/hosted-workos-administration.test.ts` (oversized-file): This acceptance inventory uses one real HTTP composition and controlled provider seam to check related administration behavior. UI-04 updates pending facts and labels without adding a product responsibility.
- `test/integration/hosted-admin/account-routes-administration-pages.test.ts` (oversized-file): The integration file groups public Members rendering contracts: complete counts, native disclosure state/order, protected forms and escaping. The new cases state observable behavior; a size-only split would not create a clearer owner.

</details>

The seven non-null test assumptions fail loudly rather than produce false passes: required list/fixture rows, attached document defaultView, details ancestor and a heading whose resized font is checked. They add no production nullability or authority rule. Comments preserve controlled-provider boundaries, count/CSRF/read-vs-write semantics, transport/header/form/credential limits and fixture lifetimes. The four long files retain cohesive acceptance/live/route inventories with mechanics in drivers.

### Checker notes and architecture

[Every checker note/reason](EVIDENCE_ROOT/validation/checker-notes-quality-057.json). The checker confirms 49 public modules/0 snapshot changes; no informational architecture fact. API generation filters 33 diagnostics in 2 unlisted modules, verifies all 49 snapshots current, and fresh broad typecheck passes. The preliminary eligibility note remains relevant because image/live/human holds remain unresolved. No unchanged-file finding needs a new reason.

<details><summary>Pinned architecture provenance</summary>

[Before registry](https://github.com/tomer-mayara/Thermus/blob/aa8c56bb7e195e97d2362b2c661cc63a760a5cc9/architecture/components.md), [after](https://github.com/tomer-mayara/Thermus/blob/057434b9c3ad313f656b03e033866cdecab7ae51/architecture/components.md), [current assessment](EVIDENCE_ROOT/validation/architecture-assessment-quality-057.json), [inventory](EVIDENCE_ROOT/review/current-increment-inventory.json), [source audit](EVIDENCE_ROOT/review/source-review.md), [source publication](EVIDENCE_ROOT/review/source-stack-push.json).

All 15 registry views/prose stay byte-identical. In hosted Node server Web, membersPage renders the complete filtered pending collection; invitationRow emits escaped forms with unchanged actions/fields, shorter visible labels and recipient-specific accessible names. Roles, absolute UTC expiry, allowed operations, complete-read failure, authority/replay/recipient rules, fixed outcomes and removal safeguards stay at existing owners. Full help moves after lists with exact text/version/hash. No production callable signature, component/edge, public declaration, provider operation, script, store or deployment boundary changes. No L3 comparison needed; no changed callable contract, so L4 omitted. Native/browser helper APIs are test support.

Original native 072 provenance and same-package dependency/launcher records are preserved; they do not establish current image/live gates. Original 3380 live failure keeps its old pins; no fresh 057 live proof inferred. Historical source links remain accessible through published ancestry.

</details>

[Original full UI-04 evidence](https://github.com/tomer-mayara/Thermus/blob/efef59fd51f92ebe90eb655f2f8b29fe965debee/review-evidence/ui-04/3380afe663c6a2ef02a0adda525faccd6f5b726f/README.md), [full 072 native bundle](EVIDENCE_ROOT/historical-07285735/README.md), [old PR bodies](EVIDENCE_ROOT/review/pr-before-268.json). No earlier Slice 2.5 approval transfers. This artifact snapshot predates final gate settlement/publication; root records actual publication/readback separately.
