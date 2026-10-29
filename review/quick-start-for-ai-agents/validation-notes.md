# Quick start wording: focused validation

The primary source was frozen before checks. Repo edits are limited to the
shared title and lead in `src/interfaces/web/account/quick-start-content.ts`
and matching canonical text in `docs/design/admin-quick-start/guide.md`.
The copied Markdown heading retains “and connect Thermus”.

Frozen SHA256 values:

- Shared content: `e90e4ec93542c04ef770409faa84c54a1f350e57619b8972c5688d30f2e28ab9`.
- Canonical guide: `0c3220c3e928bf32f996711b6fe399c0a1e4c6810ab049b7efe67512a500ea1b`.
- External HTML: `75bd2b60b501245b7f0033c6b93bd73c8fd2c4f5d7db2cf5e825342553536b71`.

Commands, run from the primary checkout:

```sh
node --experimental-transform-types --test test/unit/html/quick-start-page.test.ts test/unit/html/quick-start-content.test.ts test/unit/html/quick-start-copy.test.ts test/acceptance/auth/hosted-quick-start.test.ts > ast-report/quick-start-for-ai-agents/focused.log 2>&1
THERMUS_BROWSER_EVIDENCE_DIR=/Users/tomermayara/.codex/worktrees/3e6e/Thermus/ast-report/quick-start-for-ai-agents/ui node --experimental-transform-types --test test/acceptance/auth/hosted-quick-start-browser.runtime.ts > ast-report/quick-start-for-ai-agents/browser.log 2>&1
```

Results: focused checks 14/14 passed; browser checks 2/2 passed. No skips or
cancellations. Raw logs are saved beside these notes. `git diff --check` passed.
No tests were added. No build, full suite, metrics, live gate, commit, PR, or
deployment was run by this worker.

Screenshots are in `ui/`: `quick-start-1024.png`, `quick-start-390.png`,
`quick-start-320.png`, and `quick-start-expanded.png`. The 1024-pixel and
390-pixel images were viewed. The exact title and paragraph are visible and
the longer heading wraps without clipping. Existing browser checks verified
closed and expanded layouts at 320, 390, and 1024 pixels with no horizontal
overflow or console, CSP, or script errors. Clipboard outcomes use stubs;
native host clipboard permission was not established.

## Separate artifact edit

External file:
`/Users/tomermayara/.codex/visualizations/2026/10/28/01a182af-8bdf-7111-a638-fa42b0c79e58/admin-quick-start.html`.

Its visible and copied text was updated separately from the repository diff.
The prior removal of the separate Connect setup button remains in place.
Before/after snapshots and `change.patch` are saved in `artifact/`.

`manual-check.log` records exact source and rendered title/paragraph matches,
the retained copied heading suffix, canonical paragraph equality after line-wrap
normalization, exact external artifact text, embedded Markdown equality after
sample organization substitution, and valid artifact inline script syntax.
All recorded equality checks are true. Historical PNGs were not changed.
