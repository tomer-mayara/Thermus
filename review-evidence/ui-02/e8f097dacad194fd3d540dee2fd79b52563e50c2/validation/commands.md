# Complete-candidate commands

Runtime: Node 24.20.0; repository-pinned pnpm and ast-metrics.
Comparison base: origin/codex/ui-01-refined-tabs, a017020e.
Source candidate: d742e144. Final candidate: e8f097da (validation record only).

1. Run new/changed focused tests and the Members browser gate before commit. Commands, failed attempts and corrections are in implementation/commands.txt. Final counts: 123 ordinary and 19 browser cases.
2. Run `npm run test:hosted-live` through the existing private staging launcher before commit. Pass: 29 tests. The source inputs and cleanup ledger are retained. No production environment was used.
3. Commit the tested implementation. Verify 860 tracked source/test/build inputs match the precommit test bytes.
4. Run `npm test` through an ignored launcher that supplies the existing Axiom test-dataset credentials and pinned Lightpanda. Pass: 5,131 ordinary and 49 portal tests. Credential files and launchers are excluded from published evidence.
5. Run `npm run typecheck` and `npm run build:user-portal`. Both pass.
6. Run `pnpm exec node script/code-quality/ast-metrics-snapshot.ts --base origin/codex/ui-01-refined-tabs` and the head snapshot command. Both pass.
7. Run `pnpm exec node script/code-quality/ast-metrics-process.ts --base origin/codex/ui-01-refined-tabs --collect-coverage --json ast-report/process.json`. The unit suites pass (3,301 emitted, 29 portal); the process exits 1 with retained MI/test findings and one unmeasured row callback. No tool failure is claimed as a goal miss.
8. Run `npm run test:container`. Pass: 11 tests with outbound access denied; the gate removes its owned resources.
9. Run `pnpm exec node script/code-quality/ast-metrics-coverage.ts --suite integration`. Pass: 1,158 tests and verified capture. This complete group was already selected by npm test. No source change is made.
10. Run the complete process again without a collection flag, then `pnpm exec node script/code-quality/ast-metrics-crap.ts --base origin/codex/ui-01-refined-tabs --json ast-report/crap.json`. The process retains only MI/test goal misses. CRAP passes with no unknown or failed required goal. The tool does not write a history record because the stack parent is not on main.
11. Run `npm run test:container:hosted`. This builds Linux AMD64 and executes `RUN --network=none npm run build:hosted`, then image runtime checks. The final build and runtime logs record the outcome. No extra standalone npm run check is added.
12. Commit the validation record only. Re-verify input hashes. Run the head snapshot, complete process with verified coverage reuse, standalone CRAP and stamped review checker against the same parent at e8f097da. The checker reports T1 Team review, locally eligible, no blockers, no architecture fact and 49 unchanged public snapshots.
13. Run `habit-hooks --branch origin/codex/ui-01-refined-tabs` on the final candidate. Exit 1; each retained smell has a reason in manager review. The snooze remains `[]` and no suppression is added.
14. Inspect registry, source/test diff, documents, screenshots, base/head pins and GitHub checks. Read back the final PR description and two maintained comments after publication. Human T1 approval remains required before merge.

Source comparison can temporarily check out its base. The first hosted image
build overlapped that comparison and captured the parent revision; its 7 runtime
passes and offline output are INVALID as UI-02 evidence and are retained under
the invalid-comparison filenames. After all comparisons stopped, the stable
final candidate and all 860 tracked input hashes were verified again. The image
gate was rerun with no comparison in progress, with an extra read-only hash
check of both compiled UI-02 modules in the resulting image. Builds, coverage
and source comparisons must run in sequence in this checkout.
