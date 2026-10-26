# PR 251 rebase evidence helper handoff

These helpers are cache-only drafts. This agent did not run them against reports,
scan secrets, stage evidence, publish evidence, or run tests/gates. The manager
publishes the evidence and updates existing PR text. Use only the maintained
Validation comment `6394917607` and Quality review comment `6394917737`; create
no new supporting comment.

Destination: create-only branch `codex/s2-5-01a-rebase-evidence`, with root
`review-evidence/s2-5-01a-rebase/<final full SHA>`. Publication uses a temporary
Git index and an orphan evidence commit. It does not switch the checkout or
change its real index. An empty expected remote SHA makes the push create-only,
including a remote race. An existing branch stops the helper; never overwrite it.

Before inventory, complete and read the reports and logs. Commit the final
documentation/metric-history change; verify a clean tree. Keep `origin/main`
at the pinned base, or refresh this comparison if it moved. The helpers fail
closed on stale old-PR or R1 metrics. They require final candidate/base pins in
snapshots, process, CRAP, review, checker, and stamped impact. Coverage can retain
its true earlier capture commit only when its checked identities match the final
snapshot. Never edit reports to change those identities.

Required final cache records:

- `manager-review-final.json`: `candidate`, `mergeBase`, `reviewed: true`.
- `architecture/provenance-final.json`: current `candidate` and `mergeBase`.
- `final-input-binding.json`: current `candidate`, `mergeBase`,
  `gateHead: e1e55dc04f5afa1e46eab5946067683fa496aaa6`, current
  `sourceFingerprint`, current canonical `inputsFingerprint`,
  `sourceAndGateInputsUnchanged: true`, exact `changedPathsSinceGate` array,
  and `permittedChanges: source-free documentation/metric history only`.
  The helper checks the exact Git diff and unchanged original gated-input hashes.
  The diff from the gate head may contain only `docs/` paths.
- `gate-ledger.json`: all attempts finished, including required rows for
  api-surface, ordinary, typecheck, portal, hosted-live, native-container, and
  hosted-container. Each row needs its actual basename log and final outcome.
  Preserve failed attempts. An unavailable row must have a reason and log;
  unavailable is not passed. The manager must assess Ready separately.
- `coverage-command.json` and `metrics-command-results.json` retain command,
  arguments, timestamps, exit status, signal where applicable, and log paths.
  The first metrics copies stay unchanged in `history/first-metrics/` before
  the final comparison reports replace current output. This folder's original
  process must name the original gate head and pinned base.
- Final `publication-text/README.md`, `QUALITY.md`, and `VALIDATION.md`.
  Use `VALIDATION.pending.md` only as a working draft; it is excluded from staging.
  Resolve its result and link placeholders after the actual results arrive.

The allowlist includes current rebase logs, gate ledger, original PR history,
range diff, architecture/review/quality artifacts, current Markdown and JSON
metrics, original capture manifests, and final changed committed files plus
impact, exceptions, and snooze. Quality root files `quality-*.md/json/txt` and
the `quality/` folder are allowed. Current `report-drafts/` and original
`history/first-metrics/` are included as identified draft/history evidence.
Explicit optional records include `coverage-command.json`,
`metrics-command-results.json`, `gated-inputs.json`, `docker-before.json`,
`docker-after.json`, and `final-ci-observation.json` when available. Cleanup and
final API-check logs are allowed. Every live attempt log is retained, including
the initial setup failure and the unchanged retry. Old R1 caches, raw V8 and its
raw process/seal/loader records, preservation metadata,
environment files, keys, and user drafts are excluded. Shared metric HTML/data
output is omitted to avoid stale artifacts. No report or prior history is edited.

Inventory and manager review:

```sh
python3 .cache/rebase251/prepare-review-evidence.py inventory <final full SHA>
```

Read `final-binding-template.json` and its exact source/target/hash inventory.
Confirm every file is safe, current, and needed. Save the same object as
`final-binding.json` with only `evidenceComplete` changed to `true`. Then stage:

```sh
python3 .cache/rebase251/prepare-review-evidence.py stage <final full SHA>
```

The stage is never overwritten. If a source or result changes, keep its prior
version as history, review a fresh inventory, and remove only the obsolete
ignored stage after inspection. Do not patch report contents inside a stage.

Run the exact configured-secret scan in the manager session. The wrapper reads
only the Axiom key from the same configured file as the gate runner and obtains
the WorkOS key through the existing staging launcher. Values stay in child
memory; no values are printed or written. The scanner also checks other
sensitive values already present in its environment.

```sh
pnpm exec node .cache/rebase251/scan-with-configured-secrets.mjs \
  --axiom-env /Users/tomermayara/git/Thermus/.env.local
```

Read the scan result and full staged inventory. This scan checks exact configured
values, not all possible secrets. If it matches a file, do not publish. Inspect
the source without exposing values and omit an unsafe optional artifact or
produce a separately identified safe summary. Preserve the original locally.
Do not edit a raw report or historical evidence to make it appear clean.

Only the manager may run publication, after review:

```sh
python3 .cache/rebase251/publish-review-evidence.py --publish <final full SHA>
```

Use the returned immutable evidence commit for published blob/tree links.
Read published files and both updated existing comments back. Keep final
candidate/base pins, checker status, all unresolved blockers, and required
human approval explicit. The helpers neither grant approval nor authorize Ready,
merge, release, or deployment.
