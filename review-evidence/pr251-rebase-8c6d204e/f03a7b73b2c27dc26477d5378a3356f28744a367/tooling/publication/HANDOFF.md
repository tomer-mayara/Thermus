# PR 251 evidence publication handoff

This helper set is prepared for manager inspection. No evidence has been staged, scanned with credentials, committed or published by the worker. Syntax checks pass. The launched validation runner and Docker wrapper have not been edited by this subtask.

## File set and pending review

`file-set.json` is the explicit required source-to-target mapping. `prepare.py preview <full SHA>` writes `stage-preview.json`, listing present hashes and every missing required artifact. Preview is not a current-report or gate pass. `inventory` requires the final committed clean candidate, pinned base, current reports, verified coverage and manager sign-off. It writes `inventory-template.json` with exact hashes and `approved: false`.

The manager must inspect the selected file set before copying that complete template to `approved-inventory.json` and setting only `approved` to true. `stage` recomputes the inventory and requires exact equality. A changed helper, log or report needs a new inventory review. Required files are never silently omitted. Each selected gate must have a latest completed attempt with code 0, except the explicitly approved blocked-Draft PostgreSQL disposition below. All earlier failures remain in the ledger and log set. Any unlisted root log blocks inventory so that the manager can review its purpose before updating the allowlist. Do not add general recursive directory copying.

Required final manager records use these fields:

- `final-input-binding.json`: `candidate`, `mergeBase`, `gateHead`, `sourceAndGateInputsUnchanged: true`, `changedPathsSinceGate`, `sourceFingerprint`, `inputsFingerprint`. The gate head is `fd7fa0b1e53d653f92168b75ba4d65618a9138a8`; the final bridge can contain only source-free files under `docs/`. The exact current diff and recorded gate input hashes must agree.
- `manager-review-final.json`: `candidate`, `mergeBase`, `reviewed: true`, with the manager's substantive review, gate disposition, current architecture sign-off and remaining independent human approval recorded too.
- `hosted-build-review.json`: `candidate`, `mergeBase`, `reviewed: true`, `freshChecksExecuted: true`, `linuxAmd64: true`, and `logs: {"docker-build-<time>-<pid>.log": "<sha256>"}`. State the selected phase counts, network isolation, actual image result and whether any check layer was cached. Do not set the fresh-check flag when a whole check phase was reused without compatible evidence.
- `quality/final-review.md` and `quality/final-dispositions.json`: complete-candidate final findings and reasons. The confirmed required set also includes both Markdown/JSON habit and metric dispositions and `checker-notes.md`. If the manager chooses other filenames, update `file-set.json` before inventory approval.

The architecture helper writes `provenance-final.json` and `render-report-final.json` after the final document-only commit. Add `architecture/manager-review.md` for the current diagram and notes. All three final PR texts are required under `publication/text/`: `README.md` (main description), `VALIDATION.md`, and `QUALITY.md`. Keep exactly the two maintained supporting comments in GitHub. The main description owns the authoritative comparison. This package preserves `pr-history-initial.json`; link earlier immutable evidence instead of copying old archives.

## Explicit blocked-Draft PostgreSQL disposition

The final scope is the requested rebase, returned as blocked Draft. Do not fix unrelated baseline logging tests in this evidence operation. The helper permits the latest nonzero result only for `logging-postgres`, while every other selected gate must be present, complete and code 0. This is a failed required gate and continues to block Ready and merge.

The manager must create root-cache `blocked-draft.json` from `publication/blocked-draft.template.json`, set the actual final candidate, review the evidence, and set `reviewed` to true. The record must explicitly retain `overallMergeStatus: "blocked"`, `ready: false`, `draft: true`, the failed gate name/attempt/nonzero code/log/hash, exact-main baseline proof record/hash, candidate focused retry code/log/hash, and its reason. This record is required and published. It is not created or approved automatically.

Strict preparation checks the exact failing latest row and log hash; the baseline archive hash against `git archive` of pinned main; pinned Node; successful baseline TypeScript build; the exact two-case runtime selection and failed exit; original diagnostic log hashes; unchanged archived inputs and cleanup; and identical assertion text in the baseline and candidate retry. Both diagnostic logs must show two tests, one pass, one failure and zero cancellations/skips/todos. It preserves the 12/13 full-group failure too. No unrelated failed gate or unavailable gate can use this disposition.

If the first fresh metrics at `138e7ad6` creates a new immutable base record, the final history commit requires refreshed report pins. The file set requires exactly eight preserved first-run files under `history/first-metrics/`: process Markdown/JSON, review Markdown/JSON, both snapshots, CRAP JSON and metrics command results. The helper never recursively walks that history folder. The manager must populate them or explicitly review an updated selection when no such history commit occurs.

The file set includes the original failed group log, the candidate retry at `checks/quality-postgres-focused.log`, and baseline build/test/command/hash proof plus failure review under `review/validation/`. The root `quality-*.log` pattern already allowlists the focused retry; baseline logs are explicit file-set entries rather than a broad root-log exception. The baseline helper and original input hashes are retained. Complete inventory still means a complete truthful evidence package, not completed required checks.

## Manager commands after final reports

```sh
python3 .cache/pr251-rebase-8c6d204e/publication/prepare.py preview <full-final-SHA>
python3 .cache/pr251-rebase-8c6d204e/publication/prepare.py inventory <full-final-SHA>
# Inspect inventory-template.json, then approve its exact file set.
python3 .cache/pr251-rebase-8c6d204e/publication/prepare.py stage <full-final-SHA>
node .cache/pr251-rebase-8c6d204e/publication/scan-configured.mjs --axiom-env /Users/tomermayara/git/Thermus/.env.local
# Inspect staged texts, hashes, secret-scan.json and manager approval.
python3 .cache/pr251-rebase-8c6d204e/publication/publish.py --publish <full-final-SHA>
```

The scan uses the same existing Axiom settings as ordinary gates and the existing secure launcher for the WorkOS staging key. Both exact configured values are required and stay in child memory. It also checks other sensitive environment values present in that process. It prints no secret values and never changes credential stores or environment files. It is not exhaustive secret detection. Do not publish if any matched file remains.

`publish.py` requires the exact scanned stage, approved hashes, clean current candidate and current checker pins. It uses a temporary Git index and a parentless evidence commit; it does not switch branches or alter the checkout's index. The push uses an empty expected remote SHA, so the new branch `codex/pr251-rebase-8c6d204e-evidence` is create-only, including a race. If the branch exists or a publication attempt is uncertain, inspect that outcome before doing anything else. Do not overwrite or silently recreate it.

The package deliberately omits raw V8 captures, user drafts, credential files, `initial-state.json` (which records draft-preservation metadata), older cache archives and duplicate product source copies. Coverage includes only the verified current report and its original capture manifests. The full process/review Markdown and JSON reports are retained. The native comparison and its reachable local HTML, data and image assets stay under their original `ast-report/` paths; unreferenced stale native outputs are excluded. Strict inventory verifies the native graph data against every recorded production source hash. Embedded architecture graphs, legends and analysis limits stay in the complete process report. Native HTML keeps its original external CDN references; those references need public access to render. No remote assets are downloaded. Source and policy remain accessible at the pinned candidate commit. The package includes fresh logs, every attempt's ledger, gate input bindings, architecture/quality review, current metric reports and final texts. Complete inventory means complete evidence files; it does not turn a failed gate or pending human approval into a pass.

## Accessible URLs after publication

The publisher prints the immutable evidence root:

`https://github.com/tomer-mayara/Thermus/tree/<evidence-commit>/review-evidence/pr251-rebase-8c6d204e/<candidate>`

Use its paths in the maintained comments, for example `checks/ordinary-1.log`, `metrics/process.md`, `review/gate-ledger.json`, and `architecture/assessment.md`. GitHub blob URLs can replace `tree` with `blob` for direct file links. Verify links and final PR bodies after updating them. Relative paths work within the evidence README; PR comments need the complete accessible URL. Keep the previous evidence link:

[Prior immutable #251 evidence](https://github.com/tomer-mayara/Thermus/tree/9a206af7fd3385c697b65903ab7f39e3fab39fea/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b).
