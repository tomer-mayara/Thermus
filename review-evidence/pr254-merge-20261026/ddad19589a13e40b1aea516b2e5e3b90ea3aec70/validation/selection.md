# PR 254 complete-candidate merge validation

Head: `ddad19589a13e40b1aea516b2e5e3b90ea3aec70` in the detached primary checkout `/Users/tomermayara/.codex/worktrees/c617/Thermus`.
Actual parent: `b630a76275d5809a498ae63e1cbc322086f4194f`.
Complete candidate base: `8c6d204e8588a664438ba8934ab36670b802525f`.
Docker profile: `colima-thermus-s25-merge`, retained for the stack.

The complete source candidate selects the full ordinary suite, types, portal, WorkOS staging, native image, hosted Linux AMD64 image, PostgreSQL and Collector groups. All 30 changed ordinary test files against main are listed in `focused-files.json` and run after a clean build. The PostgreSQL group retains all six runtime files and validates the inherited SQL fixture fix on this candidate.

The added Members form, confirmation and result navigation also select the documented Chromium gate: `npm run build:user-portal && npm run build && node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js`. It runs early, uses the real built portal/font assets at 390 by 844, and retains a screenshot through `THERMUS_BROWSER_EVIDENCE_DIR` in the current cache. Its browser driver routes requests to the in-process application transport and uses no live credential or fixed host listener. The gate covers keyboard open, cancel, confirm, selected membership scope and narrow layout. It is not part of ordinary or nested image globs.

Run frozen install, pinned Node, read-only API snapshot check, focused build/tests, Members browser, PostgreSQL, ordinary, types, portal, secure staging, native image, hosted AMD64 image, Collector, Habit Hooks against origin/main and diff check. Do not add a duplicate standalone npm check, whole interface suite or separate hosted offline build. Standalone search-live, renderer and Axiom interface-live groups are not selected. The hosted image includes its required real renderer and offline checks.

The runner retains explicit pins, all tracked hashes, source/test/build input fingerprints, exact commands/times/exits, actual child outcomes, log summaries/hashes and full Docker streams. The copied cache proof correction accepts numeric timestamps and requires exact offline RUN, DONE, no CACHED and six positive all-pass groups. Its actual/cached/nonmatching/failed-summary manual checks are retained in PR 253 validation evidence. Stop on a real gate or unresolved provenance failure; preserve all attempts.

The manager confirmed the separate PR 254 combined capture ended and host ports 46443/46480 were free before handoff. Reserve them for this runner's ordinary and staging phases; any later separate capture must coordinate with the manager. Native/hosted image gates use dynamic host publication and the nested offline checks bind in the image-build namespace. Axiom settings remain in the ordinary child process; WorkOS uses its configured Keychain launcher. No credential value is printed by the runner. The manager owns quality, metrics, architecture, human approval and publication. No release, deployment or new production resource is requested.
