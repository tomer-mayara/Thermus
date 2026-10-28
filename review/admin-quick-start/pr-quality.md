## Quality review

Candidate: [`f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e`](https://github.com/tomer-mayara/Thermus/commit/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e).
Trusted main merge base: [`feeaad4d5f04212f033366c232180be4bd40da4c`](https://github.com/tomer-mayara/Thermus/commit/feeaad4d5f04212f033366c232180be4bd40da4c).

**Tier: T2 Need architect. Overall merge status: blocked pending independent
authorized human approval of this SHA and scope.** The owner's 28 October
implementation approval sets product scope; it is not final-candidate approval.
Manager and agent reviews do not supply that human approval. No de-escalation
is claimed. All selected execution gates passed, including the Linux AMD64
hosted image (7/7) and WorkOS staging live gate (29/29); no environment blocker
remains. The final browser refresh passed 85/85 and final static/build checks
exited 0. Exact commands, run identities, source-reuse evidence, and retry history
belong in Validation and the [environment-gate record](./environment-gates/summary.md).

**Checker:** T2 Need architect; preliminary eligibility `eligible`; blockers
`[]`. Generated Architecture summary: **`T0: no architecture fact`**.
Architecture facts, undeclared facts, declared facts, and policy questions are
all empty. The actual T2 tier comes from the semantic flags below, rather than
a mechanically detected component/dependency/declaration/registry fact. The
checker explicitly notes that local eligibility is preliminary: the manager
must verify current checks, holds, and independent human approval. That note
does not remove the visible approval hold above. See the
[complete checker report](./checker.json).

Every checker reason and its disposition:

| Tier and canonical reason | Disposition |
| --- | --- |
| T2 `impact.contract` | Retain T2 for the new protected browser `GET/HEAD quick-start` response and the post-creation redirect. Independent authorized architect approval must cover this candidate. |
| T2 `impact.internalInterface` | Retain T2 for the required configured MCP URL supplied from app to `HostedAccountRoutesOptions`; the existing app/web owner relationship remains accurate. |
| T1 `read_paths` — `.code-quality-exceptions.yaml` | The candidate adds only the two bounded MI exceptions described below. Retain the protected-path review reason; no default goal, review authority, or other exception is weakened. |
| T1 `ratchet.exceptions` — `quick-start-content.ts` | Final MI 53.95041254701023 is above floor 53.5 through 2026-12-27. Retain the canonical prose/Markdown/URL-guard owner for the specific reason recorded below. |
| T1 `ratchet.exceptions` — `quick-start-page.ts` | Final MI 57.18060902544582 is above floor 57 through 2026-12-27. Retain the cohesive page and byte-preserving helper refactor for the specific reason recorded below. |
| T1 `impact.sensitiveBehavior` | Retain review of current selected-organization Admin admission, trusted name/configuration, and safe copy behavior. The security answer below records the guarantees. |

Every checker informational note and its disposition:

- **53 public modules, 0 snapshots changed:** declaration verification found no
  public declaration delta; no added callable capability is inferred from a
  source import. The browser route and supplied configuration are still
  declared semantically by the T2 flags.
- **Public module touched, declarations unchanged: `src/index.ts` (imports
  changed `src/app/application.ts`):** this is propagated touch evidence through
  its application import, not a direct index declaration change. The actual
  addition is app's supplied MCP URL; index's public declarations stay stable.
- **`ratchet.maintainability_index.existing_file_drop_note_at` — shared layout
  80.3695659257948 → 68.69398639898778:** retain the 11.6756-point drop as an
  informational note with the shared navigation/byte/CSP-owner reason below;
  it is neither hidden nor reclassified as a pass or another tier.

Checker, process, CRAP, and head snapshot now all bind the final candidate
`f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e` and the trusted base above. The
final process preserves **Delta: goal miss; Review: passed; CRAP: passed;
Architecture: passed**. Permitted exceptions resolve the two new-file MI
blockers without changing the reported goal miss. Earlier candidate runs remain
history. See the [process JSON](./process.json),
[final process run](./process-final-run.log),
[CRAP JSON](./crap.json), and
[head snapshot](./snapshot.json).

### Declared impact and security answer

The committed [impact declaration](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/.pr-impact.json)
sets `contract`, `internalInterface`, and `sensitiveBehavior` true; all other
classification flags are false, including `uncertain`. Registry prose is updated
(`modelUpdated: true`). `contract` covers the new browser `GET/HEAD quick-start`
response and creation destination. `internalInterface` covers the required
configured MCP URL supplied from app to web. `sensitiveBehavior` covers the
new protected Admin read and explicit rejection of an absent selected workspace.
The two used MI exceptions and their protected exception-file path add team
review reasons without reducing the T2 requirement.

Security policy answer: the guide is served only after session authentication,
current access resolution, matching subject/authority/selected organization,
product permission, exact Admin role, and a current authorized nonblank name.
Query hints cannot supply the organization or its name. Failed/mismatched name
reads and cancellation produce no guessed guide; non-read methods are refused.
App supplies trusted portal/MCP URLs; HTML and Markdown escaping keep names as
text. The copied guide contains no credentials, session values, member records,
invitation links, or log events. Exact CSP hashes cover source-owned styles and
copy script; no unsafe-inline/eval allowance is added. Copy success follows the
completed clipboard write, with selectable fallback on failure. Navigation
visibility gives no authority. Existing legal bytes, Audit Save-before-Test,
provider enrollment, and external network-policy ownership retain their rules.
The implemented page adds no enforcement or completion claim for those controls.

### Metrics and retained findings

The completed final-head process reported
**Delta: goal miss; Review: passed; CRAP: passed; Architecture: passed**.
The delta is not represented as a pass: all 11 measured changed production
files remain below MI 85. Two additional string-constant files are unmeasured.
The new immutable base-history record was created by the complete process and
committed as [2026-10-27-feeaad4d.json](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/docs/metrics/2026-10-27-feeaad4d.json).
No historical record or metrics baseline was edited. Full reports:
[process](./process.md), [review](./review.md),
[review JSON](./review.json), [CRAP JSON](./crap.json),
[base snapshot](./snapshot-base.json),
[head snapshot](./snapshot.json), and
[detailed quality dispositions](./quick-start-quality-note.md).

The API-surface probe reported 33 compiler diagnostics in two modules outside
`public_surface`; it excluded them from declaration generation as designed.
This is a limit of that probe, not a clean application type-check claim. The
separate full application and portal type checks passed for the final candidate.
The process also retains an older missing main-history record between b4bcf956
and 106a4221. It predates this candidate; no record was fabricated or rewritten.

The review stage reports **0 new critical issues and four other regressions**:
three medium and one low; no high finding is retained. Each has an explicit
disposition:

| Finding | Retained reason |
| --- | --- |
| Shared layout MI 80.3696 → 68.6940, drop 11.6756 | The common renderer owns optional navigation/current-page state, escaped workspace text, emitted style/script bytes, and their exact CSP allowances. Fresh response headers prevent policy mutation across requests. The five-point-drop informational note is retained visibly; the lower score is not called a pass. Moving conditions to one-use helpers would move the count or duplicate this page/policy contract. |
| `membersPageLayout` paths 8 → 13, above the tool's threshold 10 | The additional decisions select the optional Quick start link and active/layout state, plus conditional exact style/script hashes. They do not add authorization or mutation algorithms. Unit/integration contracts and real Chromium keyboard/layout/copy cases cover Members, Audit, Connect, picker, and Quick start consumers. The changed function has verified CRAP 13.0 at 99.8% captured coverage; that does not remove the retained complexity finding. |
| `quickStartContent` method LOC 32, threshold 30 | The ordered full Markdown assembly stays with one canonical provider/prose owner and its URL/Markdown escaping. All 23 approved paragraphs match in order after line-wrap normalization and all six headings match. The method has two paths, 100% captured coverage, and CRAP 2.0. A two-line score-driven extraction would split the canonical assembly without another invariant or lifetime. |
| Shared layout Halstead estimated bugs 0.16 → 0.27 | The estimate rises with the added navigation/policy token volume and decisions; it is not an observed defect count or measured failure probability. The source review retains escaped dynamic values, source-owned raw assets, exact hashes, and per-response policy construction. Keep these guarantees in one owner and retain the estimate alongside its limits. |

<details>
<summary>All changed production MI results and bounded exceptions</summary>

| File under `src/` | Base MI | Head MI | Disposition |
| --- | --- | --- | --- |
| `interfaces/web/account/members-page-layout.ts` | 80.3696 | 68.6940 | Retain the shared navigation/bytes/CSP owner and its explicit drop/complexity reasons above. |
| `interfaces/web/account/account-routes.ts` | 54.0304 | 50.3440 | Keep the guide's current-Admin/method/name/cancellation guards beside the existing session, cookie, trusted-access, and safe-failure boundary. Rendering/content are already separate modules. |
| `app/application.ts` | 55.4483 | 55.3846 | One existing configured URL is supplied at the composition seam; shared shutdown, removal-before-SQL cleanup, and observed failures remain under the lifetime owner. |
| `interfaces/user-portal/portal.ts` | 48.7609 | 48.6046 | Keep the new exact-current-Admin link with the existing role-based menu; session/access reads retain authority, and Connect remains current. |
| `interfaces/web/account/administration-pages.ts` | 60.3372 | 60.3372 | The optional navigation declaration preserves one Members render contract: complete overviews, escaped provider text, pending seats, and supported protected forms. |
| `interfaces/web/account/administration-routes.ts` | 51.2323 | 51.1726 | Only a navigation destination is added; current scoped actor/target reads, origin/form/stale checks, one write, and fixed outcome recording remain one boundary. |
| `interfaces/web/account/logging-routes.ts` | 47.9085 | 47.8893 | Only a fixed navigation path is added; current Admin checks, Save-before-Test, revision feedback, cancellation, and credential-cause containment remain coherent. |
| `interfaces/web/account/organization-selection-page.ts` | 65.6762 | 65.3010 | Keep one native picker render with escaped names, protected selection fields, current marker, and the optional trusted Admin menu. The link confers no selection authority. |
| `interfaces/web/auth/workos/workos-signup-routes.ts` | 40.5418 | 40.5347 | Keep the new success destination beside the checked session switch; admission tracking, pending remote work, cookies, failures, and replay protection retain their owner. |
| `interfaces/web/account/quick-start-page.ts` | New | 57.1806 | MI exception floor 57, expires 2026-12-27. Named local render helpers improved the main function MI 63.6 → 71.9 with one path and byte-identical DOM/CSP; aggregate file MI moved 62.8 → 57.1806. Retain one page contract for the three steps, visible Audit limits, complete guide, escaping, configured links, and shared policy. |
| `interfaces/web/account/quick-start-content.ts` | New | 53.9504 | MI exception floor 53.5, expires 2026-12-27. Retain approved prose/provider data, full Markdown assembly, trusted URL validation, and Markdown escaping together. The largest function has six necessary URL-validation paths; per-section files/per-guard wrappers would distribute the same canonical link-safety rule. |
| `interfaces/web/account/quick-start-copy.ts` | Absent | Not measured | Zero parsed source functions: browser JavaScript is embedded as a CSP-hashed string and is not numerically assessed inside that string. This is not MI 100 or full client coverage. Direct VM outcomes and real-browser keyboard/copy cases verify the tested behavior. |
| `interfaces/web/account/quick-start-style.ts` | Absent | Not measured | Stylesheet string data has no parsed functions or MI. Exact policy/asset checks and real-browser reflow/focus/overflow checks supply behavior evidence, not a numeric function score. |

The two new file-specific entries in the committed
[exception file](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/.code-quality-exceptions.yaml)
are the only new metric exceptions. Existing sub-85 scores above are retained
with reasons, not declared compliant merely because their deltas are small or
zero. The final checker lists only the two new Quick start entries as used
exceptions; both are recorded in the reason table above. The existing
logging-route entry adds no further reason here. No exception changes the
MI 85 default, CRAP goals, coverage rules, or permission to ignore tool failures.

</details>

CRAP used verified compatible unit + integration coverage. The completed report
has **0 limit violations, 0 new-function target misses, 0 unmeasured functions,
and 0 required functions with unknown assessment/identity**. Key new/changed
results are Quick start route 8.0 at 100%, current-Admin guard 8.0 at 100%,
shared layout 13.0 at 99.8%, URL validation 6.0 at 100%, canonical assembly 2.0
at 100%, and each new page render helper 1.0 at 100%. One added one-path
composition closure has 0% captured coverage and CRAP 2.0; it meets the bound
without a claim of full coverage. No new CRAP exception is claimed. Base CRAP
derived from head coverage remains an estimate, not measured base coverage.
Browser copy cases use controlled success/denial hooks; they verify page
outcomes and keyboard/fallback behavior, not native host clipboard permission.
Final coverage identities and accepted/rejected capture history are retained in
[coverage data](./coverage.json),
[first attempt](./coverage-run.log),
[retry](./coverage-retry.log), and
[verified run](./coverage-final.log); Validation records their
candidate/source compatibility. Rejected capture attempts are not passes.

### Habit-hooks and review history

The complete-candidate habit-hooks scan exited 1 with **83 retained findings:
8 complexity, 2 non-null assertions, 6 parameter, 59 comment, and 8 size**.
The snooze file is `[]`. Nine new non-null assertions from the original
90-finding scan were replaced by explicit checks. The intervening 81-finding
scan lacked the later-selected live helper's two existing comments. Those
comments explain why the test-only site runs last and immediately takes the
registered callback port after the prior site stops; this avoids a port-ownership
race and preserves provider configuration.

The two retained assertions are local Members test-DOM/fixture dereferences:
a missing list container or fixture entry fails the test synchronously; neither
can silently pass or grant product authority. Their diagnostic limits remain
recorded. Layout complexity retains one escaped-data/navigation/CSP owner;
route parameters and size retain current-authority, one-write, cancellation,
cookie, and cleanup boundaries. Other size findings retain independent focused
test inventories. All 59 comments were read and retained for their concrete
security, lifetime, CSP/configuration, seat/completeness, or evidence-limit
reason. Full site-by-site reasons and scan history:
[habit review](./quick-start-habit-review.md),
[complete scan](./habit-hooks-complete.log),
[81-finding scan](./habit-hooks-final.log), and
[original scan](./habit-hooks.log).

The earlier [independent working-tree review](./quick-start-independent-review.md)
is retained as history, not approval of this SHA. Its keyboard and expanded
narrow-view evidence gaps were corrected in the browser driver, and Audit
effects/recovery/delivery notes became visible as required. The local render
refactor preserved DOM/CSP bytes; [before HTML](./quick-start-before-refactor.html)
and [before policy](./quick-start-before-refactor-csp.txt) remain
available with the [quality note](./quick-start-quality-note.md).
The late live-helper change corrected a stale post-creation expectation and
then followed the real Open Connect setup link; it was a test-only fix, not a
production bug. The [tested overlay](./environment-gates/04-workos-live-overlay.patch)
and [identity](./environment-gates/04-workos-live-overlay.json)
retain that provenance. Earlier Node PATH/prerequisite/capture failures and
corrected retries remain recorded; none was removed by rewriting evidence.

<details>
<summary>Architecture assessment and comparison provenance</summary>

Comparison scope is the complete increment from
`feeaad4d5f04212f033366c232180be4bd40da4c` to
`f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e`; this PR is not a stack. The registry
contains 20 Mermaid blocks, all byte-for-byte unchanged. Prose now records the
new protected guide, Admin-first navigation, and creation landing. The full
[20-view inventory and affected-view assessment](./quick-start-policy-review.md)
is retained. Checked views include hosted containers/source owners, hosted
authentication L3, default sign-in landing, member-read/menu runtime prose,
shared Members/Audit components, collaboration, ownership, behavior, context,
and deployment. Existing diagrams retain their component, provider, store,
protocol, role, and lifetime relationships. No registry drawing was changed
merely to record review.

Pinned code/registry evidence:

- Registry [before](https://github.com/tomer-mayara/Thermus/blob/feeaad4d5f04212f033366c232180be4bd40da4c/architecture/components.md)
  / [after](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/architecture/components.md).
- Route authority and dispatch [before](https://github.com/tomer-mayara/Thermus/blob/feeaad4d5f04212f033366c232180be4bd40da4c/src/interfaces/web/account/account-routes.ts)
  / [after](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/src/interfaces/web/account/account-routes.ts).
- Composition [before](https://github.com/tomer-mayara/Thermus/blob/feeaad4d5f04212f033366c232180be4bd40da4c/src/app/application.ts)
  / [after](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/src/app/application.ts).
- Signup destination [before](https://github.com/tomer-mayara/Thermus/blob/feeaad4d5f04212f033366c232180be4bd40da4c/src/interfaces/web/auth/workos/workos-signup-routes.ts)
  / [after](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/src/interfaces/web/auth/workos/workos-signup-routes.ts).
- New guide [page](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/src/interfaces/web/account/quick-start-page.ts)
  and [canonical content](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/src/interfaces/web/account/quick-start-content.ts)
  are absent at base; route [acceptance](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/test/acceptance/auth/hosted-quick-start.test.ts)
  and [integration](https://github.com/tomer-mayara/Thermus/blob/f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e/test/integration/hosted-admin/account-routes-quick-start.test.ts)
  preserve access/configuration/failure evidence.

The authoritative architecture comparison remains in the main PR description;
it is not duplicated here. Its supplementary L3 uses one hosted Node-server L2
boundary with real app/web/organizations/workos owners, the browser as an L2
peer, and existing WorkOS as external context. Surviving calls stay neutral;
changed app/web meaning is amber with explicit labels. No page, method, or
field is misrepresented as a component. The four accompanying behavior notes
preserve checked selection before the redirect, current Admin/name authority,
trusted configured payload and copy safety, and method/cancellation/failure
outcomes. Later login, existing-access Continue, and normal workspace choices
retain their destination rules. No provider write, automatic enrollment,
datastore, C4/deployment boundary, or source-owner dependency is added.

Manager-reviewed versions and render history:
[v1 source](./quick-start-review/comparison-v1.mmd),
[v1 notes](./quick-start-review/comparison-notes-v1.md),
[v1 render](./quick-start-review/comparison-v1.png),
[v2 source](./quick-start-review/comparison-v2.mmd),
[v2 notes](./quick-start-review/comparison-notes-v2.md), and
[v2 render](./quick-start-review/comparison-v2.png).
Mermaid 11.12.0 with existing Playwright rendered near 800px. Manager feedback
approved content/relationships and found the v1 boundary title wrapping behind
the app node; v2 uses the short one-line boundary label and preserves the L2
scope in prose. The manager inspected v2 at normal width and approved it. The
final embedded-source byte-match check will be recorded before publication in
[final manager review](./final-manager-review.md). Versioned
notes retain their original precommit identity caveats; the pinned evidence
above and final main comparison establish the current revision.

L4 is omitted deliberately. The strongest changed callable contract is the new
browser `GET/HEAD quick-start` response and its use after confirmed creation.
The review question is whether the current selected organization's Admin
authority and trusted configuration determine every displayed/copied guide.
L3 plus the access, authorized-name read, payload, method, cancellation,
redirect, and replay notes answers it; a function drawing would repeat them.
The app-to-web MCP URL is direct composition, not another runtime capability.
No ADR is required by this change alone, and none was added. Required final
independent human architect approval remains pending.

</details>

Full notes and history remain linked above, including the
[final document/impact findings](./quick-start-review/findings-final.md)
and [gate failure/retry record](./environment-gates/summary.md).
