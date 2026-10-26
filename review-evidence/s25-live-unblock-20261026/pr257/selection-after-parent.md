# PR257 selection after PR255 integration

Parent integration is confirmed. PR255 merged at `83281acfaff309ab07dd4636053b5593bc4976aa`, whose tree is identical to reviewed head `1a3e5a6638d71e03485e0280848ee5e025335382`. PR257 targets main at that merge and has the same actual merge base `1a3e5a6638d71e03485e0280848ee5e025335382`. The increment has 19 paths. See [merge and tree proof](../merge-255.json). This selection record does not claim a test pass.

Reviewed PR255 head: `1a3e5a6638d71e03485e0280848ee5e025335382`. Reviewed PR257 head: `e46c506811b8639f691304c423f4af5fe894955e`.

The manager checked the independent review against the pinned source diff and trusted PR255 policy. The earlier requirement to repeat the Public Connect pair for PR257 came from the complete stack against main `8c6d204e`. That comparison included the LocalHttpsSite helper change in PR255.

After PR255 integration, the PR257 increment changes three source files: the organization directory contract, the removal safety scan, and the WorkOS directory implementation. It changes no Public Connect proof, hosted-live helper, package command, or test-gate policy. The facts-page operation serves removal checks. The display-member refactor retains its output. The Public Connect pair uses unchanged membership/access reads and direct SDK consent or membership operations; it does not call the removal safety scan or facts-page operation.

Policy `docs/implementation/test-gate-policy.md` at PR255, lines 266–308, selects the named production gates when their behavior is affected. Lines 290–292 select the full hosted live command for WorkOS organization reads and changes. The Public Connect pair is not a blanket source gate. Its paired command in the test guide defines the selected group; it does not select that group for every source change.

Therefore the remaining live gate for PR257 after confirmed parent integration is `npm run test:hosted-live`. The separate Public Connect pair becomes N/A for that increment. PR255 still requires the pair because its helper change reaches the actual-script proof. Keep all original failed/deferred records at their execution pins; this new selection does not rename them as passing runs.

Previously accepted offline and quality evidence remains pinned to the original reviewed heads and inputs. The manager rechecked actual main, merge base, source tree, trusted policy and the 19 changed paths after integration. New changes require a new assessment.
