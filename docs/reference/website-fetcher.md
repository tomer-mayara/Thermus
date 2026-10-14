# Website fetcher

`WebsiteFetcher.fetchURL(url, signal?)` returns a `WebsiteFetchResult` for a successful HTTP response. The result has `requestedUrl`, `finalUrl`, and `html`. `requestedUrl` keeps the URL as supplied. `finalUrl` is the page URL after redirects. The HTML contains the rendered page.

The Lightpanda implementation accepts only `http:` and `https:` URLs. A nonempty `LIGHTPANDA_BIN` value selects the executable path directly, including spaces. An empty or unset value selects `lightpanda` from `PATH`. Use an absolute path and verify the supported version before use. See [Lightpanda runtime setup](../lightpanda-runtime.md) for the pinned release, download checks, executable selection, and upgrade policy.

The fetcher uses JSON output, HTML dump, HTTP failure reporting, and the production readiness and network safety options:

```text
fetch --json --dump html --fail-on-http-error --wait-until networkidle --wait-ms 60000 --block-private-networks --block-cidrs <blocked CIDRs> --http-proxy '' <url>
```

The `--json` option provides HTTP status and fetch error data. The `--fail-on-http-error` option makes Lightpanda exit with code 22 for an HTTP status of 400 or above. A renderer error can use a different exit code. For example, a bot challenge can produce exit code 1 with `error: "BotChallenge"` and HTTP status 403 or 429. The fetcher checks the JSON status for completed renderer runs, including those with a nonzero exit code. Successful responses and successful redirects return the rendered HTML with the requested and final URLs.

The fetcher reports an HTTP status of 400 or above with the exported `WebsiteFetchHttpError`. Its `kind` property is `'http'`. Its `status` property contains the HTTP status when Lightpanda provides one. It is `undefined` when status metadata is unavailable. Its `cause` property contains the process error when one is available. This includes responses such as 403, 404, 429, and 500.

A missing selected executable produces a readable error that points to [Lightpanda runtime setup](../lightpanda-runtime.md) and keeps the process error in `cause`. A configured executable does not fall back to `PATH`. Launch errors, killed processes, signals, and timeouts remain distinct from HTTP errors, even when partial output contains a failed HTTP status. Other nonzero exits keep their process errors when no failed HTTP status is available. Exit code 22 still reports an HTTP error when status metadata is unavailable. Invalid JSON, incomplete output, and unsupported URL schemes also reject the request.

Lightpanda blocks private network destinations by default. The five-second readiness deadline includes navigation. If the child has exited when that deadline fires, the fetcher preserves its completion result. If the child is still running, the fetcher sends `SIGKILL`, waits for the process callback, and rejects with `Lightpanda readiness limit exceeded after 5000 ms`. It does not return partial HTML. The separate process timeout is 60000 ms, and the output limit is 32 MiB. Readiness does not guarantee that content that appears much later will be present.

The local HTTP tests use a fixture server on loopback. The `permitIPv4Fixture` test helper mocks DNS for the fixture hostname and adjusts the Lightpanda blocked CIDRs for that child process. This setting exists only in the test scope. Production fetches keep private-network blocking enabled.

The optional `AbortSignal` belongs to one fetch. An already cancelled signal
starts no DNS or renderer work. Cancellation during DNS prevents renderer
startup. Cancellation during rendering stops the child with `SIGKILL` and waits
for its process callback. Completion, failure, and cancellation remove the
per-call listener and readiness timer. A cancellation observed at completion
takes priority over renderer errors and partial output. The fetcher rejects with
the signal's reason; the MCP boundary exposes only its safe cancellation result.

The unit tests cover executable selection, CLI options, HTML success, redirects, HTTP status errors, missing executable, timeout, other process failures, invalid output, and unsupported URL schemes. They use process doubles and need no installed renderer:

```bash
pnpm test:unit
```

After you install and select the pinned runtime, run the [local renderer interface tests](../lightpanda-runtime.md#verify-rendering). The separate public-site smoke test requires public network access. The runtime setup document gives both commands. `npm run check` does not run either set of renderer tests.
