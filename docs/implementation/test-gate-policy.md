# Test gate policy

This policy gives the test commands and gates for a Magumagu pull request.
[AGENTS.md](../../AGENTS.md) gives the rules, and this policy gives the details.
If the two disagree, follow AGENTS.md and correct this policy.

## Suite commands

Run each command from the repository root. `pnpm <script>` runs the same
package script. Each command that runs `dist/` output makes a clean build first.

| Suite | Command | Selects | Needs |
| --- | --- | --- | --- |
| Unit | `npm run test:unit` | `dist/test/unit/**/*.test.js` | Offline. No renderer. |
| Build | `npm run test:build` | `test/unit/build-output.test.ts`, from source | Offline. It builds temporary projects with the real compiler. |
| Integration | `npm run test:integration` | `dist/test/integration/**/*.test.js` | Offline. |
| Acceptance | `npm run test:acceptance` | `dist/test/acceptance/**/*.test.js` | Offline. |
| Interface | `npm run test:interface` | `dist/test/interface/**/*.test.js` | Lightpanda 1.0.0 and public network access. |
| All | `npm test` | `dist/test/**/*.test.js`: the unit, integration, acceptance, and interface suites | Lightpanda 1.0.0 and public network access. |

`npm run check` runs `npm run typecheck`, `npm run test:unit`, and
`npm run test:build`. It does not run the integration, acceptance, or interface
suites. `npm test` does not run the build test, because `tsconfig.build.json`
excludes it from `dist/`.

The interface suite needs the pinned Lightpanda executable. It also contains a
public-site smoke test that needs public network access.
[Lightpanda runtime](../lightpanda-runtime.md#verify-rendering) gives the setup
and separate commands for the local fixture tests and the smoke test.

A change that adds a prerequisite to a suite adds it to this table.

## Focused commands

Run a new or changed test file:

```sh
npm run build && node --test dist/test/<suite>/<path>.test.js
```

Run one case in that file. The pattern is a regular expression:

```sh
npm run build && node --test --test-name-pattern="<test name>" dist/test/<suite>/<path>.test.js
```

Make sure that the report shows the name of each test that you selected. The
build test runs from source and needs no build:

```sh
node --test --test-name-pattern="<test name>" test/unit/build-output.test.ts
```

## Required runs

Before each commit, run each new or changed test with a focused command. This
includes a test that `npm run check` does not run.

Before Ready, do these runs on the complete candidate. The complete candidate
contains every change of the pull request.

1. Run `npm run check`.
2. Run `habit-hooks` from the repository root. Correct each enforced smell, or
   give the reason that you keep it. Keep `.habit-hooks/snooze.json` as `[]`.
3. Run each new or changed test with a focused command.
4. Run the applicable suites:
   - `npm run test:integration` and `npm run test:acceptance` for a change that
     affects the MCP server, authentication, or the access context.
   - `npm run test:integration` for a change in `test/integration/`.
   - `npm run test:acceptance` for a change in `test/acceptance/`.
   - The interface tests that cover a changed renderer runtime, network policy,
     or patched dependency.

If you are not sure that a suite applies, run it.

Record each command and its result in the commit message or the pull request
notes. Give the exit status and the counts that Node reports for tests, passes,
failures, skipped tests, and todo tests. If you cannot do a required run, record
the reason. Do not record that run as a pass.

## Evidence rules

- A run gives evidence of a pass only when it exits with status 0 and its report
  shows each required test as passed.
- A command that selects zero tests does not give evidence of a pass.
  `node --test` reports `tests 0` and exits with status 0 when its glob matches
  no file.
- A skipped test is not a pass of that test. A todo test is not a pass of that
  test. Node exits with status 0 for both.
- A name pattern that matches no test does not give evidence of a pass. Node
  then reports the file as one passing test.

## Pull request steps

1. Open a draft pull request first.
2. Do the [required runs](#required-runs).
3. Update the documents that the change affects in the same pull request.
4. Mark the pull request Ready. Wait for every Actions job that starts for its
   head to pass. A started job that is pending, skipped, cancelled, or failed is
   not a pass.
5. If you must make a fix after Ready, return the pull request to Draft first.
   Then continue from step 2 with the new candidate.
6. The review is manual. The manager reviews the work of each subagent. The
   owner reviews the pull request. No agent reviewer runs on it.
7. Merge a clean pull request one time. The owner merges a pull request that
   adds a decision record under `architecture/decisions/`.

A Delamain worker run does the required runs and none of the pull request steps.
For a Delamain ticket, the session opens and merges the pull request one time
each. A restart reuses the same pull request and merge result.

## Actions jobs

This repository has no workflow in `.github/workflows/` now. No Actions job
starts for a pull request head. The required runs give all gate evidence.

If a change adds a workflow, the AGENTS.md wait rule applies to every job that
starts for the head. The required runs stay required. That change also updates
this section.

## Later gates

Later tickets add these suites. They have no command yet. The ticket that adds a
suite also adds its explicit command to `package.json` and to the suite table.
A suite must not depend on another command that selects it silently.

### Hosted live gate (AUTH-06)

AUTH-06 adds `test/acceptance/auth/hosted.live.ts` and a dedicated command. The
`.live.ts` name does not match the `*.test.js` globs on purpose. Thus `npm test`
and `npm run test:acceptance` do not select it. If the required hosted
credentials are missing, the command must fail with a clear setup error.

The hosted gate passes only when the dedicated command runs with the required
credentials and every live test passes. Missing hosted credentials, a setup
error, and skipped live tests can never count as a successful hosted gate. Do
not put credentials in the repository, in logs, or in pull request notes.

### Container gate (AUTH-09)

AUTH-09 adds the container acceptance suite
`test/acceptance/auth/self-hosted-container.test.ts` and its own explicit
command. The suite runs with a real image, normal production telemetry settings,
and outbound access denied. Only a run of the dedicated command under these
conditions is a container gate pass. A container run with outbound access
allowed is not a container gate pass. A container run with changed telemetry
settings is not a container gate pass. The file name also matches the acceptance
glob. A run of that file through `npm test` or `npm run test:acceptance` is not
a container gate pass.

## Gate sources

These files state test commands or gates. Keep them consistent with this
policy. Update them in the same pull request as a gate change.

- [AGENTS.md](../../AGENTS.md): pull request rules, test types, and Delamain
  worker limits.
- [CLAUDE.md](../../CLAUDE.md): Claude model rules. It includes AGENTS.md.
- [package.json](../../package.json): the exact suite commands.
- [README.md](../../README.md#build-and-test-commands): the script list, build
  behavior, and suite prerequisites.
- [Test inventory](../testing/test-list.md): executed and pending test cases,
  with focused commands.
- [Authentication implementation plan](../design/authentication-design.md#verification-and-release-gates):
  planned authentication suites and release gates.
- [Lightpanda runtime](../lightpanda-runtime.md#verify-rendering): renderer
  setup and interface test commands.
