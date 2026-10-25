# Final quality review

Candidate: `0ff3f6cdde5be4124df0ed2ab002844d5db1c502`. Actual parent: `122d65bf1f035fc195792cc083732aa05c423c58`. Complete-candidate main comparison: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.

## Decision and guarantees

**T2 Need architect.** T2: 1 public module added; declarations changed in 3 public modules; 2 registry views added, 5 registry views edited.
The checker reports local eligibility `eligible`, with no blocker. Overall merge
remains blocked by the unmerged parent PR #251 and missing independent authorized
human architect approval of this head. Agent review, the owner-account label, and
local eligibility are not human approval. No de-escalation or merge occurred.

The flags are deployment, component, internalInterface, sensitiveBehavior, and
policy. Existing owners gain removal and receipt responsibilities; the same SQL
runtime now supports a recovery hold. No new container, provider, npm dependency,
source component pair, or external browser/client operation is added. No ADR is
required by an authorized decision maker for this implementation of the plan.

All tier reasons are retained in [the checker report](metrics/pr-review.json).
The three public declaration diffs, added public store module, and two added/five
edited registry views select T2. The declaration's three architect flags also
select T2. T1 reasons remain: review-rules policy path, exceptions and test-gate
read paths, three used MI exceptions, and sensitiveBehavior/policy flags.

Policy answers:

- Checks and decision makers: register the new public contract and add six-file
  removal/settings coverage to the existing PostgreSQL gate. No check or approval
  requirement is weakened. Three new-file MI exceptions expire 24 December 2026;
  human review remains required. The snooze file stays empty.
- Client/user/operator promise: no browser removal action exists yet. The internal
  method returns bounded refusal/uncertainty results. A server-owned 30-second
  lifetime and optional read stop signal reach WorkOS subreads. Operator setup
  needs the additive table migration before activation, with no new key, env var,
  pool, or paid service. Never clear an unknown hold from elapsed time or a current
  Members read. No MFA requirement or MCP restriction is added.

## Metric findings and retained reasons

The final process completed all four sections. Delta and Review report goal
misses; CRAP reports one unmeasured mapping; Architecture passes. These are valid
reports, not tool failures. The trusted checker applies the narrower incremental
rules and approved exception mechanism. Full reports remain unchanged.

| Source file | Parent MI → candidate MI | Disposition |
| --- | --- | --- |
| membership-removal.ts | new → 43.6799 | Exception minimum 43.67. One ordered owner keeps admission, current checks, one dispatch, and exact completion/readback; largest function has nine paths. Splitting these phases into more owners would hide the no-replay rule. |
| membership-removal-checks.ts | new → 56.8902 | Exception minimum 56.89. Keep actor, target snapshot, all grants, complete bounded pages, duplicate reconciliation, and last-Admin calculation together; largest function has nine paths. |
| membership-removal-lifetime.ts | new → 73.5001 | Exception minimum 73.50. One owner keeps timer, monotonic check, admission uncertainty, stop signal, and one result; largest function has four paths. |
| pg-destination-settings-store.ts | 53.6418 → 46.3157 | Keep three short atomic removal statements and row conversion on the existing bounded runtime. SQL clients are released before HTTP. A second adapter/pool would duplicate lifetime and obscure shared admission. Existing-file MI drop is an explicit note, not a new-file exception; the inherited MI bound 54 is not used to waive this drop. |
| workos-organizations.ts | 48.1109 → 47.0842 | Keep one optional guard around each existing remote read. Required propagation is visible at calls; a second removal directory or generic retry layer would duplicate provider mapping. Main's 53.4834 → 47.0842 report includes parent work; that full-stack finding remains disclosed. |
| organization-administration.ts | 64.8422 → 61.9500 | This existing facade owns its removal service and safe recorder; request/actor copies precede awaits. No browser caller is added. |
| directory-reads.ts | 77.7968 → 77.6896 | Reuse complete paging with a fixed optional page bound; repeated cursors and exhaustion reject the full read. |
| application.ts | 54.7532 → 54.8063 | Keep assembly and close order in the existing owner. The 31-line composition note is retained to show removal-before-SQL cleanup and independent MCP cleanup together. |
| logging-storage.ts | 75.9387 → 75.1455 | Supply the same concrete runtime store in both roles. Existing optional loading/failure isolation remains in one small composition function. |
| change-records.ts | 89.2248 → 89.2248 | Same safe sink; extend outcome vocabulary without changing invitation results. |

Type-only directory/store contracts have no executable MI; that is N/A, not zero.
[Coordinator inspection](review/coordinator-quality.md) preserves simplification
review, per-function paths, bounds, expiry, and pre-type-move history.

All measured new/changed functions meet their CRAP goals; the maximum is 9.
`composeLoggingStorage` has one path. Its emitted function has observations, but
no exact source identity, so its mapped share remains unknown. Do not turn those
observations into a measured percentage. Its conservative CRAP interval is [1, 2],
which the checker proves below the changed-function goal. No CRAP exception is
used. Coverage comes from the already-selected unit, integration, and acceptance
suites. The first unit-only report's two unmeasured callbacks is retained as
history; the combined capture resolves those. No coverage report was edited.

The full-stack Review report also retains one high test-file MI finding for
`test/integration/auth/workos-connection.test.ts`, unchanged by this increment.
Its parent proof preserves current SDK timeout, management evidence, and exact
write-count assertions in one integration file. It has no production MI goal.
Other retained findings: rule-file total complexity 42 is spread across focused
functions with at most nine paths; the composition method's 31 lines keep close
order visible; declaration/pg efferent-coupling notes count type contracts on an
existing allowed owner pair; hosted outage test volume grows to check both store
roles while MCP/health remain usable. None adds a forbidden edge or cycle.

Every informational note has a reason:

- 49 public modules, three snapshots changed and one added: the new request/result/
  store types are directly visible; existing snapshot diffs match the behavior.
- index.ts, administration-overviews.ts (both affected imports), and customer-roles.ts
  keep identical public declarations. Existing entry, overview, and role callers
  retain their behavior and omit the optional read signal.
- 2449 total lines exceed the 1,500 note threshold; production
  is 384 lines, below 400. Most scope is acceptance/TDD
  proof, the additive migration, declaration snapshots, and the required registry
  comparison/readability corrections. Keep one cohesive removal ticket.
- The pg MI drop and the four high findings on changed production files have the
  specific reasons above. The lifetime class-level finding displays 70 while its
  file MI is 73.5001; these are different tool measures, not rounding evidence.

## Habit hooks and manager review

The final hook run exits 1 with 320 retained findings: one complexity, four
parameter-count, 302 comment, and 13 file-size findings. The unchanged counts
match the reviewed complete candidate. [Dispositions](review/habit-dispositions.md)
and [exact inventory](review/habit-inventory.json) account for every finding and
all 43 files. Explicit per-operation arguments keep state off the shared service;
contract comments explain uncertainty/ownership; cohesive suites remain together.
The stale ChangeOutcome comment was corrected in fb9b0fd0. No unresolved hook
correction remains, and no finding was snoozed.

The manager reviewed all delegated code, the real-provider stop correction,
SQL/crash proofs, and final diagrams. The independent review's P2 stop-propagation
finding is fixed. [Review](review/independent-audit.md), [store review](review/store-review.md),
and [manager architecture sign-off](architecture/manager-review.md) retain the work.
This agent sign-off does not replace human architect approval.

<details><summary>Architecture provenance and L4 decision</summary>

[Before registry](https://github.com/tomer-mayara/Thermus/blob/122d65bf1f035fc195792cc083732aa05c423c58/architecture/components.md) and
[after registry](https://github.com/tomer-mayara/Thermus/blob/0ff3f6cdde5be4124df0ed2ab002844d5db1c502/architecture/components.md) are pinned.
The final registry hash is unchanged from the eight reviewed 800px renders;
`architecture/final-provenance.json` pins each source and render. The inventory
covers all 15 views against the parent's 13. Manual interpretation preserves eight
old blocks, updates four, splits the deployment block in two, and adds removal;
the checker canonically pairs these as two additions and five edits.

The main PR comparison is the single authoritative `comparison-v2.mmd` derived
from code/registry prose. It shows four actual L3 owners in the hosted Node server,
with PostgreSQL and WorkOS as supporting peers. Runtime org→store calls differ
from the existing audit→org type edge. Four adjacent notes cover current authority,
exact target/receipt rules, phases, no replay, and lifetime limits. L4 is omitted
because those notes plus L3 answer the strongest changed removeMember/store/read-
signal contract questions without turning private steps into components.

Initial broad diagrams failed normal-width readability. Shorter labels, edge order,
and separate deployment views fixed that feedback. Eight final images were rendered
and manager-inspected at 800px; seven embedded sources matched byte-for-byte.
No deployment or migration is claimed. Superseded proposals and renders stay as
history. No source/component/container topology was changed merely by drawing it.

</details>
