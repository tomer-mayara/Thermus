# Refined tabs — four-PR review

Review date: 26 October 2026. This review covers the Refined tabs plan and the
four existing UI candidates.
The [reviewed UI state](../design/organization-admin-plan.md#reviewed-ui-state)
records source candidates, parents, Ready/Draft state and holds. The maintained
PR comments pin final heads and complete evidence.
The [Members contract and wireframes](../design/organization-admin-plan.md#members-and-invitations--refined-tabs)
remain the approved behavior. This record changes no product requirement.

## Corrections and restack

The owner requested the fixes, rebase, updated PRs and merge after this review.
The local source candidates now form UI-01 → UI-02 → UI-03 → UI-04 on main
`9507e751215fec32748bf4e944f2393928e61cf5`. The linked plan table records the
source pins before quality-record updates; maintained PR comments own the final
heads, evidence and merge status. All four PRs were Draft at this preparation
point. No deployment is claimed. The original review below remains
history, with its original pins and evidence limits.

Main's latest change adds operator-probe scripts, Knip configuration and
documents. The recorded comparison verifies unchanged production source, tests,
dependencies, build configuration, public declarations and registry. Earlier
functional results keep their execution pins; the new scripts still require
fresh type/quality evidence and change the Docker checked-build context.

The UI-02 density acceptance failed before the CSS correction and then passed.
The short desktop rows measured 70.25, 70.25 and 60.25 pixels. Native semantics,
48-pixel action targets and natural growth for long or expanded rows remain.
UI-03 uses a semantic level-one heading for geometry and the exact fixture
count for route assertions. UI-04 preserves all 51 parent browser cases and
adds its 20 pending-invitation cases. The earlier combined 71-case browser group
and 130 focused HTTP/integration passes retain their original pins. Manager
source review found no new authority or protocol defect.

UI-01 native functional checks passed at their original `7acd90d4` pin and were
rebound through verified inputs to `4a761fec`. UI-02 native checks passed at
`82788735`, and UI-03 at `6ced8db3`. UI-03's Collector run first passed 7/10;
a private dependency copy with the same package bytes allowed the full retry
to pass 10/10. Both attempts and their environment provenance remain evidence.
UI-04 native checks are in progress at `07285735`. The latest main rebase does
not relabel these as new executions. Fresh type/quality pins, local Linux AMD64
image proof and final gate verification remain. The owner chose local image
checks; no Actions dispatch is planned.

The earlier UI-02 staging run at `2ec671eb` passed 22 of 29 cases: six failures
share the WorkOS sandbox invitation quota, and the separate reinvite HTTP 503
remains unexplained. Owned-resource cleanup completed. The required staging
groups and independent authorized current-head human approval remain holds.
No quota reset, provider fix, common failure cause or final live pass is inferred.

## Original review decision

Keep the four PRs and integrate them in this order: **UI-01 → UI-02 → UI-03 →
UI-04**. The current graph forks after UI-01: UI-02 and UI-03 are siblings, and
UI-04 starts from UI-03. No reviewed head contains all four increments. A combined
finish depends on their inclusion in one candidate, not on reaching ticket UI-04.

Source review has established no new authority or protocol defect. The bounded
browser diagnostic below found a P3 visual density mismatch in UI-02. Review also
found a concrete test migration at the future join and confirmed that the
branches need conflict resolution. Missing UI-02 presentation in the UI-04 branch
is the absent sibling increment. It does not show that UI-04 regressed that feature.

All four candidates require independent authorized owner/team approval for their
final T1 head. The manager's fresh GitHub read found no submitted reviews and no
inline review threads on any of the four PRs. Earlier Slice 2.5 approval does not
cover these candidates. Agent review and the local checker do not supply human
approval. No PR, branch, provider setting or production resource was changed in
this review.

## Original review evidence

Local ancestry checks confirmed the fork against the exact heads in the state
table. Observed main was `c42aa8237b06e46df5f8d3914af6f4151f729e1a`; the common
merge base was `57c99e2b892acea52bfc3a53aee61b5ae442bf46`. Main's delta from that
base contains decision records, the impact declaration and plan text, with no
runtime source change. This does not prove that a future merge will be clean or
that old evidence covers a new candidate.

The manager used `git merge-tree` to simulate combining UI-02 `e8f097da` with
UI-04 `3380afe6`. It reported conflicts in these 11 files:

- `.pr-impact.json`
- `docs/design/organization-admin-plan.md`
- `docs/design/portal-design.md`
- `docs/implementation/test-gate-policy.md`
- `src/interfaces/web/account/administration-pages.ts`
- `src/interfaces/web/account/members-style.ts`
- `test/acceptance/auth/hosted-invitations.test.ts`
- `test/acceptance/auth/hosted-member-removal-browser.runtime.ts`
- `test/acceptance/auth/hosted-members.test.ts`
- `test/acceptance/auth/hosted-workos-administration.test.ts`
- `test/integration/hosted-admin/account-routes-administration-pages.test.ts`

The simulation changed no checkout or index. It is integration evidence, not a
conflict fix or a test run. Resolve shared files by preserving each increment's
meaning; do not select one branch's whole file over the other.

The test review found two exact-heading assumptions in UI-03/04:

- [InvitationBrowser at UI-03 line 80](https://github.com/tomer-mayara/Thermus/blob/12d1a3c5b7cab197fa828ef89b7f650f918a7ea2/test/support/drivers/browser/invitation-browser.ts#L80)
  selects a heading with the exact name `Members` for geometry checks.
- [The route integration test at UI-03 line 20](https://github.com/tomer-mayara/Thermus/blob/12d1a3c5b7cab197fa828ef89b7f650f918a7ea2/test/integration/hosted-admin/account-routes-administration-pages.test.ts#L20)
  expects the invitation disclosure's heading to equal `Members`.

Both assumptions conflict with UI-02's approved `Members · N` heading when the
branches join. Migrate placement and geometry selectors to the semantic Members
heading, and preserve independent exact count assertions derived from each test
fixture. Do not replace all expectations with a loose match. Keep the separate
product-access count and its seat semantics. This is characterization migration
for existing approved behavior; it needs passing coverage, not an invented
product red step.

### Bounded layout diagnostic

The manager reviewed a browser probe of the actual UI-04 renderer at 861, 900 and
1024px, with JavaScript on/off, Invite closed/open and doubled text: 12 states.
It found no title/Invite overlap or horizontal overflow in those states. This is
a bounded layout result, not proof for every width or string.

A second probe used the exact UI-02 renderer, layout and style at `e8f097da`.
Only unchanged dependency import paths were remapped. At 1024 and 1280px, short
closed desktop member rows measured 118.39px, with the last row at 98.39px. Both
exceed the approved approximate 64–72px target. The manager independently checked
the probe, dependency diff, raw measurements and screenshot. This is a **P3
visual density/spec mismatch**, not a security issue. UI-02's existing browser
checks cover alignment and reflow but do not assert compact row height.

The local diagnostic record, probe, raw measurements and screenshots are under
`.cache/ui-stack-review/` (`layout-diagnostic.md`, `layout-probe.mjs` and
`layout-measurements.json`). They are local review evidence, not published
GitHub artifacts. No source change or actual integration was made by the probe.

## Prior validation and unresolved results

The results below are reported prior runs from the pinned PR evidence. This
review did not rerun them. Passing sibling results do not establish a passing
combined page.

- UI-01 reports the full ordinary suite, type/build, seven Members browser cases
  and both container gates passed. UI-02 reports its selected functional checks passed,
  including 19 browser cases and all 29 staging cases. Human approval remains a
  separate hold for both.
- UI-03 reports 38 browser cases and its selected offline functional checks passed. The
  full staging run passed 28 of 29 cases: the invitation lifecycle could not
  find the third invitation's Revoke form. A later diagnostic failed in setup
  with WorkOS HTTP 429, sandbox invitation-email quota reached. The later quota
  result does not establish the cause of the earlier missing form.
- UI-04 reports 58 browser cases and its selected offline functional checks passed. Staging
  passed 22 of 29 cases. Six failures reported the sandbox invitation-email quota
  during setup. Separately, the scoped removal journey received HTTP 503 rather
  than 303 when reinviting the removed user. That response does not establish
  its provider cause. The affected invitation and fresh-rejoin paths remain
  unverified.

Keep UI-03 and UI-04 Draft until their required staging groups pass. No quota
reset time, common cause, provider fix or final live success is inferred.
The prior Quality review reports retain explained metrics and habit-hooks
findings. The functional passes above do not mean every quality tool exited zero.

The immutable evidence and maintained PR comments are:

| Increment | Immutable prior evidence | Maintained comments |
| --- | --- | --- |
| UI-01 | [Evidence at `4c4b5e15`](https://github.com/tomer-mayara/Thermus/blob/4c4b5e15e4203548da6977fc0636334ef8fb8af4/review-evidence/ui-01/a017020ebe2448f5de6cc7d9cbb0700367fc80b1/README.md) | [Validation](https://github.com/tomer-mayara/Thermus/pull/263#issuecomment-6426553537), [Quality review](https://github.com/tomer-mayara/Thermus/pull/263#issuecomment-6426553900) |
| UI-02 | [Evidence at `1c18a275`](https://github.com/tomer-mayara/Thermus/blob/1c18a2751a1e44cfa53a9f8c05cf31857c7480c4/review-evidence/ui-02/e8f097dacad194fd3d540dee2fd79b52563e50c2/README.md) | [Validation](https://github.com/tomer-mayara/Thermus/pull/264#issuecomment-6427827431), [Quality review](https://github.com/tomer-mayara/Thermus/pull/264#issuecomment-6427827759) |
| UI-03 | [Evidence at `edbac660`](https://github.com/tomer-mayara/Thermus/blob/edbac6608e109dd11445d8a6cd98befbf0b018b5/review-evidence/ui-03/12d1a3c5b7cab197fa828ef89b7f650f918a7ea2/README.md) | [Validation](https://github.com/tomer-mayara/Thermus/pull/266#issuecomment-6430015599), [Quality review](https://github.com/tomer-mayara/Thermus/pull/266#issuecomment-6430026485) |
| UI-04 | [Evidence at `efef59fd`](https://github.com/tomer-mayara/Thermus/blob/efef59fd51f92ebe90eb655f2f8b29fe965debee/review-evidence/ui-04/3380afe663c6a2ef02a0adda525faccd6f5b726f/README.md) | [Validation](https://github.com/tomer-mayara/Thermus/pull/268#issuecomment-6430703769), [Quality review](https://github.com/tomer-mayara/Thermus/pull/268#issuecomment-6430704090) |

## Original review action list (superseded by corrections above)

1. Complete the [UI-02 density correction](../design/organization-admin-plan.md#ui-02-density-correction)
   under UI-02 after returning it to Draft. The plan owns its new BDD scenario,
   fixture-specific height bound and focused browser red/green/refactor steps.
2. Refresh each child against its integrated parent in the recommended order.
   Keep the four existing PRs. Before a fix, return a Ready PR to Draft. Resolve
   source, CSS, test, document and impact-declaration conflicts together. Migrate
   the two heading assumptions above when UI-02 joins UI-03. Refresh each exact
   head/base, review tier and evidence after a change.
3. Continue UI-03's staging work when invitation fixtures can be made. If the
   missing Revoke form repeats, inspect the third send response and pending data.
   Continue UI-04's required staging work and diagnose the reinvite 503 separately
   if it repeats. Keep existing cleanup and assertions. Record unavailable runs
   as deferred. Do not change provider settings or buy quota for this review.
4. On the candidate that includes all four increments, check the complete page
   under the [shared validation gate](../design/organization-admin-plan.md#ui-shared-final-validation-gate).
   Preserve both counts, section order, no-JavaScript forms, policy text, exact
   help bytes, fixed outcomes and safe recovery. Include both widths, both
   JavaScript modes, expanded content and Audit regressions. Select the full
   candidate's checks through the test-gate policy and shared-helper consumers;
   prior separate passes cannot replace required integration evidence.
5. Keep passing characterization for unchanged behavior and selector migrations.
   If a source defect is reproduced, first write its failing public acceptance
   case, then use focused failing test → minimum fix → green refactor steps.
   Do not force an unchanged case red. Obtain final-head human approval after
   required validation. No merge or deployment is part of this review.

These are completion actions for the existing tickets and their integration.
No new feature or verification-only ticket is needed.

## Plan cleanup and review limits

The earlier corrections table is now represented by the current contract and
ticket specifications: validate only the current increment and included work;
keep row count separate from product seats; migrate every presentation consumer;
set browser widths and JavaScript modes explicitly; use fresh independent cancel,
submit and failure scenarios; and keep stable section order with Members-scoped
body styles. The table no longer duplicates those rules. The initial red notes
are labelled as pre-implementation expectations. The implementation records and
immutable evidence retain the actual history.

The plan owns the detailed contract, wireframes, ticket specifications and shared
gate. Portal design gives the product summary and links to it. This record owns
the stack review findings. Historic implementation evidence stays in its existing
records. Full repository policy is not repeated here.

This review used local source, ancestry, documents, cached PR metadata and the
manager's read-only remote review checks, plus the bounded browser diagnostic
above. No new live, build or full test suite ran for this review. The browser
diagnostic is new evidence; the prior suite passes remain attributed to their
pinned records. Source inspection and a merge simulation do
not prove CSS geometry, native validation, provider behavior or a complete
integrated flow. Links to prior evidence identify exact immutable revisions;
they do not claim this review reran or independently verified every artifact.
The manager checked 198 local links/anchors and seven pinned source/evidence paths;
all resolve. `git diff --check` passed. A fresh
`habit-hooks --branch origin/codex/ui-03-invitation-disclosure` run exited 1 with
output identical to the prior UI-04 run: seven non-null assertions, 31 comments
and four oversized files. The existing
[retained-finding reasons](https://github.com/tomer-mayara/Thermus/blob/efef59fd51f92ebe90eb655f2f8b29fe965debee/review-evidence/ui-04/3380afe663c6a2ef02a0adda525faccd6f5b726f/validation/habit-dispositions.md)
still apply; the snooze file stays empty. This is not a clean tool pass.

Only these three Markdown documents changed in the original review turn. The existing Web,
organization and provider responsibilities still match the registry; no registry
or public declaration edit is needed. New production metrics and source tests
are not selected for these document edits. The source PRs keep their existing
validation and human-review holds. The original review made no commit or external mutation.
