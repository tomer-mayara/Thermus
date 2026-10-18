# Fetch a URL through MCP

`fetch-url.mjs` calls Thermus `getURLAsMarkdown` without an LLM client. It sends
`{url, reason}` and writes the returned Markdown to standard output. It uses the
MCP SDK for protocol negotiation and JSON or SSE responses.

The default endpoint is `https://app.thermus.ai/mcp`. Sign in through WorkOS in
your browser, or supply a Bearer credential yourself. The hosted backend accepts
**WorkOS Connect OAuth access tokens** with Thermus access. It does not accept
customer API keys.

Install the repository dependencies, including the client SDK and pinned Node:

```sh
pnpm install --frozen-lockfile
pnpm exec node --version
```

The version must be `v24.20.0`. Run all commands from the repository root. No
build is needed to run the script.

## Source layout

[`fetch-url.mjs`](fetch-url.mjs) is the command entry point. Its helper modules
live in `fetch-url/`: [`oauth.mjs`](fetch-url/oauth.mjs) coordinates OAuth,
[`browser.mjs`](fetch-url/browser.mjs) handles browser sign-in,
[`credential-store.mjs`](fetch-url/credential-store.mjs) stores credentials, and
[`errors.mjs`](fetch-url/errors.mjs) defines command errors.

## Sign in and fetch

Run this from a terminal on the same machine as your browser:

```sh
pnpm exec node script/fetch-url.mjs --login
pnpm exec node script/fetch-url.mjs \
  --url 'https://example.com/' \
  --reason 'Debug the page conversion' > page.md
```

The browser signs you in and selects your workspace when needed. Return to the
terminal after it finishes. The callback uses `http://127.0.0.1:46481/callback`;
that local port must be free. If the script cannot open your browser, it prints
the authorization URL on stderr for you to open on the same machine.

You can also run the fetch command first. With no supplied credential and no
saved grant, it starts sign-in when stdin and stderr are terminals. Redirecting
stdout to a Markdown file is supported. `--login` always starts a fresh
authorization and replaces the saved grant only after a successful exchange.
Do not pass a page URL, reason, or explicit credential with `--login` or
`--logout`.

Later fetches reuse the saved access token or refresh it before the request.
WorkOS sets the token lifetime; the script does not set a 30-day expiration.
Authentication has a five-minute limit, with a ten-second limit for each OAuth
network request. The fetch deadline starts after authentication finishes.

Use `--non-interactive` for a job that must not open a browser. It can use or
refresh an existing grant. If sign-in is needed, it fails with a local
instruction. OAuth is supported only for the default hosted endpoint. Other
endpoints require explicit credentials.

## Saved credentials and logout

On a supported POSIX local filesystem, the script stores one grant under
`$XDG_STATE_HOME/thermus/mcp-fetch/`, or
`~/.local/state/thermus/mcp-fetch/` when `XDG_STATE_HOME` is unset. A configured
`XDG_STATE_HOME` must be absolute. The directory is private (0700), and its
files are private (0600). Symlinks and unsafe ownership or permissions are
refused. Credentials are plaintext protected by file permissions, not an
encrypted vault.

One command at a time can prepare or change credentials. A second command
fails promptly if the store is busy. The lock is released before the MCP
request starts. An interrupted or failed refresh can require `--login`; the
script does not retry a refresh token whose use is uncertain.

```sh
pnpm exec node script/fetch-url.mjs --logout
```

Logout removes the local grant or failure marker. It keeps the lock file.
It does not revoke WorkOS authorization, end the browser session, or stop an
MCP request that already has an access token.

## Supply a credential

Explicit input bypasses OAuth and local credential storage. Even an empty
explicit value selects this mode and fails validation; it does not start
sign-in. Unset `THERMUS_API_KEY` before using browser OAuth.

Read the credential without echo in zsh, then pass it through the environment:

```sh
read -rs 'THERMUS_API_KEY?Connect OAuth access token: '
export THERMUS_API_KEY
printf '\n'
pnpm exec node script/fetch-url.mjs \
  --url 'https://example.com/' \
  --reason 'Debug the page conversion' > page.md
unset THERMUS_API_KEY
```

For stdin, use the same hidden read and send the value through a pipe. Stdin
replaces the environment value and must reach EOF:

```sh
read -rs 'THERMUS_API_KEY?Connect OAuth access token: '
printf '\n'
printf '%s' "$THERMUS_API_KEY" | pnpm exec node script/fetch-url.mjs \
  --api-key-stdin \
  --url 'https://example.com/' \
  --reason 'Inspect Markdown output'
unset THERMUS_API_KEY
```

Keep credentials out of command arguments and shell history. `THERMUS_API_KEY`
is the environment variable name; its name does not add API-key support to the
server.

Use `--endpoint` to select another MCP server. The endpoint must use HTTPS, or
HTTP on loopback (`localhost`, `127.0.0.0/8`, or `::1`). Redirects are refused.
Only select an endpoint that you trust with the supplied credential.

```sh
pnpm exec node script/fetch-url.mjs \
  --endpoint 'http://127.0.0.1:8080/mcp' \
  --url 'https://example.com/' \
  --reason 'Debug the local server' \
  --timeout-ms 10000
```

`--timeout-ms` sets the deadline for negotiation and the tool call. In explicit
credential mode it also includes stdin input.
The default is 60000 ms; accepted values are 100 through 300000 ms. A timeout
aborts network work and closes the MCP client. The script also closes the client
after success or failure.

Success returns exit status 0, with exact Markdown on stdout, including an empty
result. Failures return status 1, with a diagnostic on stderr and no Markdown.
Remote error text is omitted because it can contain credentials. Use the server
logs for details. Run `pnpm exec node script/fetch-url.mjs --help` for the options.

Run the focused offline tests after a clean build:

```sh
pnpm run build
pnpm exec node --test "dist/test/unit/script/*.test.js" "dist/test/interface/script/*.test.js" "dist/test/acceptance/script/*.test.js"
```

# Measure and review a pull request with ast-metrics

The commands below wrap the ast-metrics CLI for the process "Code quality review
with ast-metrics" in [AGENTS.md](../AGENTS.md). They carry the correct syntax
of the tool; do not call `ast-metrics` directly in that process. Run them from
the repository root; no build is needed. The `ast-metrics` executable must be
on PATH (`brew install ast-metrics/tap/ast-metrics` on macOS; the process is
verified with 0.43.1). The
[ast-metrics review guide](../docs/implementation/ast-metrics-review.md)
explains what each command reports, the configuration, and the limits of the
tool.

## Measure the delta

```sh
pnpm exec node script/ast-metrics-delta.ts [--base REF] [--min SCORE] [--no-compare]
```

Lists each TypeScript file that the branch adds or changes against the merge
base with `--base` (default `origin/main`), with its maintainability score:
the production files under `src/` first, lowest first, then the other files,
then the files without a measurement. Committed, staged, unstaged, untracked,
and renamed files count; deleted files do not. The goal of `--min` (default
85, an integer from 0 to 128) applies to the production files; a test file or
a support file is listed with `no goal`. Exit status 1 when a production file
is below the goal, else 0. The run writes the HTML report to `ast-report/`,
with `compare.html` for the comparison with the base; `--no-compare` skips
the comparison.

## Review the delta

```sh
pnpm exec node script/ast-metrics-review.ts [--base REF] [--max-findings N]
```

Prints the Markdown review of `ast-metrics review` against `--base` (default
`origin/main`) and writes it to `ast-report/review.md`: files whose score
dropped, new functions with more than 10 decision paths, new rule
violations, and the summary of the change. Exit status 1 when a finding of
severity high exists, else 0. Update the branch from the base first.

## Ask the MCP server

```sh
pnpm exec node script/ast-metrics-mcp.ts file <path> [--json]
pnpm exec node script/ast-metrics-mcp.ts complex [--limit N] [--max-cyclomatic N]
pnpm exec node script/ast-metrics-mcp.ts risky [--limit N]
pnpm exec node script/ast-metrics-mcp.ts overview
pnpm exec node script/ast-metrics-mcp.ts tools
pnpm exec node script/ast-metrics-mcp.ts call <tool> ['<json arguments>']
```

Starts `ast-metrics mcp`, makes one call over standard input and output,
prints the answer, and lets the server exit; no server stays behind. `file`
prints the score, the decision paths, and the lines of each function in a
file, lowest score first; `--json` prints the raw answer. The path is
relative to the current folder, or absolute inside the repository.
`--timeout-ms` sets the deadline (default 60000 ms; after a timeout the
command stops the server). Exit status 1 with one diagnostic line on stderr
for a file that is not in the analysis, an unknown tool, a timeout, a server
that exits before it answers, or a missing executable.

## Measure the coverage per function

```sh
pnpm run build
pnpm exec node script/ast-metrics-coverage.ts [--from DIR] [--out FILE]
```

Runs the unit suite of `dist/` with `NODE_V8_COVERAGE` set to a temporary
folder (the suite output goes to stderr) and writes `ast-report/coverage.json`:
for each function of `src/` that the suite loaded, its name, its range in the
build, its calls, and its covered share. `--from DIR` reads the coverage
files of an earlier run. The command needs no ast-metrics. Exit status 1 when
`dist/` is missing, the suite fails, or the coverage files do not come from
one build; then no report is written. The
[ast-metrics review guide](../docs/implementation/ast-metrics-review.md)
gives the details of the share.

## Take a snapshot

```sh
pnpm exec node script/ast-metrics-snapshot.ts [--base REF] [--out FILE] [--timeout-ms MS]
```

Writes the snapshot of the working tree to `ast-report/snapshot.json`, or to
`--out` (relative to the current folder): the global numbers of `src/`, the
`src/` communities with labels, members, references, and edges, and each
`src/` file with its metrics and functions, from one `ast-metrics analyze
src` run and one session of `ast-metrics mcp src`, so that only a change of
`src/` changes the communities. The file is written only after all calls
succeeded. `--timeout-ms` sets the deadline of the session (default 60000
ms). Exit status 1, with one diagnostic line on stderr, for a missing
executable, a failed analysis, or a failed call. With `--base REF`, the
snapshot is of the merge base of REF and HEAD: the command analyzes that
commit in a temporary worktree under the system temporary folder, removes
the worktree again (also after a failure, and on SIGINT or SIGTERM with exit
status 130 or 143), and writes `ast-report/snapshot-base.json` by default. A
run first removes the temporary worktrees that interrupted runs left, and
says on stderr how many. The worktree needs no `pnpm install`, and no hook
of the repository runs in it. The
[ast-metrics review guide](../docs/implementation/ast-metrics-review.md)
describes the file.

## Show the architecture delta

```sh
pnpm exec node script/ast-metrics-architecture.ts [--base REF] [--head FILE --base-snapshot FILE] [--touched FILES] [--timeout-ms MS] [--out FILE]
```

Prints the architecture delta of `src/` as Markdown: a header with the base
commit, one summary line (modularity, cross share, cycles, communities, base
→ head), and a Mermaid graph of the communities with their changes, or `The
map did not change.` Then it prints the complexity table of the changed
`src/` files: the maintainability and the decision paths of each file, base
→ head (`new`, `gone`, or `not measured` when a side has no value), and its
rank among the ten riskiest files of the head, or
`No production file changed.` By default it snapshots the merge base of
`--base` (default `origin/main`) in a temporary worktree and the working
tree, and the changed files follow the rule of the delta command; with
`--head` and `--base-snapshot` it reads two snapshot files and runs no tool
(`--touched` then names the changed files). Exit status 0 when the Markdown
is printed; 1 with one diagnostic line for a failure. The
[ast-metrics review guide](../docs/implementation/ast-metrics-review.md)
gives the matching rule, the encoding, and the rules of the table.

Run the focused offline tests after a clean build, and the live tests with
the real executable on PATH and the real unit suite:

```sh
pnpm run build
pnpm exec node --test dist/test/unit/script/ast-metrics-delta.test.js dist/test/unit/script/ast-metrics-review.test.js dist/test/unit/script/ast-metrics-mcp.test.js dist/test/acceptance/script/ast-metrics-delta.test.js dist/test/acceptance/script/ast-metrics-delta-goal.test.js dist/test/acceptance/script/ast-metrics-delta-failures.test.js dist/test/acceptance/script/ast-metrics-review.test.js dist/test/acceptance/script/ast-metrics-mcp.test.js dist/test/unit/script/ast-metrics-snapshot.test.js dist/test/acceptance/script/ast-metrics-snapshot.test.js dist/test/acceptance/script/ast-metrics-snapshot-failures.test.js dist/test/acceptance/script/ast-metrics-snapshot-base.test.js dist/test/acceptance/script/ast-metrics-snapshot-base-failures.test.js dist/test/acceptance/script/ast-metrics-snapshot-base-worktree.test.js dist/test/unit/script/ast-metrics-architecture.test.js dist/test/unit/script/ast-metrics-architecture-report.test.js dist/test/unit/script/ast-metrics-architecture-table.test.js dist/test/acceptance/script/ast-metrics-architecture.test.js dist/test/acceptance/script/ast-metrics-architecture-table.test.js dist/test/acceptance/script/ast-metrics-architecture-base.test.js dist/test/unit/script/ast-metrics-coverage.test.js dist/test/acceptance/script/ast-metrics-coverage.test.js dist/test/acceptance/script/ast-metrics-coverage-failures.test.js
pnpm exec node --test dist/test/acceptance/script/ast-metrics-mcp.live.js
pnpm exec node --test dist/test/acceptance/script/ast-metrics-coverage.live.js
pnpm exec node --test dist/test/acceptance/script/ast-metrics-snapshot.live.js
pnpm exec node --test dist/test/acceptance/script/ast-metrics-architecture.live.js
```
