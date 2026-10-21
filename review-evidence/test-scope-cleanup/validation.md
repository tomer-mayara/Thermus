## Validation evidence

Node 24.20.0; pnpm 12.10.1. Tests ran sequentially. The live hosted gate used the Optional MFA staging profile. No file under `src/` changed.

| Command | Result | Test cases |
| --- | --- | --- |
| `npm run test:unit` | Passed | 2726 |
| `npm run test:integration` | Passed | 950 |
| `npm run test:acceptance` | Passed | 459 |
| `npm run test:interface` | Passed | 63 |
| `npm run test:mcp:renderer` | Passed | 13 |
| `npm run test:mcp:search:live` | Passed | 1 |
| `npm run typecheck` | Passed | — |
| `npm run test:hosted-live` | Passed | 35 |
| `npm run test:container` | Passed | 11 |
| `npm run test:container:hosted` | Passed | 7 |

The four ordinary groups passed 4,198 tests in total. The focused modified cases and retained CLI failure acceptance cases passed 19 tests before the full group runs; the hosted-config case also passed after unused-import cleanup. The hosted command built the portal successfully.

The selection covers unit, integration, acceptance, and interface groups, plus the real consumers of the shared process-path helper: renderer, live search, hosted live, and both container gates. The nested hosted build stays within this selected union. Manual work-slice browser walks were not run; their offline component acceptance cases passed with the acceptance group.

Two stale comments in the hosted-server case module were corrected while the live gate ran. This changed no executable statement. Later container builds used the final file.

`git diff --check`, the changed Markdown link checks, and JSON/YAML parsing passed. No new test was added for this removal-only change. The retained tests supply the regression checks.
