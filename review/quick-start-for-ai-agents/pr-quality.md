## Quality review

Candidate: [`8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0`](https://github.com/tomer-mayara/Thermus/commit/8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0).
Trusted main merge base: [`21458b0d18cc4f9efd3a59f6361a86f1acdc317c`](https://github.com/tomer-mayara/Thermus/commit/21458b0d18cc4f9efd3a59f6361a86f1acdc317c).
This is a new increment against main, not a stack or a review-tier de-escalation.

**T0 Auto merge — `T0: no architecture fact`.** The final-head checker reports
preliminary eligibility `eligible`, blockers `[]`, and no architecture facts,
tier reasons, policy questions, declared/undeclared facts, or surface differences.
No human approval is required for eligible T0. **Overall merge is eligible:**
all selected checks passed and the manager reviewed the complete candidate.
The first image gate failed; the one authorized unchanged retry passed all
seven final image cases. Both attempts remain retained. The manager's actual
checks and review address the preliminary-eligibility note.

The checker's single informational item is **53 public modules, 0 snapshots
changed**. Disposition: the declared public surface remains stable, matching
this internal wording increment; no declaration delta is inferred from UI
strings. Its note that local eligibility is preliminary is honored by the
[final manager sign-off](./manager-review.md). See [checker JSON](./checker.json).

Checker stderr records **33 compiler errors in two files outside the listed
public surface were ignored**. This limits declaration verification to that
surface; it is not proof that every compiler configuration has no diagnostic.
The independently run full `npm run typecheck` passed. Retain the
[stderr record](./checker.log) without claiming its warning is
resolved or weakening the separate typecheck.

### Impact and independent source review

All flags in the [committed impact declaration](https://github.com/tomer-mayara/Thermus/blob/8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0/.pr-impact.json)
are false and `modelUpdated` is false. The [independent review](./independent-review.md)
found no confirmed defect. The exact approved heading and full paragraph flow
from shared content to the Admin page and copied Markdown; the canonical guide
matches after line wrapping and retains its existing heading suffix. Required
services, external-enforcement limits, provider links, and scope/fallback notes
remain. No new test was added merely to mirror the two strings.

Routes, Admin authority, selected-organization/name, configured links, escaping
and URL validation, provider operations, callable contracts, dependencies,
composition, data, and deployment relationships retain their rules. No
protected policy/security/client-contract/deploy/exception file changes. The
final commit adds only the immutable base metric record after `b0ec502e`; no
runtime/test/build input changes in that commit. The authorized later deploy
uses the existing Render Git service, not an image-runtime cutover or a new
provider/legal/migration setting.

### Final metrics and retained MI reason

Final process: **Delta goal miss; Review passed; CRAP passed; Architecture
passed**. The process exits 1 for the retained goal miss, not a failed analysis.
Base and head content-file MI are both **53.95041254701023**, below the default
85 goal. The unchanged low score is not relabelled a pass. Retained reason:
this one canonical owner keeps approved prose/provider data with full Markdown
assembly, URL validation, and Markdown escaping, so display and copy do not
drift. The increment changes two data strings and no function structure or
validation decision. A mechanical prose/guard split would distribute the same
content/link contract without a separate invariant or lifetime.

The final review reports **0 new critical issues and 0 other regressions**;
there are no new high findings to retain. CRAP lists **seven unchanged functions,
all at 100% captured coverage**, with scores 1–6: URL validation 6, full guide
assembly 2, and the remaining mapping/escaping/link functions 1. Their retained
classification is “unchanged by this PR”; no new function or unknown assessment
is hidden. These numeric results do not establish full client or native
clipboard coverage.

No new metric exception is requested or used by the checker. This file exists
at base; modified-file MI handling does not consult the new-file exception
lookup. Its existing unexpired entry therefore adds no T1 reason, and the
checker reasons are actually empty. The generated immutable
[base record](https://github.com/tomer-mayara/Thermus/blob/8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0/docs/metrics/2026-10-28-21458b0d.json)
was committed without editing historical records or the metrics baseline.

Full reports: [process](./process.md),
[process JSON](./process.json),
[command/exit](./process-final-command.json),
[review](./review.md), [review JSON](./review.json),
[CRAP](./crap.md), [CRAP JSON](./crap.json),
[base snapshot](./snapshot-base.json),
[head snapshot](./snapshot.json).
The full architecture report retains its global dependency and historical
measurement context; no inherited full-stack table is repeated here.

Coverage is verified unit + integration capture at
`b0ec502e8a7362bd03d82012b80362f7960c4430`: 241 files, 813 processes. It retains
source fingerprint `cb976e59626ce670ffc2271d65164be04bc9dff30ed404172f6e52979a1ae857`
and input fingerprint `14a19dd48dcb1de251bc2acd827b5578df051af886a188d735c21bf1fe24e125`.
The final-head process accepts compatibility; the coverage commit and data were
not restamped. Exact captured suites/runtime/compiler and source/build identity
are in [coverage](./coverage.json) and Validation. Head-derived
base CRAP remains an estimate, not measured base coverage.

Habit-hooks ran `--branch origin/main --no-snooze`: **exit 0, no findings**;
snooze is `[]`. The prior candidates' finding counts are not reused. See
[command](./habit-hooks-command.json) and
[log](./habit-hooks-command.log).

### Failure, retry, and operational limits

The required AMD64 image failed in an unchanged refused-port JWKS case:
expected `TypeError`, observed `JWKSTimeout` with a 100ms setting and about
432ms elapsed. Its inner unit/portal groups passed; integration had 1,218 pass
and one fail, stopping later build/runtime proofs. An emulated/shared-load
timing race is a hypothesis, not a proven root cause. The manager reviewed the
source and authorized one full unchanged retry only after heavy primary work
completed. No source, deadline, assertion, or production/configuration input
was changed. Attempt 2 passed the entire gate, including the same refused-port
assertion in 12.433833 ms. Retain [attempt 1](./environment-gates/attempt-1/03-hosted-container-failure.md)
and its full logs. This is a real failed gate, separate from the snapshot
wrapper's metadata/data-path recovery described in Validation.

Native gates' [754-input comparison](./environment-gates/native-provisional-candidate-comparison.json)
matched `b0ec502e`; the isolated checkout was archived. The final commit adds
only the immutable metric record. The manager's
[final input binding](./final-input-binding.json) confirms all
754 frozen inputs unchanged at `8eb8d345`; [initial manager review](./manager-review-initial.md)
records implementation review and the historical image hold. Attempt 2 passed
all inner 3,693 + 39 + 21 + 1,219 + 189 + 13 checks and 7 final runtime cases.
The [image comparison](./environment-gates/03-hosted-container-final-comparison.json)
confirms the frozen inputs match the final candidate. The
[final manager sign-off](./manager-review.md) resolves the hold.
No earlier candidate's results substitute for these fresh runs.

The current production browser is denied guide access and offers one
already-selected organization; no authority/selection changed and the temporary
tab was closed. Positive production Admin UI and native clipboard behavior are
unverified. Exact deployed-revision, health/public access, and fresh local Admin
screenshots/copy checks define the available verification scope. See the
[access limit](./browser-access-limit.md). Verification preserves
the current access boundary.

<details>
<summary>Architecture assessment and pinned provenance</summary>

The complete registry and all 20 Mermaid blocks are byte-identical to base.
Hosted authentication/components, member-read/menu, ownership, source-owner
mapping, context/container, and deployment views retain their meanings. Web
continues to own the protected page and canonical guide; runtime collaborators,
protocols, access boundaries, and lifetimes remain.

Pinned evidence: registry [before](https://github.com/tomer-mayara/Thermus/blob/21458b0d18cc4f9efd3a59f6361a86f1acdc317c/architecture/components.md)
/ [after](https://github.com/tomer-mayara/Thermus/blob/8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0/architecture/components.md);
content [before](https://github.com/tomer-mayara/Thermus/blob/21458b0d18cc4f9efd3a59f6361a86f1acdc317c/src/interfaces/web/account/quick-start-content.ts)
/ [after](https://github.com/tomer-mayara/Thermus/blob/8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0/src/interfaces/web/account/quick-start-content.ts);
guide [before](https://github.com/tomer-mayara/Thermus/blob/21458b0d18cc4f9efd3a59f6361a86f1acdc317c/docs/design/admin-quick-start/guide.md)
/ [after](https://github.com/tomer-mayara/Thermus/blob/8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0/docs/design/admin-quick-start/guide.md).

No component, dependency, public module, callable contract, trust rule, or
deployment relationship changes. No registry edit, comparison drawing/render,
L4 detail, or decision record is needed. The immutable base record is metric
history, not a runtime change. The manager reviewed all four changed files,
source and image input comparisons, screenshots, independent review, and the
actual final execution reports before signing off.

</details>

Versioned prior report sources: [main](./history/before-final-8eb8d345/pr-body.md),
[Validation](./history/before-final-8eb8d345/pr-validation.md), and
[Quality](./history/before-final-8eb8d345/pr-quality.md).
The same two maintained comments retain the completed review, both image
attempts, and manager sign-off. Publication is read back before Ready. Merge
and deployment completion will be recorded after those actions succeed.
