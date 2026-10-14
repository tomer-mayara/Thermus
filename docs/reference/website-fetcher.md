# Website fetcher

`WebsiteFetcher.fetchURL(url, signal?)` returns a `WebsiteFetchResult` for a successful HTTP response. The result has `requestedUrl`, `finalUrl`, and `html`. `requestedUrl` keeps the URL as supplied. `finalUrl` is the page URL after redirects. The HTML contains the rendered page.

The Lightpanda implementation accepts only `http:` and `https:` URLs. The constructor argument selects the executable: `new WebsiteFetcherLightpanda(executable)`. A nonempty value is the exact executable path, including spaces. An empty or missing value selects `lightpanda` from `PATH`. The fetcher reads no environment variable. The self-hosted server reads `LIGHTPANDA_BIN` when it starts and passes it to the constructor. Use an absolute path and verify the supported version before use. See [Lightpanda runtime setup](../lightpanda-runtime.md) for the pinned release, download checks, executable selection, and upgrade policy.

The fetcher uses JSON output, HTML dump, HTTP failure reporting, and the production readiness and network safety options:

```text
fetch --json --dump html --fail-on-http-error --wait-until networkidle --wait-ms 60000 --block-private-networks --block-cidrs <blocked CIDRs> --http-proxy '' <url>
```

The `--json` option provides HTTP status and fetch error data. The `--fail-on-http-error` option makes Lightpanda exit with code 22 for an HTTP status of 400 or above. A renderer error can use a different exit code. For example, a bot challenge can produce exit code 1 with `error: "BotChallenge"` and HTTP status 403 or 429. The fetcher checks the JSON status for completed renderer runs, including those with a nonzero exit code. Successful responses and successful redirects return the rendered HTML with the requested and final URLs.

The fetcher reports an HTTP status of 400 or above with the exported `WebsiteFetchHttpError`. Its `kind` property is `'http'`. Its `status` property contains the HTTP status when Lightpanda provides one. It is `undefined` when status metadata is unavailable. Its `cause` property contains the process error when one is available. This includes responses such as 403, 404, 429, and 500.

A renderer process that cannot start produces the exported `WebsiteFetchLaunchError`. Node reports such a failure with a system error code, for example `ENOENT` for a missing executable or `EACCES` for a file without execute permission or a directory. Some codes, such as `ENOEXEC` for an executable of another platform, come at once from the start call; the fetcher treats them in the same way. Its `kind` property is `'launch'`. Its `code` property is the system error code. Its `failure` property is `'missing'` for `ENOENT` and `'cannot-start'` for each other code. Its message names the executable and points to [Lightpanda runtime setup](../lightpanda-runtime.md), for example `Lightpanda executable "lightpanda" was not found. See docs/lightpanda-runtime.md for setup.` or `Lightpanda executable "lightpanda" could not start (EACCES). See docs/lightpanda-runtime.md for setup.` The message does not contain the requested URL. The `cause` property keeps the process error, which repeats the renderer arguments with the URL. A configured executable does not fall back to `PATH`. The MCP fetch tool does not pass this error on: the client gets `Page fetch failed`, and the completion record gets `fetch_failed`. The self-hosted server writes a [renderer setup report](mcp-fetch-tool.md#renderer-setup-report) with only the failure class and the code. Launch errors, killed processes, signals, timeouts, and the output limit remain distinct from HTTP errors and from each other, even when partial output contains a failed HTTP status. A DNS failure is not a launch error, even when its code starts with `E`. Other nonzero exits keep their process errors when no failed HTTP status is available. Exit code 22 still reports an HTTP error when status metadata is unavailable. Invalid JSON, incomplete output, and unsupported URL schemes also reject the request.

Lightpanda blocks private network destinations by default. The five-second readiness deadline includes navigation. If the child has exited when that deadline fires, the fetcher preserves its completion result. If the child is still running, the fetcher sends `SIGKILL`, waits for the process callback, and rejects with `Lightpanda readiness limit exceeded after 5000 ms`. It does not return partial HTML. The separate process timeout is 60000 ms, and the output limit is 32 MiB. Readiness does not guarantee that content that appears much later will be present.

The local HTTP tests use a fixture server on loopback. The `permitIPv4Fixture` test helper mocks DNS for the fixture hostname and adjusts the Lightpanda blocked CIDRs for that child process. This setting exists only in the test scope. The renderer gate uses the same helper. Production fetches keep private-network blocking enabled.

The optional `AbortSignal` belongs to one fetch. An already cancelled signal
starts no DNS or renderer work. Cancellation during DNS prevents renderer
startup. Cancellation during rendering removes the per-call listener and
readiness timer, requests `SIGKILL` once, and waits for the process callback.
The readiness deadline and cancellation share that one kill request. Completion
and failure also release those resources once; late callbacks cannot publish
success or repeat cleanup. Concurrent fetches keep separate resources and
signals. A cancellation observed at completion
takes priority over renderer errors and partial output. The fetcher rejects with
the signal's reason; the MCP boundary exposes only its safe cancellation result.

The unit tests cover executable selection by the constructor argument, the `PATH` fallback, a `LIGHTPANDA_BIN` value in `process.env` that the fetcher ignores, CLI options, HTML success, redirects, HTTP status errors, launch errors (`ENOENT`, `EACCES`, and `ENOEXEC` from the start call) and how they differ from HTTP, timeout, signal, output limit, and DNS failures, other process failures, invalid output, and unsupported URL schemes. One test runs two concurrent calls on one fetcher: both use the same executable, arguments, and limits, and each call gets its own result. The tests use process doubles and need no installed renderer:

```bash
pnpm test:unit
```

After you install and select the pinned runtime, run the [local renderer interface tests](../lightpanda-runtime.md#verify-rendering). These tests give `process.env.LIGHTPANDA_BIN` to the constructor, so their commands do not change. The separate public-site smoke test requires public network access. The runtime setup document gives both commands and the renderer gate, `npm run test:mcp:renderer`, which runs this fetcher in the production fetch tool. `npm run check` does not run any of these renderer tests.
