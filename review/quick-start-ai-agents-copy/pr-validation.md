## Validation

Candidate: [`0445dfa6e566bf99155a6bf8f4e65c7619b3c322`](https://github.com/tomer-mayara/Thermus/commit/0445dfa6e566bf99155a6bf8f4e65c7619b3c322). Trusted main base: [`cc2ed669d6821525e23c6ff3d6ddcdc6339862bd`](https://github.com/tomer-mayara/Thermus/commit/cc2ed669d6821525e23c6ff3d6ddcdc6339862bd). This is the full increment against main.

The `src/interfaces/web/` edit selects the ordinary suite, typecheck, portal build, self-hosted container, native hosted build, and Linux AMD64 image gate. Existing focused tests and browser cases verify the page, copied guide, escaping, CSP, and layout. No test was added or changed for this small reversible copy edit.

| Check | Result | Evidence |
| --- | --- | --- |
| Focused page/content/copy/acceptance | 14/14 passed | [Log](./focused.log) |
| Quick start Chromium, JavaScript on/off | 2/2 passed; 320/390/1024-pixel closed/expanded layouts, no overflow or console/CSP error | [Log](./browser.log), [desktop](./ui/quick-start-1024.png), [mobile](./ui/quick-start-390.png) |
| `npm test` | 5,685 Node + 60 portal tests passed | [Log](./npm-test.log) |
| `npm run typecheck` | Exit 0 | [Log](./typecheck.log) |
| `npm run build:user-portal` | Exit 0 | [Log](./portal-build.log) |
| `npm run test:container` | 11/11 passed | [Log](./environment-gates/01-self-hosted-container.log) |
| `npm run build:hosted` | Exit 0; 3,693 unit + 39 portal unit + 21 portal acceptance + 1,219 integration + 189 hosted acceptance + 13 renderer cases passed | [Log](./environment-gates/02-build-hosted.log) |
| `npm run test:container:hosted` | Exit 0; 7/7 final Linux AMD64 image cases passed; inner hosted checks also passed | [Log](./environment-gates/03-hosted-container.log), [full image report](./environment-gates/03-hosted-container-summary.md) |
| Unit + integration coverage | 3,693 Node unit + 39 portal unit + 1,219 integration cases passed; 241 files, 813 processes | [Log](./coverage.log), [verified coverage](./coverage.json) |
| Habit-hooks and committed-candidate checker | Exit 0; no scanner findings; T0 locally eligible with no blockers | [Habit result](./habit-hooks-result.json), [checker](./checker.json) |

Every test group reports zero failures, cancellations, skips, and todos. No retry was needed. Process exit 1 is the retained MI target miss, not a tool failure; Review, CRAP, and Architecture passed. The declaration probe ignored 33 compiler diagnostics in two unlisted files, verified all 53 listed snapshots, and the separate full typecheck passed. [Probe log](./checker.log).

No extra `npm run check` was dispatched; selected hosted builds retain their required nested checks. Hosted-live is **N/A** because no authentication, WorkOS operation, signup/live helper, or dedicated live test changes. Whole Members browser, separate renderer/Brave, SQL, Collector, and Render-interface groups are N/A because their selected behavior and drivers do not change. [Selection review](./independent-review.md).

Coverage was captured on base HEAD plus frozen candidate inputs with Node 24.20.0 and TypeScript 7.0.2. The final process verified compatibility with `0445dfa6` using source fingerprint `febc85f19232e1a103ef573e57c5f2048b8125db089baa120a492569758c73a7` and input fingerprint `e783142fdaeaf5165a090a279391176ecdd5aaa84d80eea0f411a2fd014b4def`. The report was not edited or restamped. Full normalized coverage and logs are retained; raw captures remain local.

Isolated gates ran the base plus exact frozen source/guide changes. Final comparisons verify matching production/test/package/lock/Docker inputs; the later impact declaration and immutable base metric record are separately identified metadata. [Native provenance](./environment-gates/native-provenance-final.json), [image provenance](./environment-gates/03-hosted-container-final-comparison.json).

The external HTML mockup was updated separately. Its visible text and copied Markdown match the requested wording; its old Connect action was removed to reflect the prior approved correction. Inline script syntax and canonical-copy equality passed. [Artifact checks](./artifact/manual-check.log), [artifact diff](./artifact/change.patch), [focused notes](./validation-notes.md). Clipboard success/denial uses browser stubs; native clipboard permission is not claimed.

### Production verification after merge

Merge `21458b0d18cc4f9efd3a59f6361a86f1acdc317c` has the same Git tree as candidate `0445dfa6`. Render deployment `dep-dbh8b77b9u1s73e901bg` became **live at 2026-10-28 23:34:26 UTC** on that exact merge SHA. Health GET/HEAD, portal/assets, signed-out guide denial, and the MCP authentication challenge passed. One authenticated MCP page-fetch call returned a non-empty text block without a tool error. The bounded post-deploy error/fatal log query was empty. [Full deployment report](./deployment/README.md), [HTTP results](./deployment/public-after.json), [source identity](./deployment/source-identity.json).

Positive Admin page/layout tests ran locally; this release check does not claim a new production Admin UI or native clipboard test. The separate [GitHub Hosted image run](https://github.com/tomer-mayara/Thermus/actions/runs/40787808346) failed before the build job started because GitHub reports recent failed payments or a spending limit that needs to increase. Render's existing Git-backed build completed independently. No billing or deployment mode changed. [Workflow annotation](./deployment/github-image-run.log).
