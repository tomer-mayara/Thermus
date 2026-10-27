# Workspace picker: final release refresh

Candidate: `44753a72a7c1cecbf076e1448c26a4ae4b93a9f2`.
Actual base: `a421afc056ce3e400f2779c75683ea45270b96cb`.
Source check candidate: `e36e34c9304444312b52d76cc1c91aa365ccc719`.

Production is fixed. The owner-approved `feaddbde` is live and both actual roles
were verified. [Production proof](../workspace-selection-production/README.md)
records the exact commit, deploy, observations, public assets and limits.
The refreshed PR is a separate candidate and remains Draft. Its live staging
gate hit the WorkOS sandbox invitation-email quota, and approval of the current
head is still required before merge. No completed PR281 merge is claimed.

## Results and provenance

[Exact status](evidence-status.json), [isolated check commands](provenance.json),
[worker summary](summary.md), [manager sign-off](manager-review.md),
[tier report](pr-review.json), [current-head CI](ci-checks-final.json),
[metric process](metrics/process.md), and [machine metrics](metrics/) retain the
execution pins. The final commit adds only the immutable base metric record;
[the recursive input bridge](../workspace-selection/review/final-head-input-bridge-v4.json)
proves every other tracked object/mode matches the source check candidate.
All source and test files also match approved/deployed feaddbde.

- Ordinary suite: 5,372 compiled and 51 portal tests passed.
- Typecheck, portal build and hosted build passed. Hosted groups were
  3,468 + 31 + 20 + 1,194 + 139 + 13, with no failures or skips.
- Self-hosted container: 11/11. Full browser runtime: 83/83.
- Native Linux AMD64 hosted image: 7/7 in
  [GitHub Actions 40595080704](https://github.com/tomer-mayara/Thermus/actions/runs/40595080704).
  The workflow built and pushed the gated e36e34c9 image; its deploy job was
  skipped. Digest aa29d6206d7a0cbd6c4efabdcf1bce3255e4ed7c6fdb4346db6858fa87651f6e,
  154,747,373 compressed bytes. Logs and run metadata are retained here.
- Final hosted live: 22/29 passed, 7 failed, exit 1, no skipped/cancelled/todo.
  [Quota diagnosis](live-quota-review.md) distinguishes the six direct HTTP 429
  fixture failures from removal's inferred related invitation 503. The exact
  [removal journal](live-evidence/s25-02-mvr9tf6e-955a5c.jsonl) records cleanup.
  No immediate retry was made; the provider supplied no reset or Retry-After.
- Final process completes all four sections: Delta and Review retain existing
  MI goal misses; CRAP and Architecture pass. Standalone CRAP exits 0.
- Habit-hooks exits 1 with 21 comments and 2 test-length findings, all reviewed
  with individual reasons. Snooze stays empty. These are not zero-finding passes.
- Final checker exits 0, T2 Need architect, local preliminary eligibility
  eligible, no automatic blockers. The manager adds the live-gate and approval
  holds. No configured PR checks/statuses exist at current head.

Fresh coverage captures unit plus integration at e36e34c9, 196 files/scripts and
767 processes. Final metrics verify compatible reuse after the record-only
commit; old coverage was not reused across SO02's changed release inputs.
No acceptance/live coverage is claimed. Raw captures remain local.

## History and limits

The old approved feadd release had all selected gates, including 29 live cases,
green before approval and production deployment. The merge attempt was refused
because SO02 landed concurrently. Only .pr-impact.json conflicted; the picker
source and tests did not change. The combined release-tooling inputs required
fresh checks, which are kept here rather than relabelling earlier runs.
Prior BDD/TDD reds, the mobile label-readiness fix, old Node/port preparation
failures, macOS temporary-path image mount failure and successful retries remain
in the preceding workspace-selection and workspace-selection-refresh folders.
The new full staging failure is retained and is not called a product regression
or a pass. No assertion, timeout, skip, production setting or account was changed
to avoid the external quota.

Browser proof covers actual organization POST, one switch, Connect arrival,
persisted workspace, admin/user menu, keyboard, JS on/off and 320/1280px. It does
not claim picker-specific 200% text or long-name coverage. No-JS proves native
selection and Connect URL, not the JavaScript Connect rendering. Production
verification uses two existing accounts in their one existing workspace.
Separate PostgreSQL, Collector and live-search gates are N/A for the picker
increment; hosted-live contains its own removal/SQL journey. No extra standalone
npm run check was added. No source change or test reduction was made for quota.

All historical reports remain at their actual pins. The prior exact approval is
not extended to 44753a72. Production stays on its approved Git-backed manual
release; no image migration or automatic production deployment was performed.
