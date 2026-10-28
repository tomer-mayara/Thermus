# Remove Connect setup button: focused validation

These checks ran in `/Users/tomermayara/.codex/worktrees/3e6e/Thermus` after
the three-file UI correction was frozen. The checked changes removed the
separate step 1 action, changed the live signup helper to use the Workspace
navigation link named Connect, and updated the design specification.
The main Connect navigation and copied Markdown guide stayed unchanged.

## Output provenance

The initial focused commands below returned their output through the command
tool. Their raw console output was not saved as a file. Their results here are
transcribed summaries of those tool results, not replacement raw logs.
No tests were repeated to prepare these notes.

The later browser evidence run saved its actual console output in
[browser.log](browser.log). Its screenshots are linked below.

## First focused attempt

```sh
pnpm exec tsx --test test/unit/html/quick-start-page.test.ts test/unit/html/quick-start-content.test.ts test/unit/html/quick-start-copy.test.ts test/acceptance/auth/hosted-quick-start.test.ts test/acceptance/auth/hosted-quick-start-browser.runtime.ts
```

Result: exit 1; 16 cases, 15 passed, 1 failed. No cases were skipped or cancelled.
The JavaScript-on browser case failed at the existing browser driver's
`page.evaluate` call in `QuickStartBrowser.checkClipboardOutcomes` with
`ReferenceError: __name is not defined`. The JavaScript-off browser case and
all 14 non-browser cases passed.

The failure came from the tsx transform of a callback sent into the browser.
The correction was to run the same source through Node's type transform,
without tsx callback instrumentation. No source or test change was made to
address that runner failure.

## Browser retry

```sh
node --experimental-transform-types --test test/acceptance/auth/hosted-quick-start-browser.runtime.ts
```

Result: exit 0; 2 cases passed, 0 failed, 0 skipped, 0 cancelled.
Both JavaScript-on and JavaScript-off cases passed. Node printed its standard
experimental type-transform warning. This output was not saved as a raw log.

## Focused page, content, copy, and composed acceptance checks

```sh
node --experimental-transform-types --test test/unit/html/quick-start-page.test.ts test/unit/html/quick-start-content.test.ts test/unit/html/quick-start-copy.test.ts test/acceptance/auth/hosted-quick-start.test.ts
```

Result: exit 0; 14 cases passed, 0 failed, 0 skipped, 0 cancelled.
The checks cover complete guide content, HTML and Markdown escaping, configured
URLs, visible audit instructions, CSP hashes, clipboard outcomes, selected
organization scope, role changes, and denied access.
This output was not saved as a raw log.

`git diff --check` also passed after these checks.

## Saved browser evidence run

```sh
mkdir -p ast-report/remove-connect-button/ui
THERMUS_BROWSER_EVIDENCE_DIR=/Users/tomermayara/.codex/worktrees/3e6e/Thermus/ast-report/remove-connect-button/ui node --experimental-transform-types --test test/acceptance/auth/hosted-quick-start-browser.runtime.ts > ast-report/remove-connect-button/browser.log 2>&1
```

Result: exit 0; 2 cases passed, 0 failed, 0 skipped, 0 cancelled.
The saved raw log reports a duration of 3582.744667 ms.

- [Desktop, 1024 pixels](ui/quick-start-1024.png)
- [Mobile, 390 pixels](ui/quick-start-390.png)
- [Small mobile, 320 pixels](ui/quick-start-320.png)
- [Expanded provider details and manual guide, 1024 pixels](ui/quick-start-expanded.png)

All four screenshots were viewed. The separate Connect setup action is absent,
the main Connect navigation remains, and no new overlap or clipping was seen
around step 1. The 320-pixel menu wraps within the viewport. Expanded provider
links remain readable. Browser checks verified no horizontal overflow in closed
and expanded views at 320, 390, and 1024 pixels, and no console, CSP, or script
errors. Visible buttons retained targets at least 48 pixels high.

## Limits

- Clipboard success and denial used browser stubs. Native host clipboard
  permission was not established.
- The expanded screenshot's manual textarea appears mostly blank at its
  captured scroll position. The browser checks separately verified populated
  Markdown, manual selection, and exact copied output.
- The modified live signup scenario was reviewed but was not run by this
  worker. These local runs did not access WorkOS staging or production.
- This worker ran no full suite or build and made no commit, push, PR, or
  deployment. Other workers own the complete-candidate checks.
