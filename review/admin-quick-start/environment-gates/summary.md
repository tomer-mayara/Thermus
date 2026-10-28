# Selected environment gates

Production candidate: e65d35020472dd6ee7fe2f4ec7b5b553441ef48a
Base: feeaad4d5f04212f033366c232180be4bd40da4c
Isolated checkout: /Users/tomermayara/.codex/worktrees/quick-start-validation/Thermus
Node: v24.20.0; pinned Lightpanda 1.0.0 from the primary ignored cache.

| Command | Result | Tests | Skipped / cancelled |
| --- | --- | --- | --- |
| npm run test:container | Pass, exit 0 | 11/11 | 0 / 0 |
| npm run build:hosted | Pass on retry, exit 0 | 3693 unit + 39 portal unit + 21 portal acceptance + 1219 integration + 189 hosted acceptance + 13 real renderer | 0 / 0 in each group |
| npm run test:container:hosted | Pass, exit 0 | 7/7, final Linux AMD64 image | 0 / 0 |
| npm run test:hosted-live, through staging launcher | Pass, exit 0 | 29/29; 8 suites | 0 / 0 |

## Invocation and environment

Each command ran sequentially through the ignored run-environment-gate.cjs wrapper. The wrapper retains ordinary shell/tool variables, prepends the actual pinned Node executable directory to PATH, selects the absolute verified renderer path, and disables renderer telemetry. No production environment, migrations, deployment, registry push, or global tool/configuration change ran. The WorkOS staging launcher injected its settings for the live command only. Default installed Playwright Chromium was used. Command, start/end times, exits, TAP totals, and redacted output are in the paired JSON/log artifacts.

Full live invocation: ./node_modules/.bin/node /Users/tomermayara/.config/thermus/with-workos-staging.cjs ./node_modules/.bin/node ast-report/run-environment-gate.cjs 04-workos-staging-live npm run test:hosted-live

The AMD64 gate built and exercised the final image, including public HTTPS and controlled JavaScript rendering, private-address refusal, capacity, cancellation, SIGTERM, and invalid startup. Its build ran the offline hosted checks and renderer proofs. The full inner build progress is retained separately. Gate-owned Docker containers were removed by test cleanup, and the live HTTPS listener closed.

## Failure and retry history

The initial pnpm exec invocation warned that its automatic dependency verification could not use a node_modules symlink as a hoist directory; it proceeded with the existing exact dependencies, and the self-hosted gate passed. A first direct hosted-build invocation stopped before any script with npm EBADDEVENGINES, because npm's shebang saw system Node 22.14.0 even though the wrapper ran Node 24.20.0. That failed attempt is 02-build-hosted.log/json. The wrapper-only PATH correction selects the actual pinned Node directory; 02b-build-hosted passed. No source, timeout, assertion, or test selection changed for this retry.

## Live test-only overlay

Before the live gate, the manager-approved test/acceptance/auth/hosted-live/signup-server.ts was copied from the primary checkout. SHA256: 785e337655eeb109a963368f1f440e84cefe637ef9512db75578509a8e97c68d. Primary HEAD at copy: e65d35020472dd6ee7fe2f4ec7b5b553441ef48a; the helper change was pending commit. Its only behavior change follows /quick-start after creation, checks the guide heading, organization/session context, then opens Connect before the existing connection assertions. The overlay patch and identity are retained. Production and package/lock inputs remain exactly e65d35020472dd6ee7fe2f4ec7b5b553441ef48a; the primary helper still matches the tested overlay hash. Final committed-candidate evidence must bind this overlay to its eventual commit.

No source fix or commit was made by this gate worker. All logs copied to the primary ignored ast-report/environment-gates directory contain no injected credential values; the live runner replaces the injected API key before writing output. No JWT-shaped values required additional redaction (0 matches).
