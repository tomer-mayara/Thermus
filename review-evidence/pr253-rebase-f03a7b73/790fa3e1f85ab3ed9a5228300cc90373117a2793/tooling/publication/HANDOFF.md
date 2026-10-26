# PR 253 evidence publication preparation

Preparation only. No gate, stage, scan, push or PR edit was run by this worker. No tracked file, branch or index was changed. The gate runner is frozen for the manager at `fa5d4d7f57ef270df2a056ad523ec22e3b5032b6`.

## Scope and pins

- Final candidate: manager supplies after source-free documentation/history changes.
- Gate head: `fa5d4d7f57ef270df2a056ad523ec22e3b5032b6`.
- Parent comparison: `f03a7b73b2c27dc26477d5378a3356f28744a367`.
- Complete-candidate validation against main: `8c6d204e8588a664438ba8934ab36670b802525f`.
- New evidence branch: `codex/pr253-rebase-f03a7b73-evidence`.
- Prefix: `review-evidence/pr253-rebase-f03a7b73/<final-full-SHA>/`.
- Keep existing Validation `6395531390` and Quality review `6395531599`; no new supporting comments.
- Keep Draft, R1 display-hydration performance defect, unmerged parent, pending current-candidate human/architect approval, actual failed gates and other checker blockers. No Ready or merge.

## Prepared helpers

`prepare.py` supports `preview`, `inventory` and `stage <full-final-SHA>`. Preview still reads report inputs; do not expect it to run before the report set exists. Inventory and staging enforce current clean committed candidate, fixed main/parent refs, parent-based current metrics/checker/impact/snapshots, verified coverage identity, empty habit snooze, source-free document bridge from the gate head, manager and architecture provenance/render checks, exact embedded Mermaid bytes, no text placeholders, all required gate records and original input bindings, current per-gate failure dispositions, full explicit branch habit evidence and fresh nested AMD64 hosted checks. A failed gate can be retained only as a failed/unavailable gate under a reviewed blocked-Draft decision.

`file-set.json` is a minimal proposed explicit artifact map. Manager must update names to the final architecture/report outputs and add specific reviewed logs/notes/history that the final report cites. It includes the original two comment bodies as a compact immutable history record. It does not copy old caches, user drafts, raw V8 data or source trees. All gate-attempt logs and input bindings are included from the current ledger. Docker progress and other diagnostic/coverage/metric logs must be listed explicitly. Complete native metrics HTML static dependencies and the verified original manifests of referenced coverage captures are discovered from their exact reports. Only the current capture manifests are included; raw capture files are excluded.

`publish.py --publish <full-final-SHA>` requires an exact approved inventory and unchanged stage, exact-value scan evidence for the configured WorkOS and Axiom keys, current manager review, fixed refs and a clean candidate. It creates a new parentless evidence commit through an isolated temporary Git index. It never changes the checkout or its index, and its push uses an empty-branch lease so it cannot overwrite an existing branch.

`update-text.py` remains an unused prepared fallback. Root will use the available connector for the PR body and the two comments, with structured fields and readback. No remote action is part of this worker task. The fallback `update-text.py --update <full-final-SHA>` requires published evidence, manager-reviewed exact text hashes and matching staged/scanned text bytes. It checks PR 253 is still Draft, unmerged, on the right head and parent. It patches the main body and exactly the two existing supporting comments with structured JSON, then reads all three back. It does not mark Ready, merge or add a comment.

`scan-configured.mjs --axiom-env /Users/tomermayara/git/Thermus/.env.local` reads only the configured Axiom key needed by the scan into the spawned process. It invokes the existing Keychain WorkOS staging launcher, then `scan.mjs`. It does not change the origin alias, environment files or launcher. Both required keys must be present; values stay in process memory. The scanner checks only the reviewed stage, fixed main/parent/gate pins, exact approved names and hashes, and normal non-symlink files. It writes a value-free report using the exact schema expected by `publish.py`: `mergeBase` is the parent, `main` is main, and `gateHead` is the validation head. It scans exact configured sensitive environment values, including WorkOS and Axiom; this is not exhaustive secret detection. Root owns invocation after staging. No scan has been run by this worker.

Use fresh combined unit, integration and acceptance coverage, which the full source selection permits. Preserve the first completed metric run's 12 report files under `history/first-metrics/` before final refresh, as in PR 251. Root will populate and explicitly add those files to `file-set.json`; this preparation does not copy prior reports or claim new metric evidence.

## Manager-supplied records

Follow the same final evidence schema as PR 251 where useful, but compare metrics and architecture against this actual parent. The helper expects these exact pin fields:

- `final-input-binding.json`: `candidate`, `mergeBase` = parent, `main`, `gateHead`, `sourceAndGateInputsUnchanged: true`, exact `changedPathsSinceGate`, `sourceFingerprint` and `inputsFingerprint` equal to verified coverage/snapshot identity. Only `docs/` changes may bridge gates.
- `manager-review-final.json`, `architecture/provenance-final.json`, `architecture/render-report-final.json`, and `hosted-build-review.json`: `candidate`, `mergeBase` = parent. Manager review has `reviewed: true`. Render report hashes final Mermaid/PNG/SVG; hosted review has `reviewed: true`, `freshChecksExecuted: true`, `linuxAmd64: true`, and exact reviewed log hashes.
- `draft-review.json`: `candidate`, `parent`, `main`, `gateHead`, `reviewed: true`, `overallMergeStatus: blocked`, `draft: true`, `ready: false`, `knownR1Retained: true`, `parentUnmerged: true`, `humanApproval: pending`, `noReadyOrMerge: true`, a concrete `reason`, prior accessible `previousEvidence`, and `gateDispositions`. Each current required failed/unavailable gate needs `{name, attempt, log, sha256, status: failed|unavailable, reason}`. No PR 251 baseline result is presumed for PR 253; its storage-failure runtime changed.
- `habit-command.json`: explicit complete-candidate `--branch origin/main` command and `base` = main, plus its actual result and final dispositions.
- `publication/text-reviewed.json`: final `candidate`, `reviewed: true`, and `sha256` map for `README.md`, `VALIDATION.md`, `QUALITY.md` in `publication/text/`.
- `publication/approved-inventory.json`: exact complete output of strict inventory with only `approved` changed to true after manager review.
- Staged `secret-scan.json`: `candidate`, `mergeBase` = parent, `main`, exact staged file hash map excluding the scan and manifest, `requiredSecretSources: [WORKOS_API_KEY, AXIOM_API_KEY]`, `configuredSecretValuesChecked >= 2`, and no `matchedFiles`. Root owns the secure scan and must never print values.

The helpers do not determine merge eligibility or approve their own content. All selected gates must report actual results and retain attempt history. Old approval is history only. The known R1 defect is outside the authorized rebase scope.

Syntax checks passed for the prepared Python and JavaScript helpers. No behavior tests were added for these local preparation scripts.
