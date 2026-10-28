# Remove Quick start Connect button: environment gates

Base: 7e9cc19a2f4d82620e745273660e35a8f1a151f3
Primary HEAD at report: 3e5931a080c88e0331cdd27cc036b37efbd8d80c
Original frozen four-file overlay SHA256: 94c0ad18f61ef6c9c1b0720fada5e7bf2d19691aa8a83c07061a9c6306fd3161

| Selected command | Result | Test counts |
| --- | --- | --- |
| npm run test:container | Exit 0 | 11/11 passed |
| npm run build:hosted | Exit 0 | 3693 unit + 39 portal unit + 21 portal acceptance + 1219 integration + 189 hosted acceptance + 13 real local renderer passed |
| npm run test:hosted-live, through staging launcher | Exit 0 | 29/29 passed; 8 suites |
| npm run test:container:hosted | Exit 0 | 7/7 passed, final Linux AMD64 image |

All successful groups report zero failures, cancellations, skips and todo cases. Each gate passed on its first attempt; no source fix, timeout change, guard change or assertion skip was made by this worker. The actual AMD64 gate includes public HTTPS and controlled JavaScript rendering, private-address refusal, capacity, cancellation, SIGTERM, invalid startup, and its normal inner offline build/renderer checks. The full selected live group includes the unchanged removal constituent and token-expiry waits, plus the changed signup helper that follows Workspace navigation to Connect. Native and AMD64 hosted acceptance both passed all 189 cases, including the capacity/relay case.

## Input identity and scope

Self-hosted, native hosted build and staging live ran in the managed isolated checkout at the base plus the exact frozen four-file working diff. Its original patch and per-file SHA256 values remain in overlay.patch and candidate-provenance.json. The live helper hash is 2c728d0af6ff3511a745934ea7a0389e69b9a03ef123b757b3d08a249b7d85fa; the page source hash is 33c751acbe410d99cd9dc24f33f9cf6d5fca49b98a907da2d4bca5c764bbafc3. These files, the specification and impact declaration still match primary at report time.

The manager later authorized the AMD64 gate in primary after primary's ordinary/build/coverage work finished. It overlapped only with the already-built isolated live group; the two checkouts had no overlapping builds. Hosted image names/labels and mapped 8080 ports are unique; the live site's fixed 24443/24480 and disposable PostgreSQL mapping do not conflict. 04-hosted-container-provenance.json records that boundary.

The later docs/testing/test-list.md correction is a separate documentation-only overlay copied into isolated checkout after live completed. Its patch/hash are retained as documentation-supplement.patch/json. The generated immutable base metrics record is recorded there as non-gate input. Original gate provenance is unchanged; these documentation changes do not alter production, package/lock, or executable test inputs.

## Runtime, evidence and cleanup

Commands used actual pinned Node 24.20.0 and verified absolute Lightpanda 1.0.0. Dependencies were shared by a temporary isolated node_modules symlink with identical package/lock inputs. The runner prepended the actual pinned Node binary directory, passed only ordinary shell/tool variables and the expected renderer settings, and added WorkOS settings only through the established staging launcher for live. The default installed Playwright Chromium was used. No Axiom credential was needed by these selected offline/container/staging groups. Credential values were redacted before logs were written, including API-key and JWT-shaped values.

Paired logs/JSON retain exact commands, start/end times, exits and TAP counts. The AMD64 build-progress log retains the inner build results. The summary and artifact hash manifest are local review evidence; they require retained accessible links for PR publication. Tests own disposable Docker/volume and exact staging fixture cleanup. The final hosted gate label has no running container and the live HTTPS listener closed. The temporary isolated dependency symlink was removed after completion; primary dependencies remain in place. Primary candidate 3e5931a080c88e0331cdd27cc036b37efbd8d80c has clean git status, and source/helper/spec/root impact-config identities still match the tested frozen overlay. No production service, deployment, registry push, environment setting, global tool or Docker configuration changed. No source commit, push or PR was made by this worker.
