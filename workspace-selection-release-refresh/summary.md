# Workspace picker release refresh

All requested checks passed in the isolated managed worktree:

`/Users/tomermayara/.codex/worktrees/workspace-picker-checks/Thermus`

- Candidate: `e36e34c9304444312b52d76cc1c91aa365ccc719`.
- Applicable base: `a421afc056ce3e400f2779c75683ea45270b96cb`.
- Node: `v24.20.0`, pinned through `PATH`.
- Renderer: `/Users/tomermayara/git/Thermus/.cache/lightpanda/1.0.0/lightpanda`.
- Dependencies: `pnpm install --frozen-lockfile` passed with pnpm 12.10.1.
- Final `git status --porcelain`: empty.

## Sequential checks

| Check | Result | Seconds | Log |
| --- | --- | ---: | --- |
| `npm test` | Passed: 5,372 compiled tests and 51 portal tests, zero failures or skips | 473.010 | `ordinary.log` |
| `npm run typecheck` | Passed | 1.914 | `typecheck.log` |
| `npm run build:user-portal` | Passed | 1.223 | `portal-build.log` |
| `npm run build:hosted` | Passed, including final renderer 13/13 | 144.711 | `hosted-build.log` |
| `npm run test:container` | Passed: 11/11, zero failures or skips | 513.061 | `self-hosted-container.log` |
| `node --test --test-timeout=30000 --test-reporter=tap dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js` | Passed: 83/83, zero failures or skips | 53.702 | `browser.log` |

Every command exited 0. The browser run used
`THERMUS_BROWSER_EVIDENCE_DIR` set to this directory's `browser/` folder. Full
command arrays, UTC start times, exit codes, elapsed times, and provenance are
in `provenance.json`. Frozen dependency setup output is in `install.log`.
A read-only build progress snapshot is in `container-build-progress.log`.

The container gate's image preparation was quiet because its driver captures
`docker build --quiet` output until completion. It completed successfully;
no retry, timeout change, source fix, or test change was needed.

The worker made no source, test, configuration, document, commit, push, PR,
production, or metric changes. It ran no build in the canonical 026d worktree.
All test builds ran in the managed isolated checkout; only this evidence was
saved in the canonical evidence directory. No extra standalone `npm run check`
was added. No staging live gate was selected. The root owns the separate native
Linux AMD64 image workflow, coverage, metrics, review, and release decision.

The managed worktree remains attached. It must stay available until the root
confirms that all evidence is preserved and authorizes its archive.
