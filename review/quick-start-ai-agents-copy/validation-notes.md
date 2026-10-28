# AI Agents copy: focused validation

Repo edits: `src/interfaces/web/account/quick-start-content.ts` changes only the
shared step 1 title and lead. `docs/design/admin-quick-start/guide.md` matches the
generated copy. The existing “and connect Thermus” suffix remains in Markdown.

Commands, run from the primary checkout after source freeze:

```sh
node --experimental-transform-types --test test/unit/html/quick-start-page.test.ts test/unit/html/quick-start-content.test.ts test/unit/html/quick-start-copy.test.ts test/acceptance/auth/hosted-quick-start.test.ts > ast-report/quick-start-ai-agents-copy/focused.log 2>&1
THERMUS_BROWSER_EVIDENCE_DIR=/Users/tomermayara/.codex/worktrees/3e6e/Thermus/ast-report/quick-start-ai-agents-copy/ui node --experimental-transform-types --test test/acceptance/auth/hosted-quick-start-browser.runtime.ts > ast-report/quick-start-ai-agents-copy/browser.log 2>&1
```

Results: focused cases 14/14 passed; browser cases 2/2 passed. No skips or
cancellations. Raw logs are saved beside these notes. `git diff --check` passed.
No builds, full suite, metrics, live gate, commit, or deployment ran here.

Screenshots: `ui/quick-start-1024.png`, `ui/quick-start-390.png`,
`ui/quick-start-320.png`, and `ui/quick-start-expanded.png`.
Desktop and 390-pixel mobile images were viewed. The requested title and lead
are visible; the longer mobile title wraps without clipping. Browser checks
passed for closed and expanded layouts at 320, 390, and 1024 pixels and reported
no console, CSP, or script errors. Clipboard outcomes use stubs; native host
clipboard permission is not established.

## Separate visualization artifact

External file edited:
`/Users/tomermayara/.codex/visualizations/2026/10/28/01a182af-8bdf-7111-a638-fa42b0c79e58/admin-quick-start.html`.
This edit is outside the repository diff. The visible heading and paragraph,
and embedded copied Markdown, use the requested wording. The old separate
Open Connect setup button was removed to match the prior approved correction.
Historical PNGs were not changed.

`artifact/admin-quick-start.before.html`, `artifact/admin-quick-start.after.html`,
and `artifact/change.patch` preserve the artifact edit separately.
`artifact/manual-check.log` records the exact visible text, zero separate
Connect actions, valid inline script syntax, and canonical Markdown equality
after sample organization substitution, ignoring outer whitespace.
