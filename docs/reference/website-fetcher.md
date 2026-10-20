# Website fetcher

`WebsiteFetcher.fetchURL(url, signal?)` returns a `WebsiteFetchResult` for a successful HTTP response. The result has `requestedUrl`, `finalUrl`, and `html`. `requestedUrl` keeps the URL as supplied. `finalUrl` is the page URL after redirects. The HTML contains the rendered page.

The Lightpanda implementation accepts only `http:` and `https:` URLs. The constructor argument selects the executable: `new WebsiteFetcherLightpanda(executable)`. A nonempty value is the exact executable path, including spaces. An empty or missing value selects `lightpanda` from `PATH`. The fetcher takes no setting, such as `LIGHTPANDA_BIN`, from the environment. Both production compositions read `LIGHTPANDA_BIN` when they start and passes it to the constructor. Use an absolute path and verify the supported version before use. See [Lightpanda runtime setup](../lightpanda-runtime.md) for the pinned release, download checks, executable selection, and upgrade policy.

The fetcher uses JSON output, HTML dump, HTTP failure reporting, and the production readiness and network safety options:

```text
fetch --json --dump html --fail-on-http-error --wait-until networkidle --wait-ms 60000 --block-private-networks --block-cidrs <blocked CIDRs> --http-proxy '' <url>
```

Each renderer run gets the environment of the server process with `LIGHTPANDA_DISABLE_TELEMETRY=true`. Without that variable, Lightpanda 1.0.0 sends telemetry to `telemetry.lightpanda.io` on each run, also a `fetch` run. The fetcher sets the value `true` also when the server environment does not set the variable or sets another value. It reads the server environment at each run and does not change it. See [Lightpanda runtime telemetry](../lightpanda-runtime.md#telemetry).

The `--json` option provides HTTP status and fetch error data. The `--fail-on-http-error` option makes Lightpanda exit with code 22 for an HTTP status of 400 or above. A renderer error can use a different exit code. A page failure can produce exit code 1 while its JSON still carries an HTTP status. A completed HTTP error can have `error: null`. The fetcher checks the JSON status for completed renderer runs, including those with a nonzero exit code. Successful responses and successful redirects return the rendered HTML with the requested and final URLs.

The fetcher reports an HTTP status of 400 or above with the exported `WebsiteFetchHttpError`. Its `kind` property is `'http'`. Its `status` property contains the HTTP status when Lightpanda provides one. It is `undefined` when status metadata is unavailable. Its `cause` property contains the process error when one is available. This includes responses such as 403, 404, 429, and 500.

A renderer process that cannot start produces the exported `WebsiteFetchLaunchError`. The fetcher knows such a failure by the `spawn` syscall of the Node error. Its `kind` property is `'launch'`. Its `code` property is the system error name that Node reports, for example `ENOENT` for a missing executable or `EACCES` for a file without execute permission or a directory. The constructor changes another value, such as `Unknown system error -86` for a Mach-O binary of another CPU, to `UNKNOWN`, so a report can show the code. Its `failure` property is `'missing'` for `ENOENT` and `'cannot-start'` for each other code. Some codes, such as `ENOEXEC` on macOS for an executable of another platform or `ENOTDIR` for a path through a file, come at once from the start call; the fetcher treats them in the same way. A system limit, `EAGAIN`, `EMFILE`, `ENFILE`, or `ENOMEM`, is temporary and not a setup failure, so it stays a process error. On Linux, the system gives a file that it cannot execute to `/bin/sh`, so that start does not fail: the process exits with a status, which is not a launch error. The error message names the executable and points to [Lightpanda runtime setup](../lightpanda-runtime.md), for example `Lightpanda executable "lightpanda" was not found. See docs/lightpanda-runtime.md for setup.` or `Lightpanda executable "lightpanda" could not start (EACCES). See docs/lightpanda-runtime.md for setup.` The message does not contain the requested URL. The `cause` property keeps the process error, which repeats the renderer arguments with the URL. A configured executable does not fall back to `PATH`. The MCP fetch tool does not pass this error on: the client gets `Page fetch failed`, and the completion record gets `fetch_failed`. The server writes a [renderer setup report](mcp-fetch-tool.md#renderer-setup-report) with only the failure class and the code. Launch errors, killed processes, signals, timeouts, and the output limit remain distinct from HTTP errors and from each other, even when partial output contains a failed HTTP status. A DNS failure and a failed kill are not launch errors, even when their codes start with `E`. Other nonzero exits keep the process error as their cause when no failed HTTP status is available. Exit code 22 still reports an HTTP error when status metadata is unavailable. Invalid JSON, incomplete output, and unsupported URL schemes also reject the request.

Lightpanda blocks private network destinations by default. The fixed 20-second readiness deadline includes navigation. If the child has exited when that deadline fires, the fetcher preserves its completion result. If the child is still running, the fetcher sends `SIGKILL`, waits for the process callback, and rejects with the exported `WebsiteFetchReadinessTimeoutError`. Its `category` property is `'readiness_timeout'`, its `budgetMs` property is `20000`, and its message is `Lightpanda readiness limit exceeded after 20000 ms`. The optional `cause` keeps the process error, which must stay out of client results and logs. It does not return partial HTML. The protected `FetchPage` use case reports this timeout through the [correlated failure diagnostic](mcp-fetch-tool.md#fetch-failure-diagnostics). The separate process timeout is 60000 ms, and the output limit is 32 MiB. The readiness allowance is not a request option or an environment setting. Readiness does not guarantee that content that appears much later will be present.

The local HTTP tests use a fixture server on loopback. The `permitIPv4Fixture` test helper mocks DNS for the fixture hostname and adjusts the Lightpanda blocked CIDRs for that child process. It keeps the other launch options of the fetcher, also the renderer environment. This setting exists only in the test scope. The renderer gate uses the same helper. Production fetches keep private-network blocking enabled.

The optional `AbortSignal` belongs to one fetch. An already cancelled signal
starts no DNS or renderer work. Cancellation during DNS ends the caller wait and prevents renderer
startup. RHD-01 adds a fixed five-second DNS wait. The system lookup itself
cannot be cancelled. A fetcher retains ownership of an unfinished lookup after
a timeout or abort and refuses further hostname lookups until it settles.
Late success or failure cannot start a renderer. Address-literal checks and
other fetcher instances remain independent. Normal concurrent calls remain
supported, and no DNS answers are cached. Cancellation during rendering removes
the per-call listener and
readiness timer, requests `SIGKILL` once, and waits for the process callback.
The readiness deadline and cancellation share that one kill request. Completion
and failure also release those resources once; late callbacks cannot publish
success or repeat cleanup. Concurrent fetches keep separate resources and
signals. A cancellation observed at completion
takes priority over renderer errors and partial output. The fetcher rejects with
the signal's reason; the MCP boundary exposes only its safe cancellation result.

`WebsiteFetchFailure` carries a typed `diagnostic` and an internal optional cause.
HTTP, launch, and readiness errors extend it. Other process and DNS failures keep
the original error as their cause. Cancellation retains the exact signal reason.
The boundary permits bounded status and exit numbers, known platform signals,
and exact known Node and renderer codes. Names include `OperationTimedout`,
`CouldntResolveHost`, `CouldntConnect`, `SslConnectError`,
`PeerFailedVerification`, `TooManyRedirects`, and read/send/receive failures,
from the pinned [Lightpanda error mapping](https://github.com/lightpanda-io/browser/blob/588f6223b9cae8a2406aeef035ed9363a3e404fd/src/sys/libcurl.zig).
Other names become `unknown`. No stderr or message inference supplies a code.
The [diagnostic contract](mcp-fetch-tool.md#fetch-failure-diagnostics) gives all
fields and limits. These fields report observed facts and do not prove which
network component failed or who returned an HTTP error.

The unit tests cover executable selection by the constructor argument, the `PATH` fallback, a `LIGHTPANDA_BIN` value in `process.env` that the fetcher ignores, CLI options, the renderer environment with `LIGHTPANDA_DISABLE_TELEMETRY=true` for each run, HTML success, redirects, HTTP status errors, launch errors (`ENOENT`, `EACCES`, and `ENOEXEC` or a code without a system error name from the start call) and how they differ from HTTP, timeout, signal, output limit, system limit, failed kill, and DNS failures, other process failures, invalid output, and unsupported URL schemes. One test runs two concurrent calls on one fetcher: both use the same executable, arguments, and limits, and each call gets its own result. The tests use process doubles and need no installed renderer. Each renderer child in these tests is a `RendererChildDouble` from `test/support/doubles/website-fetcher/renderer-process-double.ts`. Its `kill` records the signal and sends no signal, because `kill` on a `ChildProcess` that did not start sends the signal to the whole process group, also to the test runner. Thus a failed assertion that leaves a fetch open gives a normal test failure with its counts. The integration and acceptance tests that start this fetcher with a process double also give this double as the renderer child. Run the unit tests:

```bash
pnpm test:unit
```

After you install and select the pinned runtime, run the [local renderer interface tests](../lightpanda-runtime.md#verify-rendering). These tests give `process.env.LIGHTPANDA_BIN` to the constructor, so their commands do not change. Each of their renderer runs has telemetry off. The separate public-site smoke test requires public network access. The runtime setup document gives both commands and the renderer gate, `npm run test:mcp:renderer`, which runs this fetcher in the production fetch tool. `npm run check` does not run any of these renderer tests.
