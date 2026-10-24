# Compute the review tier

`check.ts` classifies a committed pull request candidate using the trusted
merge-base rules, the architecture facts that it establishes from the merge
base and HEAD, and the candidate's declared facts. It reports one review tier
and a separate local eligibility result. Follow [AGENTS.md](../../AGENTS.md),
the [playbook](../../docs/implementation/pr-review-playbook.md), and the
[test gate policy](../../docs/implementation/test-gate-policy.md). The
[design record](../../docs/design/pr-review-architecture-facts.md) explains why
facts select the tier.

| Tier | Required review |
| --- | --- |
| T0 Auto merge | No required human review. All applicable local checks and merge conditions must pass. |
| T1 Team review | An independent authorized team member approves the candidate. |
| T2 Need architect | An independent authorized architect approves the candidate and its architecture impact. |

The highest matching tier applies. A failure blocks merge without replacing the
tier. The report retains every reason. `eligible` means the local evidence is
complete and passes this checker; it does not prove
completed local checks, current human approval, absence of a hold, or merge
authority. The manager or Delamain session verifies those conditions.

## Run the check

Commit the candidate first. When the exports of a public module changed,
include current declaration snapshots, as "Declaration snapshots" below says.
Update the committed `.pr-impact.json` declaration described below.
Generate its local input for HEAD and the merge base. For a source-free change that needs no metrics under the trusted
policy, run:

```sh
pnpm exec node script/pr-review/check.ts --base origin/main --repo tomer-mayara/Thermus --impact ast-report/impact.json
```

For changed production code, collect the metrics with the coverage selection
from AGENTS.md, then supply their files:

```sh
pnpm exec node script/code-quality/ast-metrics-snapshot.ts --base origin/main
pnpm exec node script/code-quality/ast-metrics-snapshot.ts
pnpm exec node script/code-quality/ast-metrics-process.ts --base origin/main --json ast-report/process.json
pnpm exec node script/code-quality/ast-metrics-crap.ts --base origin/main --json ast-report/crap.json
pnpm exec node script/pr-review/check.ts --base origin/main --repo tomer-mayara/Thermus \
  --impact ast-report/impact.json \
  --base-snapshot ast-report/snapshot-base.json --head-snapshot ast-report/snapshot.json \
  --crap ast-report/crap.json --process ast-report/process.json --review ast-report/review.json
```

The process and CRAP commands can exit 1 for a reported metric goal miss. Read
the report; the checker applies the goals and permitted exceptions. A command
or tool failure is not a metric exception. Do not create or edit metric reports
to make a check pass.

A stacked pull request takes its tier from the increment against its actual
parent. Give the parent branch as `--base` to the check, for example
`--base origin/<parent-branch>`. Stamp the impact declaration, take the MI
snapshot of the merge base, and write the CRAP rows with the same ref; the
checker stops on an input of another merge base. The metrics process keeps
`origin/main`. Validation keeps the complete candidate against main visible:
its test selection covers every change against `origin/main`.

```text
Usage: node script/pr-review/check.ts [--base REF] [--rules PATH] [--repo OWNER/NAME] [--impact FILE] [--allow-dirty] [--base-snapshot FILE --head-snapshot FILE] [--crap FILE] [--process FILE --review FILE] [--json] [--help]

Options:
  --base REF            Comparison ref (default: origin/main)
  --rules PATH          Repository rules (default: docs/implementation/pr-review-rules.yaml)
  --repo OWNER/NAME     Repository for the printed label command
  --impact FILE         Architecture impact JSON for this candidate and merge base
  --allow-dirty         Inspect committed HEAD alone despite uncommitted files
  --base-snapshot FILE  MI snapshot of the merge base (give both snapshots)
  --head-snapshot FILE  MI snapshot of HEAD
  --crap FILE           CRAP rows of HEAD compared with the merge base
  --process FILE        Final metrics stage outcomes (give --review too)
  --review FILE         Final metrics review findings
  --json                Print one JSON object instead of Markdown
  --help, -h            Show this help

```

Exit 0 means classification completed, including a `blocked` result. Exit 1
means the checker could not run: fix the named input or tool problem. A caller
must inspect `eligibility` and `blockers`; exit 0 alone never authorizes merge.

## Declaration snapshots

Each module that `public_surface` lists has a committed declaration snapshot
under the folder that `public_surface.snapshots` names, `docs/api-surface/`. The
snapshot of `src/a/b.ts` is `docs/api-surface/src/a/b.d.ts`. `api-surface.ts`
writes and verifies the snapshots:

```sh
pnpm exec node script/pr-review/api-surface.ts
pnpm exec node script/pr-review/api-surface.ts --check
```

The first command emits the declarations of `src/` with the installed compiler
and `tsconfig.api-surface.json` (`tsc --declaration --emitDeclarationOnly`,
without the browser portal). It takes a few seconds and gives the same bytes
for the same source. It writes the snapshot of each listed module and
deletes each declaration file under the folder that no listed module owns. A
compiler error in a listed module stops the command; errors in other files are
counted on stderr and ignored. `--check` writes nothing, lists each stale,
missing, and orphan file, and exits 1 when it finds one. Run the first command
when the exports of a public module change, or when a module joins or leaves
`public_surface`. Commit the result with the candidate.

The checker regenerates the snapshots of HEAD and compares them with the
committed files. These outcomes block merge:

- `public_surface.snapshots.stale`: a committed snapshot differs from the
  regenerated one.
- `public_surface.snapshots.missing`: a listed module has no committed
  snapshot.
- `public_surface.snapshots.orphan`: a committed file under the folder has no
  listed module.
- `public_surface.snapshots.unverified`: the checker could not regenerate the
  snapshots of HEAD, because the working tree differs from HEAD or the
  compiler failed.

The checker reads the committed snapshots of the merge base from git, so the
base needs no second compile. A snapshot that differs between the merge base
and HEAD is fact d, with its unified diff. An added or a removed snapshot is a
note; the added public module is fact c. When the merge base has no snapshots,
the report says that it made no declaration comparison.

## Architecture facts

The rules of the merge base select the facts. The checker compares the rules
and the files of the two revisions:

| Fact | Reason key | Outcome |
| --- | --- | --- |
| a. `dependency_graph.components` differs: an ID is added or removed, or its roots or files change | `architecture.component_set` | T2 Need architect |
| b. An allowed edge is added, or a type edge becomes runtime | `architecture.dependency_added` | T2 Need architect |
| c. A module joins `public_surface` | `architecture.public_module_added` | T2 Need architect |
| d. The declaration snapshot of a public module differs | `architecture.declarations_changed` | T2 Need architect |
| e. A Mermaid block of `architecture/components.md` is added, removed, or edited | `architecture.registry_view_changed` | T2 Need architect |
| f. An architect flag of the impact declaration | `impact.<flag>` | T2 Need architect |
| g. A file is added under `architecture/decisions/` | `architecture.decision_record` | T2 Need architect |
| A fact a to e or g while every architect flag is false | `architecture.undeclared_fact` | blocked |
| A component gains an npm package or a Node builtin in the rules | `dependencies.external_import_added` | T1 Team review |
| `package.json` gains or loses a dependency key | `dependencies.keys_changed` | T1 Team review |

The registry comparison reads the fenced Mermaid blocks only; prose between
them is no fact, and views in another order alone are a note. The manifest
comparison reads `dependencies`, `devDependencies`, `optionalDependencies`,
`peerDependencies`, and the `pnpm` block. A changed version and a changed
lockfile alone are notes.

The report gains three parts:

- The `Architecture:` line (`architecture.summary` in the JSON output): one
  generated line with the tier that the facts select and a phrase for each
  fact key, for example
  `T2: declarations changed in 3 public modules; 1 registry view edited`.
  Without facts it gives `T0: no architecture fact`; under the earlier policy
  it says that the facts were not assessed. Copy it after the tier in the
  Review block of the pull request description. When a reason outside the
  facts drives the tier, such as a policy path, name it too.
- The `Architecture facts` section: one item for each fact, with the unified
  diff of each changed declaration snapshot. The Markdown report shows the
  first 60 lines of each diff; the JSON output keeps the full diff. Copy the
  list into the Review block, one bullet for each fact, and fold the diffs.
- The `Informational` section: notes that set no tier. They name line counts
  above the note limits, an MI drop of five or more on an existing file,
  retained high review findings on changed files, a public module touched with
  identical declarations, removed edges or public modules, and version-only
  dependency or lockfile-only changes. Record the reason for each note in
  Quality review.

## Architecture declaration

Commit `.pr-impact.json` with `version`, `classification`, and `architecture`
from the example below, without `base` or `head`. It must differ from the base
for each candidate. The manager or Delamain session reads that committed data and
adds the actual commit IDs to a local copy. A mutable pull request description cannot change
the declaration or reuse an approval for different claims.

Generate the local `--impact` input from the committed file:

```sh
pnpm exec node --input-type=module <<'JS'
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const declaration = JSON.parse(git('show', 'HEAD:.pr-impact.json'));
const impact = { ...declaration, base: git('merge-base', 'origin/main', 'HEAD'), head: git('rev-parse', 'HEAD') };
mkdirSync('ast-report', { recursive: true });
writeFileSync('ast-report/impact.json', `${JSON.stringify(impact, null, 2)}\n`);
JS
```

For a stacked pull request, replace `origin/main` with the parent branch in
this script.

The generated local file has this shape. All flags are required. Mark every
matching reason; the declaration can raise but cannot lower the mechanical tier.

```json
{
  "version": 1,
  "base": "BASE_SHA",
  "head": "HEAD_SHA",
  "classification": {
    "container": false,
    "external": false,
    "contract": false,
    "deployment": false,
    "crossCutting": false,
    "component": false,
    "internalInterface": false,
    "sensitiveBehavior": false,
    "dependencyRisk": false,
    "policy": false,
    "uncertain": false
  },
  "architecture": {
    "modelUpdated": false,
    "summary": "Explain why the affected views changed or remain accurate.",
    "views": ["Context", "Building blocks", "Runtime", "Deployment"],
    "evidence": ["Link the relevant code, tests, or validation report."]
  }
}
```

`container`, `external`, `contract`, `deployment`, `crossCutting`, `component`,
and `internalInterface` are architect flags under `impact.architect` of the
rules. Each means a boundary or guarantee change that the playbook defines, and
each requires T2 Need architect. `sensitiveBehavior`, `dependencyRisk`, and
`policy` are team flags under `impact.team`; each requires T1 Team review.
Rules without the section `impact` keep the earlier tiers: there `component`
and `internalInterface` require T1 Team review. `uncertain` also requires
T1 Team review and blocks merge until resolved. A fact a to e or g with every
architect flag false is blocked as `architecture.undeclared_fact`: set the flag
that names the change. In a stack, the flags describe the increment against the
parent. The architecture summary of the declaration follows the facts in the
Review block. A missing declaration blocks merge and cannot yield T0 Auto
merge. Stale commits, missing or unknown flags, empty summaries, or absent
views/evidence are invalid inputs. The declaration records claims and evidence;
it is not proof of human approval.

## Trusted policy and mechanical checks

HEAD must use schema `version: 2`, `tiers.order: [T2, T1, T0]`, the canonical
`tiers.names`, and an explicit `metrics.process_paths` list. The merge base may
use supported version 1 schemas through the isolated historical adapter.
Historical architect requirements still need T2 Need architect, and historical
thresholds and protected paths remain in force for the migration candidate.
The candidate cannot relax its own requirements. A missing or invalid base
policy blocks eligibility; HEAD is read only to report its declared facts.

The rules of the merge base also select the policy of the candidate:

- **Facts policy:** the rules have the section `architecture`, from
  2026-10-24. The facts above select T2 Need architect, and the snapshots are
  compared. The same rules make size, an MI drop, and retained high findings
  notes, and block a new skip or todo marker; the key of each signal gives its
  outcome.
- **Earlier policy:** version 2 rules without that section. A touched public
  module, a size limit, an MI drop, a retained high finding, a new skip or todo
  marker, and a declared dependency fact are T1 Team review there, and the
  checker reports no architecture facts. The pull request that adopted the
  facts policy was classified this way: T1 Team review for its policy paths.
- **Historical policy:** version 1 rules, through the adapter above.

`architecture.policy` in the JSON output names the policy that applied: `facts`
or `earlier`.

The checker verifies the snapshots of HEAD when the rules of HEAD name their
folder, under each policy, because the next pull request compares with them. It
compares them with the merge base only when the merge base has snapshots.

The checker reads committed blobs, including both paths of a rename. It keeps
these checks:

- Protected paths establish the minimum tier stated by the trusted policy:
  T1 Team review for policy, client contract, build, deploy and data paths,
  and the short list of security guarantee files. A read path is T1 Team
  review; a file of `read_paths.removal_paths` counts only when the diff
  removes lines from it, deletes it, or moves it away, and is a note
  otherwise. A semantic boundary change requires T2 Need architect through an
  architect flag even when no fact or path matches.
- Contract documents under `docs/reference/**` need T1 Team review. A public
  module touched with identical declarations is a note. The checker compares
  declarations as text; it does not infer changed contracts from filenames
  alone. The author and the reviewer compare the meaning of each diff.
- Source ownership covers every committed `src/` file. Stable component IDs,
  roots, exact files, cross-component imports, type/runtime edges, external
  imports, builtins, and cycles are checked against the rules. A new fact must
  be removed or declared at HEAD. A declared component, edge, or public module
  is an architecture fact; a declared npm package or Node builtin is
  `dependencies.external_import_added`. Forbidden edges, new cycles, and growth
  of known cycles remain blocked. A candidate's ownership changes cannot
  conceal violations of the base policy.
- Removed test cases and permitted metric exceptions require T1 Team review.
  An added skip or todo marker in a test blocks merge. A non-empty habit-hooks
  snooze file blocks merge. Changed lines above 400 production lines or 1,500
  total lines are notes.
- MI is assessed per production file and CRAP per function. The thresholds
  remain: new-file MI at least 85, new-function CRAP at most 15, and
  changed-function CRAP below 30. An existing-file MI drop of at least five
  and a kept high finding are notes. These are not component averages or
  percentage changes. Coverage bounds can prove a CRAP goal; a bound crossing
  the goal cannot. An expired exception for a changed unit blocks merge. A
  permitted exception still needs T1 Team review.

The trusted rules select required metrics. Production changes require the
snapshots, CRAP rows, and process/review files. `metrics.process_paths` also
selects process/review for metrics tooling, configuration, baseline, and
exceptions changes. Other source-free changes use affected source test groups
for changes under `test/`, or relevant build, type, lint, and manual checks for
scripts, configuration, and documents, plus habit-hooks. Production metrics are
N/A. Historical policies still require
the complete process for every change. Required missing files block eligibility.
Missing raw MI for a supported production implementation also blocks; a
complete snapshot that explicitly reports no functions can establish N/A.

Report the result under [AGENTS.md](../../AGENTS.md) and the
[playbook's report guidance](../../docs/implementation/pr-review-playbook.md#report-layout).
Keep the main description short. Its Review block holds the tier, the
`Architecture:` line, the `Architecture facts` list with folded declaration
diffs, the summary of the impact declaration, visible blockers or
required human decisions, and relevant architecture impact. Keep any required
focused L3 comparison there.

`Validation` holds check results, test selection, run provenance, failures and
retries, N/A and deferred runs, and evidence limits. `Quality review` holds all
tier reasons, each informational note with its reason, policy answers, the
impact declaration, relevant metrics and retained findings, each required
exception reason, habit-hooks results, approval evidence, and collapsed
architecture provenance. Link full reports there; do not paste unchanged full
reports. Follow the linked guidance for full candidate and base SHAs,
accessible evidence links, comment updates, stale results, and evidence and
approval history. For a stacked pull request, the tier and the architecture
comparison use the actual parent; Validation keeps the complete candidate
against main visible.

## Replay earlier pull requests

`replay.ts` evaluates the rules and the checker of this working tree against
earlier pull requests. It is evaluation only: use it to calibrate the rules or
to verify a change to them, never as evidence for a candidate. The trusted
merge-base policy governs a real candidate.

```sh
pnpm exec node script/pr-review/replay.ts --pr N [--pr N ...] [--pair BASE:HEAD ...] [--repo OWNER/NAME] [--out DIR] [--json]
```

For each pull request or pair, the command makes two commits in temporary
worktrees. The base commit is the merge base plus the rules file and
`tsconfig.api-surface.json` of this working tree and the declaration snapshots
that `api-surface.ts --skip-missing` regenerates for that revision. The head
commit is the head of the pull request plus the same files; its parents are
that head and the base commit, so that the checker takes the base commit as the
merge base and reads the installed rules there. Each commit keeps the committer
date of its source commit, so a rerun gives the same commits and the same
exception expiry. When the pull request head has a `.pr-impact.json`, the
command stamps a copy with the two commits and gives it to the checker; the row
then shows the tier with the flags that the author set. Then
`check.ts --base <base commit> --json` runs in the worktree of the head commit.
A pull request that changed an installed file gets a note in its row. A listed
module that does not exist at a revision has no snapshot there, so its row
shows `public_surface.snapshots.missing` blockers; the tier still counts.
A pull request that adds a source folder which the installed rules do not list
cannot be replayed: the checker stops with "has no component owner", as it
does for a candidate that did not declare its component. The row records
that failure.

`--pr N` names a pull request of `--repo` (default `tomer-mayara/Thermus`)
and needs `gh`: a merge commit gives head and base from its parents, a squash
merge uses the recorded head, and an open pull request uses `refs/pull/N/head`
and its base branch. `--pair BASE:HEAD` names two refs or commits of this
repository. `--out DIR` (default `ast-report/replay`) receives `replay.md`,
`replay.json`, and one checker result per row. `--json` prints one JSON
object instead of the Markdown table. The command removes its worktrees and
temporary refs at the end, also after a failure, SIGINT, or SIGTERM, and sweeps
what an interrupted run left.

The label command uses exactly `T0 Auto merge`, `T1 Team review`, or
`T2 Need architect`; labels select no approval authority.
