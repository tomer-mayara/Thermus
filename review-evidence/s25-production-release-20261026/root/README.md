# Slice 2.5 root application review evidence

This evidence supports [Thermus PR 260](https://github.com/tomer-mayara/Thermus/pull/260),
final head `2c7b8763025660d3fe3902af7a8433d2741fcb82`, against trusted base
`9f07c04bba0813358274212b21316165dc3e308b`. The manager reviewed the final
quality evidence and authorized this evidence publication. It is separate from
required current-head human code approval, Ready, merge, production deployment,
and production proof. No agent sign-off or notice approval replaces that human
approval. [Marketing review and actual publication](../marketing/README.md)
remain unchanged in this descendant evidence tree.

## Validation and final-head bridge

[Validation summary](validation-summary.json) and the full logs/JSON under
[validation](validation/) retain ordinary, type, portal, native and hosted
container results, complete hosted Docker build output, and earlier failure
history. These checks ran at code head
`618c29a94a80c94a9e0396ed07a8b727c10febde`.

- Ordinary: 5,122 emitted Node tests and 49 source portal tests; zero failures.
- Typecheck and user-portal build: passed.
- Native container: 11 tests; hosted final-image verification: 7 tests.
- The hosted Docker checked-build step ran with network disabled, completed,
  and was not cached. Its six fresh groups are 3,299, 29, 20, 1,155, 119 and 13.
  Other cached image layers are not represented as fresh test runs.

[Final-head bridge](final-head-bridge.json) proves only two documents differ
from that code head: the release checkpoint and the exact generated base metric
record. Every other tracked Git entry is identical, including source, tests,
locks, scripts and image build inputs. The record SHA-256 is
`d48943c55323c4a4f8f36fd11ea541917989db81a0d7eccc1d5be97f22440bdb`.
No broad suite or build was repeated for this documentation-only commit.
Counts describe emitted test groups, not an invented count of unique BDD cases.

[Guarded staging report](staging/shareable-report.md),
[shareable result](staging/shareable-result.json), and
[root readback handback](staging/readback-handback.json) record 29/29 passing
tests, all 48 deletes complete, zero failed or denied deletes, and all 48 exact
root-reader GETs returning 404. Their input hashes stayed stable and the reader
made no source/head/dist or production mutation. Only these three approved
shareable projections are retained; private originals and provider identifiers
are excluded. This staging proof does not claim the final candidate is deployed
in production.

## Complete quality reports

The authoritative final-head refresh is under [quality/final-head](quality/final-head/):

- [Final review](quality/final-head/final-review.md),
  [provenance](quality/final-head/provenance.json),
  [commands](quality/final-head/commands.json), and
  [full checker](quality/final-head/checker.json).
- [Full process report](quality/final-head/ast-report/process.md) and
  [machine report](quality/final-head/ast-report/process.json).
- [Review](quality/final-head/ast-report/review.md),
  [review JSON](quality/final-head/ast-report/review.json),
  [CRAP](quality/final-head/ast-report/crap.json), and
  [stamped impact](quality/final-head/ast-report/impact.json).
- [Base snapshot](quality/final-head/ast-report/snapshot-base.json),
  [head snapshot](quality/final-head/ast-report/snapshot.json),
  [unchanged normalized coverage](quality/final-head/ast-report/coverage.json),
  plus complete native HTML/data views and dependency context.

Final snapshots and standalone CRAP pass. The complete process exits 1 for the
retained completed Delta/Review goal misses; its CRAP and Architecture sections
pass. The final checker exits 0: T1 Team review, preliminary local eligibility,
no local blockers; Architecture: T0, no architecture fact. This does not itself
prove human approval or production release. The final process, snapshots, CRAP,
impact and checker bind the final head. Coverage stays honestly captured at the
code head and is reused through verified source/input/runtime/compiler identity;
its measurement metadata was not rewritten.

[Original code-head reports](quality/ast-report/) remain exact and are not
relabeled as final-head runs. Their
[full assessment](quality/final-quality-assessment.md),
[static assessment](quality/static-assessment.md),
[static provenance](quality/static-provenance.json), and
[independent source review](quality/final-independent-source-review.md) retain
all inherited finding reasons, policy answers, architecture facts, L4 rationale,
exceptions and N/A limits. All 15 Mermaid views and 49 public declarations remain
unchanged. No metric exception or baseline change is needed.

The final size notes are 463 production lines and 2,197 non-generated changed
lines. Complete frozen approved documents account for 436 production lines;
27 lines select, render and style them. The generated 863-line base record is
excluded from the checker count. No new production code entered the final
commit. Full global graphs, import/dependency context, function coverage and
retained findings remain in the reports rather than being reduced to a score.

Raw V8 coverage remains local: [raw coverage inventory](raw-coverage-inventory.json)
pins 695 files totaling 232,315,673 bytes by hash. These raw bytes are not
published. Full normalized reports and provenance are retained for meaningful
review. Local raw paths inside unchanged reports are not GitHub artifact links.
The original and final native HTML/data reports can be downloaded together;
GitHub's source viewer does not execute those interactive reports.

## Habit findings, retries and notice integration

[Final habit log](quality/final-head/habit-hooks.log) exits 1 with the same 47
findings. Its SHA-256 is
`994e76ce0a5d31082659e3ff3526cb6d194659f8dc9ad919057c0dc91cd953f2`.
The [47 individual dispositions](quality/habit-hooks-review-618c29a9.md) and
[machine record](quality/habit-hooks-review-618c29a9.json) therefore apply.
All are retained with reasons, no required source fix remains, and snooze is
empty. This is not a zero-finding hook pass. The
[first final hook environment failure](quality/final-head/habit-hooks-environment-failure.log)
is retained with the successful rerun's complete finding log; existing verified
dependencies were linked without installing or changing tracked files.

Original ordinary failure/retry, stopped process attempts, contaminated scan,
blocked checker, clean reruns and final command exit codes remain in the logs.
[Notice integration](notice-integration/) retains existing acceptance/unit RED
and GREEN runs, legacy HTML assertion failures and corrected oracles, final
focused/build results, and inspected synthetic-fixture screenshots. These local
screenshots prove no live provider state.

[Artifact manifest](artifact-manifest.json) pins every published file and each
exact copied input. [Secret scan](secret-scan.json) records the allowlist,
patterns, exclusions and limits. Full reports are copied without editing their
measured results. No credentials, provider IDs, private staging originals, raw
public HTML, raw coverage bytes, browser profiles or dependency tree is included.
Only this evidence directory was added. Root HEAD, primary index, tracked source,
and prior Marketing artifacts were preserved; no PR or cloud mutation occurred.
