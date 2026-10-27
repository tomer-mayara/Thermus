## Quality review

Candidate `4a761fecf5ed1719959d286f104ecd3884068478`; actual main/base/merge base `2b3ad13b9e2e61e206479b82e91359192cae1d00`.

**T1 Team review. Architecture: T0: no architecture fact.** The [final checker](EVIDENCE_ROOT/ast-report/check.json) has only `read_paths: docs/implementation/test-gate-policy.md`, no architecture facts, unresolved questions or mechanical blockers. The inventory describes browser cases without changing commands, gate selection or authority; the semantic policy flag stays false. All classification flags in the [stamped declaration](EVIDENCE_ROOT/ast-report/impact.json) are false. No de-escalation or metric exception is used.

**Overall merge status: blocked.** Required Linux AMD64 image proof and independent authorized human approval of this head/scope remain outstanding. Checker eligibility is preliminary. Manager source, architecture and quality evidence review is complete for this head/base; final gate verification remains pending. Agent and manager review do not supply human approval.

### Metrics and retained findings

The stable final process completes all four sections: Delta and Review report goal misses; CRAP and Architecture pass. Process exit 1 is not a clean tool pass or an uncompleted section. [Full process](EVIDENCE_ROOT/ast-report/process.md), [JSON](EVIDENCE_ROOT/ast-report/process.json), [review](EVIDENCE_ROOT/ast-report/review.json), [CRAP](EVIDENCE_ROOT/ast-report/crap.json), [base snapshot](EVIDENCE_ROOT/ast-report/snapshot-base.json), [head snapshot](EVIDENCE_ROOT/ast-report/snapshot.json).

- Existing `administration-pages.ts` MI 61.3121→61.2513 (drop 0.0607): retain cohesive page markup, escaping and trusted-name handoff. It adds no decision paths. Splitting adjacent protected HTML to improve the score would add indirection without reducing decisions.
- Existing `members-page-layout.ts` MI 81.0010→80.3696 (drop 0.6314): navigation and byte-derived CSP hashes keep one owner. The single added path is the optional escaped display name. Neither existing file drops five points; no new low-MI file requires an exception.
- `members-style.ts` is static CSS with zero functions. No supported raw MI/function CRAP applies. Real browser geometry, focus, contrast and target checks provide the relevant proof.
- High browser-test MI finding 33.3685→28.1507: retain fresh viewport/JavaScript, keyboard/focus, text-resize and Audit tablet journeys in the selected acceptance gate. Protocol mechanics already have focused drivers. More generic scenario machinery would hide required observable steps. Tests have no production MI goal.
- Low Halstead volume estimates: `hosted-members.test.ts` 1.2950→1.8036 and page integration 2.5646→2.8344. Public-route assertions cover trusted escaped workspace naming and shared shell behavior; integration checks the trusted handoff and absence of extra provider reads. These belong at the existing public seams; the volume estimate is not an observed bug. Retain both findings for those reasons.

Required function goals pass under verified integration coverage: `membersPageLayout` CRAP 8.000000512 at 99.8%; `membersPage` 3.000072 at 98%; mechanically new anonymous callback 1 at 100%. No required identity or assessment is unknown. Unchanged functions keep the reason “unchanged by this PR.” Base CRAP using head coverage is an estimate. Global integration-only coverage leaves unrelated unknown functions; no complete whole-system coverage claim is made.

The final process writes the immutable [base metric record](https://github.com/tomer-mayara/Thermus/blob/4a761fecf5ed1719959d286f104ecd3884068478/docs/metrics/2026-10-26-2b3ad13b.json), committed unchanged with SHA-256 `c8667245834f54c60ddbb98398fdaaa8fc5317d4e61ab2229c285524adace248`. Historical gaps remain in the full report. Discarded detached reports are archived and excluded as candidate proof.

**Habit-hooks:** final exit 0, with two retained non-essential-comment findings: `administration-pages.ts:25` states complete-read failure atomicity; `members-page-layout.ts:13` states CSS/CSP hash ownership. Both explain non-obvious guarantees. [Final output](EVIDENCE_ROOT/validation/4a761fec-habit-hooks.log). Snooze remains empty; no suppression is added.

**Checker notes:** “49 public modules, 0 snapshots changed” confirms unchanged declarations. The limited API compiler filters 33 diagnostics in two unlisted modules under its policy; the full typecheck passed at `639827bc`, with identical final inputs. [API log](EVIDENCE_ROOT/validation/4a761fec-api.log). The preliminary-eligibility note remains relevant because image proof, required final gate verification and human approval are pending.

<details><summary>Architecture and pinned source-review provenance</summary>

[Before registry](https://github.com/tomer-mayara/Thermus/blob/2b3ad13b9e2e61e206479b82e91359192cae1d00/architecture/components.md) · [after registry](https://github.com/tomer-mayara/Thermus/blob/4a761fecf5ed1719959d286f104ecd3884068478/architecture/components.md) · [final inventory](EVIDENCE_ROOT/review/current-increment-inventory.json) · [independent source review](EVIDENCE_ROOT/review/source-review.md) · [document review](EVIDENCE_ROOT/review/docs-review.md) · [final input comparison](EVIDENCE_ROOT/validation/4a761fec-input-equivalence.json).

All 15 registry views and prose remain byte-identical, hash `be078921661f9b8a1853e9987d2c6849e972737f621c54b1368eda0c1d283510`. Checked context, hosted containers, source owners, authentication, member reads/removal, Audit settings/delivery, resource ownership and deployment. Web passes the already-read trusted name to its private layout, escapes it and retains ordinary navigation. Audit gets no new lookup. Permissions, protected forms, mutations, sessions/recovery, product seats, approved help and byte-derived CSP hashes remain at their existing owners. No component/edge, public declaration, store or deployment boundary changes.

Production architecture is unchanged; no L3 comparison drawing is needed. The strongest private callable change is the optional layout display-name argument. Existing owner views plus trust/escaping/Audit-caller notes answer the review question, so L4 adds no useful detail. Test helper APIs do not establish production architecture.

The metrics graph retains unresolved `src/interfaces/user-portal/main.ts → ./style.css` at both revisions. It withholds edge/cycle comparisons requiring a complete graph. Manual unchanged-import/registry review supports the bounded no-new-edge assessment, not a complete global dependency proof.

Independent source review signed off original `7acd90d4`, rebound to `639827bc`, and refreshed sign-off for final `4a761fec` through equal source/test/registry/public-surface trees. Manager source/architecture/quality confirmation is complete; required final gate verification remains pending. The refreshed inventory and independent source review now pin `4a761fec`, UI-02 `82788735`, UI-03 `6ced8db3` and UI-04 `07285735`; prior inventory/source-review bytes remain under historical names in this bundle. Root published `a9629766` ancestry to `codex/ui-stack-review-source-a9629766`, verified the remote head and GitHub Contents reads at 7acd/2ec/2189/a962, and recorded [publication proof](EVIDENCE_ROOT/review/source-review-publication.json). Original source audit links remain unchanged; their remote-ancestry hold is resolved.

</details>

[Prior immutable findings and red/green history](https://github.com/tomer-mayara/Thermus/blob/4c4b5e15e4203548da6977fc0636334ef8fb8af4/review-evidence/ui-01/a017020ebe2448f5de6cc7d9cbb0700367fc80b1/README.md) · [prior PR bodies/history](EVIDENCE_ROOT/review/pr-before-263.json). No earlier Slice 2.5 approval covers these UI candidates.
