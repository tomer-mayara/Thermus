# UI-03 original evidence archive before main rebind

Original candidate `6ced8db3965190d1d859b60d7053f1830cf5a23c`; actual parent `8278873552601ed156a9aaeeb31c41cdb84ad77a`; observed main `2b3ad13b9e2e61e206479b82e91359192cae1d00`.

This preserves completed evidence before the upcoming rebase onto main `9507e751`. It is historical input for a future verified rebind, not proof of a new head or a publication body. No final new-head publication text is prepared here. No tests, builds, metrics, Git or external operations ran for this archive.

- [Execution summary](validation/evidence-summary.json), [all results/counts](review/result-count-index.json), [functional selection](validation/6ced8db3-functional-selected.json), [functional result](validation/6ced8db3-functional.json), [quality result](validation/6ced8db3-quality.json).
- [Full process](ast-report/process.md), [process JSON](ast-report/process.json), [review](ast-report/review.json), [CRAP](ast-report/crap.json), [coverage](ast-report/coverage.json), [base snapshot](ast-report/snapshot-base.json), [head snapshot](ast-report/snapshot.json), [impact](ast-report/impact.json), [checker](validation/6ced8db3-checker.json).
- [Original Collector failure](validation/6ced8db3-collector-2.log) and [private-dependency retry](validation/6ced8db3-collector-2-private-deps-retry.log) retain the 7/10 then 10/10 history. The original absolute dependency mount failed; the private copy used the same package bytes. [Copy provenance](validation/dependency-copy-provenance.json), [source manifest](validation/dependency-source-tree-manifest.json), [private manifest](validation/dependency-tree-manifest.json).
- [Source review](review/source-review.md), [inventory](review/current-increment-inventory.json), [document review](review/docs-review.md), [published original source ancestry](review/source-review-publication.json), [old PR body/comments](review/pr-before-266.json). The finishing independent UI-03 review can be added later.

All original logs, command result JSON, before-input manifests, browser screenshots, metric/habit/checker dispositions and final normalized coverage remain. Capture-manifest JSON files are retained; raw V8 captures are excluded. The actual `node_modules-immediate-links-before-repair` directory and all node_modules/credential files are excluded.

Environment history is bounded: tools affected the shared dependency launcher; no manual package installation, package-version change, production source or repository configuration change is claimed. The primary ignored Node alias was normalized to `../node/bin/node`, with equal runtime bytes/version. The repair record is copied when available. Do not describe shared node_modules as wholly untouched by tools.

[SHA256SUMS](SHA256SUMS) covers each file except itself. [Credential scan](review/credential-scan.json) checks known configured values and WorkOS key prefixes privately; no secret values are printed. Gate, human approval, final manager and new-head verification holds are not resolved by packaging.
