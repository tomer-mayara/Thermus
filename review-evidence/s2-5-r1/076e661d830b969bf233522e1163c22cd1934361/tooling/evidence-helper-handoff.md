# R1 evidence helper handoff

The three helpers below are cache-only files. They were prepared while gates
were running. They have not staged, scanned, committed, or published evidence.
Only syntax checks ran. No test, build, metrics process, Docker change, tracked
edit, or cloud action was performed for this helper task.

## Inputs and final pin

Evidence goes to `review-evidence/s2-5-r1/<full final SHA>` on the new evidence
branch `codex/s2-5-r1-review-evidence`. The actual parent ref is
`origin/codex/s2-5-02-removal-verification`. The publisher creates a parentless
evidence commit through a temporary index. It changes no checkout or local
branch and does not use the real index. Its remote push has an empty expected
branch SHA, so it can create the named branch only. If that branch already
exists, inspect and handle it explicitly; do not force a replacement.

Finish all gate/coverage/metrics/log writes before inventory. Commit the full
candidate and make `git status --porcelain` empty. The unrelated user draft
`docs/implementation/admin-s1-production-cutover.md` must remain outside the
candidate and the evidence. Its name is blocked by all publication phases.
The manager must preserve it outside the tracked candidate to reach a clean
checkout; the helpers never move or delete it.

Required final manager files:

- `.cache/s25-r1/manager-review-final.json` must contain `candidate` (full
  HEAD), `parentMergeBase` (the actual parent merge base), and `reviewed: true`.
  Keep the substantive source/browser/architecture review and limits in it.
- `.cache/s25-r1/architecture/provenance-final.json` must contain `candidate`
  and `parentMergeBase` with those same full pins. Include the final artifact
  identities and retained draft history as needed. All normal evidence files
  under `architecture/` are copied, including v1/v2 Mermaid, renders, inventories,
  review notes and the final pinned artifacts.
- `.cache/s25-r1/publication-text/{README,QUALITY,VALIDATION}.md` must contain
  the final main summary and exactly two maintained supporting comments. Draft
  `review/*.pending.md` and the draft ledger snapshot are excluded.
- `ast-report/pr-review.json` must bind `candidate` and `mergeBase` to current
  HEAD and parent. `ast-report/impact.json` must bind `head` and `base` likewise.
  The reports may honestly record blockers; these helpers do not grant merge
  eligibility or human approval.
- `gate-ledger.json` must contain finished rows for install, API surface,
  ordinary, typecheck, portal, PostgreSQL, Collector, Members browser, hosted
  live, native container, and hosted container. Failures/retries are preserved.
  An exit record does not by itself prove a pass; Validation must retain counts,
  failure/retry history, stale-byte dispositions and omitted/deferred reasons.
- `coverage-command.json`, `metrics-command-results.json`, all required final
  ast-report files, and the screenshot `browser/members-remove-narrow.png`
  must exist. Each selected coverage capture needs its exact matching manifest
  and SHA-256 fingerprint. Raw V8 captures are not copied.

The evidence includes root R1 logs (red/green, retry, setup and cleanup), the gate
ledger, source review, implementation record, safe environment facts, gate-input
hash history, review/habit/metric dispositions, architecture history, PR/comment
history under `pr-history/`, and current-run sanitized fixture/cleanup records
under `live/`, plus final publication texts, final reports, and capture manifests.
Only the manager-selected R1 live records belong in that folder; the helpers
do not read or copy `.cache/s25-02/live` directly. It snapshots committed
R1 changed files plus the impact/exceptions/snooze files and all public API
snapshots. It links the existing parent evidence rather than copying its giant
tables. Helpers and this handoff are retained under `tooling/`.

## Inventory, inspect and stage

Run from the repository root after every producer has exited:

```sh
python3 .cache/s25-r1/prepare-review-evidence.py inventory <full-final-SHA>
```

This writes only `final-binding-template.json`, not a stage. Review its entire
file list and hashes, the logs, final reports and review texts. Save that exact
JSON as `final-binding.json`, changing only `evidenceComplete` from `false` to
`true`. That field is the coordinator's declaration that logs and artifacts are
complete and no producer still writes them. Do not set it while a gate runs.

```sh
python3 .cache/s25-r1/prepare-review-evidence.py stage <full-final-SHA>
```

The helper recomputes the inventory and requires exact equality with the final
binding. It copies to `.cache/s25-r1/publish/review-evidence/s2-5-r1/<SHA>` and
writes `publish-metadata.json`. An existing stage is never overwritten. A partial
stage stays available for inspection after a failure. Do not publish it. A
changed input requires a new reviewed inventory/binding/stage and a new scan.

## Exact configured-secret scan

Run the scanner with the established WorkOS Keychain launcher and load only the
Axiom API key in the child process. This command prints no configured value and
writes no credential file:

```sh
node /Users/tomermayara/.config/thermus/with-workos-staging.cjs node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const settings = parseEnv(readFileSync('/Users/tomermayara/git/Thermus/.env.local', 'utf8'));
process.env.AXIOM_API_KEY = settings.AXIOM_API_KEY;
await import('./.cache/s25-r1/scan-review-evidence.mjs');
JS
```

It requires both real configured key sources. It also scans all other nonempty
sensitive environment values of at least 12 bytes. Its report records only the
number of distinct values, matched file paths and file hashes; it saves no
secret value or value hash. Any exact match blocks publication. Do not print a
match's contents while investigating it. Exact matching is not exhaustive secret
detection; the manager must also inspect the selected artifact scope and logs.

## Publication after manager review

The task and repository instructions already authorize required PR evidence
publication. No new user confirmation is needed.

After review and a clean zero-match scan:

```sh
python3 .cache/s25-r1/publish-review-evidence.py --publish <full-final-SHA>
```

This is the only helper that writes Git objects and contacts the remote. It
rechecks the candidate/parent/checker pins and every scanned stage hash. It
builds an exact allowlisted tree in a temporary index, makes an orphan commit,
and creates only `codex/s2-5-r1-review-evidence`. It does not edit the PR, mark it
Ready, merge, or release. It preserves `manifest.json` and updates cache metadata
with the evidence URL after a successful push. The manifest covers all scanned
files and the scan report; it does not hash itself. Stage changes after scan
are rejected. Do not hand-edit the scan or manifest.

## Limits

The helpers do not prove test success, coverage validity beyond the retained
manifest checks, a completed human approval, a release, or that every process
has stopped writing logs. The final coordinator binding and review provide that
context. Symlinks, raw V8, environment/credential files and the user draft are
excluded. The helpers deliberately refuse stale pins and do not repair them.
No existing evidence stage or remote evidence branch is replaced automatically.
