# Conflict resolution for PR #253

Old parent: `122d65bf1f035fc195792cc083732aa05c423c58`. Old complete head: `0ff3f6cdde5be4124df0ed2ab002844d5db1c502`. New parent: `f03a7b73b2c27dc26477d5378a3356f28744a367`. Replay stopped at `d75b8676`. Stage 1/2/3 and conflicted files are saved beside this note.

- `architecture/components.md`: keep the new parent's snapshot pending-content cleanup. Add the removal-first close order from S2.5-01b. `composeHostedApplication` stops administration before the storage wrapper closes snapshots; `composeLoggingStorage` then closes the Collector and SQL. MCP cleanup runs beside that chain. Keep the original durable rows, late-write caveat, bounded SQL and late-work accounting text.
- `docs/design/organization-admin-plan.md`: keep the new parent's current Slice 2 rollout and PR #252 first-event status, including the unverified live-destination limit. Add the stacked PR #253 removal status without restoring the old pre-rollout status. Keep S2.5-01c/02 planned.

No source, test, runtime behavior, live system, or remote PR was changed. No file was staged. Fresh checks remain pending. Manager review and the remaining rebase commits must complete before final candidate provenance can be pinned.

## Final replay commit

Replay of `0ff3f6cd` conflicted again at the same plan status paragraph. Keep the new parent's rollout status and the original candidate's historical local validation. State that rebased checks remain pending, keep the parent and independent architect requirements, and keep S2.5-R1 unresolved in this PR. The later R1 repair is outside this rebase. This avoids treating the old validation as a new pass. The second conflict stages and working file are retained with `final-commit` names. No staging was done by this worker.
