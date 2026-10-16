# RHD-03: hosted image and runtime proof

Status: implementation and local verification complete; owner review and merge pending.
Date: 2026-10-15. [PR #117](https://github.com/3-headed-monkey/Thermus/pull/117).
Branch: `codex/rhd-03-hosted-image`, stacked on
[PR #116](https://github.com/3-headed-monkey/Thermus/pull/116), branch
`codex/rhd-02-hosted-portal`. Owner review and merge remain pending.

The [Render plan](render-hosted-docker-plan.md) defines this slice. It adds a
separate hosted Docker build, checks its outputs without live credentials,
and tests the final Linux AMD64 image. The [RHD-01 record](rhd-01.md) and
[RHD-02 record](rhd-02.md) retain the protected fetch, portal, startup, and
health contracts. The self-hosted image and Compose installation keep their
own contract and container gate. No Render service, production identity
configuration, deployment, or release is recorded.

## Build and runtime contract

The hosted build uses `Dockerfile.hosted` and its adjacent
`Dockerfile.hosted.dockerignore`, with the repository root as build context.
The runtime must depend on the completed offline checks. A failed check must
prevent a runtime image. The checks need no live WorkOS or Axiom credential
and run no nested Docker command. The [hosted offline build checks](test-gate-policy.md#hosted-offline-build-checks)
give the exact command selection and prerequisites.

The assembled image must contain the built backend and portal, production
packages with the working native cleaner, a checked Lightpanda 1.0.0, the
CA bundle, and the selected versioned production rules. It must run as a
non-root `node` user with telemetry off. It sets `DEPLOYMENT=hosted`,
`LISTEN_HOST=0.0.0.0`, `LISTEN_PORT=8080`, and the pinned
`LIGHTPANDA_BIN=/opt/lightpanda/1.0.0/lightpanda`. Build tools, test output, application
TypeScript source, local secrets, and Git metadata must stay out of the runtime.

The owner selected a pinned EasyList snapshot for the hosted production rules.
The candidate now includes the snapshot, provenance record, and full license.
The final Linux AMD64 image gate passed.
The [hosted image policy](../reference/ad-rules.md#hosted-image-policy)
links the pinned source, license, scope, and update process. The final image ships
the selected snapshot at `AD_RULES_FILE=/etc/thermus/ad-rules.txt`. The manager
reviewed the exact snapshot hash, license evidence, and fixture behavior. The file preserves
14 upstream lines with trailing whitespace to retain the pinned bytes.

## Verification

Write a failing acceptance specification first, then implement and run its
focused checks. Run each changed test and every applicable command from the
[test gate policy](test-gate-policy.md) on the complete candidate. A passed
host build or ARM64 run does not prove rendering in the final Linux AMD64
image. A final-image test does not prove WorkOS behavior or a Render deploy.

| Required evidence | Status |
| --- | --- |
| Initial failing acceptance specification | Worker reported `node --test test/acceptance/auth/hosted-image.runtime.ts`: exit 1, one failed test because `Dockerfile.hosted` was absent. The policy specification also failed when its source rules file was absent. Manager reviewed the red-first evidence. |
| Hosted offline checks | Final host sequence and final AMD64 image build passed: backend units 2,534/2,534; portal units 8/8; build 10/10; portal acceptance 4/4; integration 424/424; selected contracts 90/90; renderer 9/9. Zero failures, cancellations, skips, or todo cases. |
| Failed-check build refusal | Final gate passed: injected unit failure stopped the final-target build and produced no image; expected failure took 127.67 seconds. |
| `npm run test:container:hosted` | Exit 0: 8/8 tests, zero failures, cancellations, skips, or todo cases; 570.39 seconds. Final image is Linux AMD64, run with bundled Linux Rosetta. |
| Invalid hosted startup refusal in the final image | Both invalid settings and missing portal subcases passed in the complete final gate. |
| Each new or changed test | Focused hosted fetch/shutdown tests passed 9/9, path tests 21/21, and EasyList source specification 1/1 after its red run. The emitted policy case also passed in final offline and acceptance runs. All seven dedicated image subcases and their parent passed. |
| `npm run check` | Final post-fixture run exited 0: backend units 2,534/2,534 in 183 suites, portal units 8/8, build 10/10, portal acceptance 4/4, then Vite built the portal. Each report had zero failures, cancellations, skips, or todo cases. |
| `habit-hooks`, empty snooze file, and reasons for retained findings | Final post-fixture run exited 1 with the same 180 findings. Manager retained them with the reasons below. Snooze `[]` confirmed. |
| Integration | Final host offline sequence passed 424/424. |
| `npm run test:acceptance` | Final canonical command exited 0: backend 334/334 in 42 suites and portal source tests 4/4; zero failures, cancellations, skips, or todo cases. Dedicated image gates remain separate. |
| `npm run test:interface` | Final canonical command exited 0: 131/131 in 18 suites; zero failures, cancellations, skips, or todo cases. |
| Renderer gate | Final host offline sequence passed all 9 cases. |
| `npm run test:container` | Exit 0: 13/13 in one suite; zero failures, cancellations, skips, or todo cases; 242.20 seconds. |
| `npm run test:hosted-live`, Optional MFA | Exit 0: 77/77 in 16 suites; zero failures, cancellations, skips, or todo cases; 587.44 seconds after builds. |
| Manager review and sign-off | All code, EasyList provenance and license, test fixtures, worker work, local gate results, and scoped cleanup reviewed and signed off. |
| Ready and current-head Actions | See the current status of [PR #117](https://github.com/3-headed-monkey/Thermus/pull/117). |
| Owner review and merge | Pending |

The final canonical `npm run test:container:hosted` passed all eight tests
under bundled Linux Rosetta. It proved the six positive image/runtime cases
and the deliberate failed-unit refusal, with their parent. The log is
`/tmp/thermus-rhd03/hosted-image-final-rosetta-volume.log`. The final image is
`linux/amd64`, ID
`sha256:907af95c0a499deb2e0cfa68ecfba0d66e9b6cbb766615e2c4b84449b3cc1004`.
The positive BuildKit run was `j8lilx5djhfvtmj1a5qfbsuw7`; the expected
failed-check run was `oophlfgc8nzofa5pyz2g4b04f`, which made no runtime image.
The image build passed the same offline counts shown above, without live
credentials. This closes the final AMD64 rendering and failed-check proofs.
It does not record a Render deployment.

The final host offline sequence is in `/tmp/thermus-rhd03/offline-final.log`.
It ran `check`, all integration files, the complete 90-test contract selection,
and the real nine-case renderer gate with the pinned local executable.
The canonical acceptance and interface command logs are
`/tmp/thermus-rhd03/acceptance-final.log` and
`/tmp/thermus-rhd03/interface-final.log`. Each exited 0 with the counts above
and no failed, cancelled, skipped, or todo tests.

The final self-hosted container gate is in
`/tmp/thermus-rhd03/self-hosted-container-final.log`. The final hosted live
gate used the protected staging launcher and Optional MFA profile; its log is
`/tmp/thermus-rhd03/hosted-live-final.log`. This result does not claim a new
Required-profile run. The focused host logs are
`/tmp/thermus-rhd03/hosted-harness-focused.log` (9/9) and
`/tmp/thermus-rhd03/hosted-paths-revised.log` (21/21). The EasyList source
specification passed 1/1 after its failing run before snapshot replacement.
The completed application, live, and self-hosted gate results remain applicable.
The missing-portal fixture correction passed the complete AMD64 gate. The
final host check is in `/tmp/thermus-rhd03/check-post-fixture.log`; it exited 0
with the counts above. All required local checks and manager review are
complete, with retained habit-hooks findings documented below. Owner review
and merge remain pending. See [PR #117](https://github.com/3-headed-monkey/Thermus/pull/117)
for its current Ready state and head Actions status.

The earlier AMD64 attempts explain the local build and test corrections.
Their logs are under `/tmp/thermus-rhd03/`.

| Attempt | Result | Logs |
| --- | --- | --- |
| First build | Docker EOF; the kernel showed an out-of-memory failure during parallel emulated Rust compilation in the 4 GB VM. | `hosted-image-first.log` |
| Revised build | Check and integration passed; three total test allowances expired in the 90-test selection. No runtime image. | `hosted-image-revised.log` |
| QEMU 7.0 | One prebuild file failed without signal details. Diagnostic TAP confirmed SIGSEGV in a different file; both passed alone. No new out-of-memory failure. | `hosted-image-final-prebuild.log`, `hosted-image-diagnostic-all.tap` |
| QEMU 10.2.3 | Full units passed in isolation; the canonical attempt then stopped in Vite with esbuild's Go `lfstack.push invalid packing` error, before integration or runtime cases. | `hosted-image-diagnostic-qemu10-all.tap`, `hosted-image-final-qemu10.log` |
| First Rosetta gate | Built the final AMD64 image and passed the first five runtime subcases plus deliberate unit-failure refusal. The missing-portal fixture failed before application startup because its host temporary path was not shared by Colima. Overall: eight tests, six passed, two failed; 555.07 seconds. | `hosted-image-final-rosetta.log` |

The missing-portal fixture now uses an anonymous read-only Docker volume
with `volume-nocopy`; scoped cleanup removes that container's volumes. The
manager reviewed the test-only fix. Its focused proof and the complete final
gate both passed. The failed earlier run is not used as gate-pass evidence.

The build now reuses compiled production dependencies and sets
`CARGO_BUILD_JOBS=2` to bound compilation memory. The three affected total
test allowances are 30 seconds for emulation. Production limits remain fixed:
the deadline-exit cases still require 9.5 to less than 13 seconds of shutdown.
The image gate allows 60 minutes and has seven subcases plus its parent. Its
deliberate failure enters an existing unit file, before the later suites.

The QEMU 10.2.3 helper was pinned to
`tonistiigi/binfmt@sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0`.
The observed Go fatal error also appears in the
[Go QEMU build issue](https://github.com/golang/go/issues/69255). The manager
then enabled bundled Linux Rosetta through Lima 2.2.1 in the same VM, with
four CPUs and 4 GiB of memory, and preserved the cache and configuration
backups. An AMD64 Node diagnostic confirmed Rosetta mappings. Production
files stayed unchanged. The final gate after the test fixture correction
passed, as recorded above. The manager confirmed that both Colima and Lima
configurations match their exact pre-Rosetta backups. Normal Colima start
succeeded with the original four CPUs, 4 GiB, and QEMU 7.0.0 registration,
with no Rosetta handler. The temporary helper image was removed. Scoped
cleanup left no owned container, image, or anonymous volume.

## Retained habit-hooks findings

The final post-fixture run,
`/tmp/thermus-rhd03/habit-hooks-post-fixture.log`, exited 1 with 180 findings:
three complexity findings, one oversized function, one unused binding,
164 comment locations, and 11 oversized files. Its only change from
`habit-hooks-final.log` is the gate comment from line 69 to line 67. The
manager reviewed and retained that unchanged finding. The earlier final
report moved the verifier comment from line 9 to line 10.
The [RHD-02 retention record](rhd-02.md#retained-habit-hooks-findings) gives
the reasons for the 169 inherited findings. Those reasons still apply,
including the unchanged lifecycle owners and shifted comment locations in
`test/unit/test-support-paths.test.ts`.

The Docker-executed runtime verifier is an entry point in the unused-file
check. The manager corrected that entry-point configuration; it is not a
retained unused-file finding. `.habit-hooks/snooze.json` is `[]`. Retention
does not change the tool result to exit 0.

The eleven added or newly inspected comment locations have these reasons:

| Comment file and line numbers | Manager retention reason |
| --- | --- |
| `docker/verify-hosted-runtime.mjs`: 10 | Explain why placeholder settings can check the assembled application offline without a provider request. |
| `test/support/container/docker-cli.ts`: 25 | A Docker command can intentionally close stdin. Observing the pipe error prevents an unhandled `EPIPE` without masking the process exit status. |
| `test/support/container/hosted-image-gate.ts`: 67 | Explain why the copied failure-test context includes only build inputs, before Docker applies its own filtering, to exclude credentials and submodules. |
| `test/support/container/hosted-image-identity.ts`: 5, 6 | Keep the proof boundary: this seam is absent from the final image and replaces only external identity behavior. |
| `test/support/container/hosted-image-page.ts`: 19, 25, 26 | Explain controlled DNS and the exact local page exception while the real renderer child still runs and settles. |
| `test/support/container/hosted-image-probe.ts`: 1 | Explain why the probe runs from stdin with no mounted test dependency. |
| `test/support/processes/module-paths.ts`: 39 | Distinguish runtime-only test mounts from files in the final artifact. |
| `test/acceptance/auth/hosted-image.runtime.ts`: 20 | Explain dedicated gate discovery and the Docker and AMD64 prerequisites. |
