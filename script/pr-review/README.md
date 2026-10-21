# Compute the review tier

`check.ts` classifies a committed pull request candidate using the trusted
merge-base rules and the candidate's declared facts. It reports one review tier
and a separate local eligibility result. Follow [AGENTS.md](../../AGENTS.md),
the [playbook](../../docs/implementation/pr-review-playbook.md), and the
[test gate policy](../../docs/implementation/test-gate-policy.md).

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

Commit the candidate first. Update the committed `.pr-impact.json` declaration described below.
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

`container`, `external`, `contract`, `deployment`, and `crossCutting` mean the
material boundary or guarantee changes defined by the playbook; they require
T2 Need architect. `component`, `internalInterface`, `sensitiveBehavior`,
`dependencyRisk`, and `policy` require T1 Team review. `uncertain` also requires
T1 Team review and blocks merge until resolved. A missing declaration blocks
merge and cannot yield T0 Auto merge. Stale commits, missing flags, empty
summaries, or absent views/evidence are invalid inputs. The declaration records
claims and evidence; it is not proof of human approval.

## Trusted policy and mechanical checks

HEAD must use schema `version: 2`, `tiers.order: [T2, T1, T0]`, the canonical
`tiers.names`, and an explicit `metrics.process_paths` list. The merge base may
use supported version 1 schemas through the isolated historical adapter.
Historical architect requirements still need T2 Need architect, and historical
thresholds and protected paths remain in force for the migration candidate.
The candidate cannot relax its own requirements. A missing or invalid base
policy blocks eligibility; HEAD is read only to report its declared facts.

The checker reads committed blobs, including both paths of a rename. It keeps
these checks:

- Protected paths establish the minimum tier stated by the trusted policy.
  Current policy, sensitive areas, and potential contract/deployment changes
  have a T1 Team review minimum. A semantic boundary change requires
  T2 Need architect even when no protected path matches.
- Public-surface detection names touched modules, changed direct imports from
  the same owner, and contract documents. These are possible surface changes
  and need T1 Team review. Compare their exported declarations. This checker
  does not emit or compare declaration snapshots and does not infer changed
  contracts from filenames alone.
- Source ownership covers every committed `src/` file. Stable component IDs,
  roots, exact files, cross-component imports, type/runtime edges, external
  imports, builtins, and cycles are checked against the rules. A new fact must
  be removed or declared at HEAD; a declaration needs T1 Team review. Forbidden
  edges, new cycles, and growth of known cycles remain blocked. A candidate's
  ownership changes cannot conceal violations of the base policy.
- Changed-line limits, removed test cases, added skip/todo markers, kept high
  findings, and permitted metric exceptions require T1 Team review under the
  current policy. A non-empty habit-hooks snooze file blocks merge.
- MI is assessed per production file and CRAP per function. The existing
  thresholds remain: new-file MI at least 85, review for an existing-file MI
  drop of at least five, new-function CRAP at most 15, and changed-function
  CRAP below 30. These are not component averages or percentage changes.
  Coverage bounds can prove a CRAP goal; a bound crossing the goal cannot.
  An expired exception for a changed unit blocks merge. A permitted exception
  still needs T1 Team review.

The trusted rules select required metrics. Production changes require the
snapshots, CRAP rows, and process/review files. `metrics.process_paths` also
selects process/review for metrics tooling, configuration, baseline, and
exceptions changes. Other source-free changes use their relevant tests and
habit-hooks; production metrics are N/A. Historical policies still require
the complete process for every change. Required missing files block eligibility.
Missing raw MI for a supported production implementation also blocks; a
complete snapshot that explicitly reports no functions can establish N/A.

Keep full metric artifacts available. The pull request description needs the
tier, all relevant reasons, architecture impact, current check evidence, and
any required decision or exception. It does not need unchanged metric findings.
The label command uses exactly `T0 Auto merge`, `T1 Team review`, or
`T2 Need architect`; labels select no approval authority.
