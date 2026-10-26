# UI-03 validation commands

Use Node 24.20.0 and pnpm 12.10.1. Every comparison uses
origin/codex/ui-01-refined-tabs at a017020e. The final candidate is 12d1a3c5.

1. pnpm install --frozen-lockfile: passed.
2. Focused BDD/TDD and browser runs: implementation/implementation-report.md
   names their red/green commands and logs; final focused 137 and browser 38 pass.
3. npm run test:logging:postgres: 26 pass.
4. npm run test:logging:collector: initial fixture dependency failure 8/10;
   corrected read-only mounts, full group 10 pass.
5. npm run test:hosted-live via the reviewed staging launcher: missing renderer
   first, then complete 28/29. A focused invitation diagnostic failed in setup
   on WorkOS's sandbox email quota. The selected live group is not passed.
6. npm test via the existing test-environment launcher: 5,135 ordinary and 49
   portal pass. The launcher supplies test Axiom settings and pinned Lightpanda,
   does not print values, and is excluded from publication.
7. npm run typecheck and npm run build:user-portal: pass.
8. npm run test:container: 11 pass.
9. npm run test:container:hosted: seven pass. Dockerfile.hosted runs the required
   build:hosted gate with network disabled; its exact build history is retained.
   No separate npm run check or duplicate local offline build was added.
10. pnpm exec node script/code-quality/ast-metrics-coverage.ts --suite integration:
    1,163 pass. Integration was already selected through npm test.
11. ast-metrics-snapshot.ts --base origin/codex/ui-01-refined-tabs and the head
    snapshot: pass. ast-metrics-process.ts with the same base and --json
    ast-report/process.json: exit 1 for retained Delta/Review goal misses;
    CRAP/Architecture pass. ast-metrics-crap.ts with the same base and --json
    ast-report/crap.json: pass. File inspections retained for the two low-MI
    renderer files. Generated metric reports were not edited.
12. habit-hooks --branch origin/codex/ui-01-refined-tabs: exit 1 with retained
    findings and reasons in manager review. Snooze stays empty.
13. Stamp committed .pr-impact.json with the actual head and parent merge base.
    Run script/pr-review/check.ts with --base origin/codex/ui-01-refined-tabs,
    --repo tomer-mayara/Thermus, --impact ast-report/impact.json, both snapshots,
    --crap ast-report/crap.json, --process ast-report/process.json,
    --review ast-report/review.json and --json. Exit 0, T1. checker.json retains
    the raw output, including the declaration-compiler diagnostic;
    checker-result.json is a separately parsed copy, not an edited source report.

Search-live, the separate Axiom-live interface command and a second renderer
command are not selected by this candidate. The hosted offline build already
selects renderer. No tests were added for documents or validation tooling.
Tracked source remained fixed during builds and Docker context capture. Metrics
comparison began only after functional gates stopped. Full candidate selection
against main is retained in complete-candidate-files.txt. Required live success
and independent current-candidate T1 human approval remain outstanding.
