# Lightpanda runtime

Thermus supports the official Lightpanda **1.0.0** release. The renderer is an external executable. `pnpm install` does not install it. The [release page](https://github.com/lightpanda-io/browser/releases/tag/1.0.0) provides four platform assets. The recipe below pins that release and checks each asset against its recorded SHA256 digest. The [container image](#container-image) holds the pinned Linux executable, so a container needs no installation.

Use macOS or Linux on x86-64 or ARM64. The Linux binary requires glibc; Alpine Linux with musl is not supported by this recipe. On Windows, run the Linux recipe inside WSL2. See the [official installation guide](https://lightpanda.io/docs/open-source/installation/) for WSL2 setup.

The macOS ARM64 asset download, SHA256 digest, and `version` output were verified. The 29 local renderer interface tests and the renderer gate passed with that executable. The Linux ARM64 executable runs in the container gate. The final Linux AMD64 hosted image passed real HTTPS and JavaScript rendering in [RHD-03](implementation/rhd-03.md#verification). [SEARCH-06](implementation/search-06.md#complete-candidate-results) also records a passing AMD64 image gate, including both local fetch and search renderer tests in its offline build. These are dated results for their recorded candidates. The macOS x86-64 asset was not exercised.

## Install the pinned release

Run this block from the repository root in a POSIX shell. It needs `curl`, `mktemp`, and `awk`, plus `shasum` on macOS or `sha256sum` on Linux. It saves the verified executable in the ignored `.cache/lightpanda/1.0.0/` directory. It does not need `sudo` or change a global installation.

```sh
(
  set -eu
  lightpanda_version=1.0.0
  case "$(uname -s)" in
    Darwin) lightpanda_os=macos ;;
    Linux)
      getconf GNU_LIBC_VERSION >/dev/null 2>&1 || {
        printf '%s\n' 'This recipe requires Linux with glibc.' >&2
        exit 1
      }
      lightpanda_os=linux
      ;;
    *) printf '%s\n' 'Use macOS, Linux with glibc, or WSL2.' >&2; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) lightpanda_arch=x86_64 ;;
    arm64|aarch64) lightpanda_arch=aarch64 ;;
    *) printf '%s\n' 'Use an x86-64 or ARM64 machine.' >&2; exit 1 ;;
  esac
  case "$lightpanda_arch-$lightpanda_os" in
    aarch64-linux) lightpanda_sha256=69791924bcee43b13b224af4c845622c5fe66fdbc1b8143bfaa39ca8f85244f5 ;;
    aarch64-macos) lightpanda_sha256=955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d ;;
    x86_64-linux) lightpanda_sha256=aa5a4b8ed53d1e38b3c73f5b2647d0a84a82e6744557f45f9a9c85858aa031c3 ;;
    x86_64-macos) lightpanda_sha256=e510299683b37a203912eac0ee00732224b2ef9b07fe58e69c467f5255be45e2 ;;
  esac
  lightpanda_asset="lightpanda-$lightpanda_arch-$lightpanda_os"
  lightpanda_dir="$(pwd -P)/.cache/lightpanda/$lightpanda_version"
  mkdir -p "$lightpanda_dir"
  lightpanda_download=$(mktemp "$lightpanda_dir/download.XXXXXX")
  trap 'rm -f "$lightpanda_download"' 0
  curl --fail --location --proto '=https' --tlsv1.2 \
    --output "$lightpanda_download" \
    "https://github.com/lightpanda-io/browser/releases/download/$lightpanda_version/$lightpanda_asset"
  if [ "$lightpanda_os" = macos ]; then
    lightpanda_actual=$(shasum -a 256 "$lightpanda_download" | awk '{print $1}')
  else
    lightpanda_actual=$(sha256sum "$lightpanda_download" | awk '{print $1}')
  fi
  if [ "$lightpanda_actual" != "$lightpanda_sha256" ]; then
    printf '%s\n' 'Lightpanda SHA256 check failed. The file will not be installed.' >&2
    exit 1
  fi
  chmod 755 "$lightpanda_download"
  mv "$lightpanda_download" "$lightpanda_dir/lightpanda"
)
```

Continue only if the block succeeds. Select the installed executable and verify its version:

```sh
export LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda"
"$LIGHTPANDA_BIN" version
```

The command must print `1.0.0`. Keep the export in the shell that starts the application or tests. The [fetcher contract](reference/website-fetcher.md) lists the required CLI options and process limits.

## Container image

The self-hosted image holds the pinned renderer. The image build downloads the official Linux asset of the target platform: `lightpanda-x86_64-linux` for `linux/amd64` and `lightpanda-aarch64-linux` for `linux/arm64`. The release has no other Linux asset, so the image supports only these two platforms. A build for another platform stops, because the `Dockerfile` has no `lightpanda-asset-<architecture>` stage for it: BuildKit reports that it cannot pull an image with that name. The [`Dockerfile`](../Dockerfile) gives each download the Linux digest that the recipe above records, and BuildKit stops a download that does not match with `digest mismatch`. Then [`docker/check-lightpanda-digest.sh`](../docker/check-lightpanda-digest.sh) checks the asset again before the install. Thus an asset from another source, for example a build context with the name `lightpanda-asset`, also stops the build, with this error:

```text
Lightpanda SHA256 check failed for linux/arm64: the asset has the digest <digest>, but docs/lightpanda-runtime.md records <digest>. The image build stops.
```

A container start downloads nothing. The image sets these settings:

- `LIGHTPANDA_BIN=/opt/lightpanda/1.0.0/lightpanda`. The executable and its directory belong to root, and the mode of the executable is `0755`, so the `node` user of the image cannot change them.
- `LIGHTPANDA_DISABLE_TELEMETRY=true`. Without this variable, each Lightpanda 1.0.0 run sends telemetry to `telemetry.lightpanda.io`, also a `fetch` run. Any value of the variable turns telemetry off. The fetcher also sets it for each renderer run. See [Telemetry](#telemetry).

The renderer reads the CA certificates of the system for HTTPS pages. Node uses its own certificates. The slim Node image has no CA certificates: without them, the renderer logs `No certificates loaded`, and each HTTPS page fails with `PeerFailedVerification`. Thus the image copies `/etc/ssl/certs/ca-certificates.crt`, the bundle of the Debian `ca-certificates` package, from the pinned Rust image of the build, which has the same Debian release. The bundle changes when that image changes.

The fetcher keeps its options in the container: the network block list, the readiness and process limits, and the output limit. The [container gate](implementation/test-gate-policy.md#container-gate) proves the renderer of the image without outbound access. It cannot reach a public HTTPS page. A manual check with network access fetched `https://example.com/` with the production options in a `linux/arm64` container of the image.

### Hosted image

[`Dockerfile.hosted`](../Dockerfile.hosted) uses the same pinned Linux assets,
digest checks, executable path, CA bundle source, and telemetry setting. It
adds the built portal and versioned hosted rules. The separate
[`Dockerfile.hosted.dockerignore`](../Dockerfile.hosted.dockerignore) includes
the build and test inputs, including `script/` for the debug-client tests,
and excludes local environment files and keys. The failed-check proof copies
the same script inputs into its temporary build context.
The build runs `npm run build:hosted` without external network access,
including both real local fetch and search renderer gates with its bundled
executable. It excludes the separate public Brave search proof. It then
checks the assembled outputs with production dependencies as `node`.

Run the final image proof with Docker Engine, Buildx, and a native or emulated
Linux AMD64 builder and runtime, plus public HTTPS egress to `https://example.com/`:

```sh
npm run test:container:hosted
```

The gate uses the final image and its real packaged renderer. Ordinary suite
commands explicitly exclude `hosted-image.test.js` from their globs. The [hosted image gate](implementation/test-gate-policy.md#hosted-image-gate)
gives the prerequisites and evidence rules. The [RHD-03 record](implementation/rhd-03.md#verification)
records the completed AMD64 runtime proof; the
[SEARCH-09 record](implementation/search-09.md) owns the search PR's final gate results.
Digest or version evidence, a successful build, and an ARM64 rendering pass
do not replace a final AMD64 image gate. WorkOS live behavior
and Render deployment need their separate proofs.

## Select the executable

Both production compositions read `LIGHTPANDA_BIN` from their environment when they start and give the value to the fetcher constructor. The fetcher takes no setting, such as `LIGHTPANDA_BIN`, from the environment. A nonempty value selects the executable. Use an absolute path so it works from any working directory. Paths with spaces work when quoted in shell commands:

```sh
export LIGHTPANDA_BIN="/absolute/path with spaces/lightpanda"
"$LIGHTPANDA_BIN" version
```

The fetcher passes the value directly as the executable path. It preserves spaces. The value is not a shell command; do not append flags or include quote characters in the value. For the self-hosted server, if `LIGHTPANDA_BIN` is empty or unset, the fetcher runs `lightpanda` from `PATH`. To use that fallback, verify it first:

```sh
unset LIGHTPANDA_BIN
command -v lightpanda
lightpanda version
```

A selected executable that is missing or cannot start produces an error that points to this document and keeps the process error in `cause`. A configured path does not fall back to another executable. The fetcher does not run a version check on each fetch. Self-hosted startup does not run or check the renderer. A self-hosted server with a missing executable starts. Each page fetch then fails with `Page fetch failed: Renderer could not start (ENOENT)` and a `fetch_failed` completion record. Clients and completion records do not get the fetcher error. The server log gets a [renderer setup report](#renderer-setup-report). The operator must verify the runtime before use with the commands above.

Hosted startup requires an absolute `LIGHTPANDA_BIN` path. After trusted rules and
the native cleaner load, it runs the executable directly with `version`, with
telemetry off. Trimmed stdout must equal `1.0.0`. The check has a fixed
5,000 ms timeout and a 1,024-byte limit for each output stream; it uses
`SIGKILL` when the child exceeds a bound. A missing setting, relative path,
start failure, nonzero exit, wrong version, timeout, or excessive output stops
startup before listening. The safe error starts with
`Hosted renderer setup failed: LIGHTPANDA_BIN` and points to this guide. It
shows no executable path, child output, or raw cause. The check proves the
local version command; `/healthz` does not prove page rendering or WorkOS
reachability. See [RHD-02](implementation/rhd-02.md).

## Telemetry

Lightpanda 1.0.0 sends telemetry to `telemetry.lightpanda.io` on each run, also a `fetch` run, when `LIGHTPANDA_DISABLE_TELEMETRY` is not set. Any value of the variable turns telemetry off. The fetcher starts each renderer run with the environment of the server and `LIGHTPANDA_DISABLE_TELEMETRY=true`. Thus telemetry is off also when the server environment does not set the variable, for example for a local server. The other variables of the server environment, such as `PATH` and `HOME`, reach the renderer unchanged. The image sets the variable too.

The `version` command stops before telemetry starts, so the version checks in this document send nothing. Other Lightpanda commands that you start yourself, such as `fetch`, send telemetry unless you set the variable.

## Renderer setup report

When the renderer cannot start, the server writes one `ERROR` line to its log, for example:

```text
Renderer setup failure: the Lightpanda executable is missing (ENOENT). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.
```

The line gives the failure class, `is missing` or `cannot start`, and the system error code. It shows no URL, reason, renderer arguments, page text, token, executable path, or process output. The client gets a safe `Renderer could not start` detail, with an approved launch code when available, and the completion record still has `fetch_failed`. See the [public failure contract](reference/mcp-fetch-tool.md#public-fetch-failures). HTTP errors, timeouts, and blocked destinations write no such line.

The server writes the line one time for each code in the life of its process, so a renderer that stays missing adds only one line. A new code adds one new line.

| Code | Failure class | Usual cause | Correction |
| --- | --- | --- | --- |
| `ENOENT` | is missing | `LIGHTPANDA_BIN` names a file that does not exist, or it is unset and `lightpanda` is not on the `PATH` of the server. | Install the pinned release with the recipe above. Set `LIGHTPANDA_BIN` to the absolute path of the executable. |
| `EACCES` | cannot start | The file has no execute permission, or the path is a directory. | Give the file execute permission, for example with `chmod 755`. Set `LIGHTPANDA_BIN` to the executable, not to its directory. |
| `ENOEXEC` | cannot start | macOS only: the file is not an executable for this platform, for example the asset of another operating system. | Install the asset for this platform with the recipe above. |

On Linux, the system gives a file that it cannot execute to `/bin/sh`. The process then starts and fails, so each page fetch fails without a renderer setup report. Another code shows another reason why the system cannot start the process; a code without a system error name shows as `UNKNOWN`. A system limit, `EAGAIN`, `EMFILE`, `ENFILE`, or `ENOMEM`, is temporary and gives no report. In each case, verify the executable with `"$LIGHTPANDA_BIN" version`. The server reads `LIGHTPANDA_BIN` when it starts, so restart it after you change the setting. If you correct the file at the same path, the next page fetch uses it without a restart. After a correction, a recurrence of a reported code writes no new line until the next server start.

## Renderer readiness report

A page has a fixed 20-second readiness allowance, including navigation. If the
renderer is still active at the deadline, the fetcher sends `SIGKILL` and waits
for the process to finish. The client gets
`Page fetch failed: Renderer readiness timed out` without partial
Markdown. The completion record has `fetch_failed`, and the application logger
writes this safe `ERROR` record for each readiness timeout:

```json
{"event":"renderer.fetch.failed","category":"readiness_timeout","phase":"renderer_process","budgetMs":20000,"operationId":"8b7bcf65-ddaf-45a8-b26f-374280b74eb1"}
```

This record contains no URL, request credentials, renderer arguments, stderr,
or raw cause. It identifies the readiness deadline. A page that keeps network requests
active can reach this deadline. Verify the pinned executable first. Then check whether
the page completes its loading and permits automated access. Do not remove the
network safety options to make a page load. The allowance is fixed; no request
argument or environment setting changes it. The separate process timeout stays
60000 ms, and the output limit stays 32 MiB.

## Fetch failure diagnostics

Each failed fetch also writes a structured `renderer.fetch.failed` event with
its `operationId`. Join it to the completion event to inspect the observed HTTP
status, known renderer code, process exit code, signal, killed flag, and local
validation or timeout phase. Empty or invalid JSON is marked `absent` or
`invalid` in `metadata`. Unknown codes stay `unknown`. The
[diagnostic field contract](reference/mcp-fetch-tool.md#fetch-failure-diagnostics)
gives the exact fields. Successful and cancelled fetches write no failure event.

For example, `httpStatus: 429` with `exitCode: 22` and no renderer error code
means that the renderer observed an HTTP error. It does not establish whether
the origin, a proxy, or another service returned it. `OperationTimedout` is a
renderer error code; it does not identify DNS, TCP, TLS, or transfer as the cause.
The event contains no raw output or request data. Do not add these to logs.

## Verify rendering

Use Node 24.20.0 and pnpm 12.10.1, then install project dependencies with `pnpm install`.
The project pins this Node version for pnpm scripts; the initial installation
downloads it if needed. Select the same version with `nvm use` before direct
`node` commands below. The unit suite uses process doubles. It needs no
Lightpanda executable or public network access after installation:

```sh
pnpm test:unit
```

With `LIGHTPANDA_BIN` set to the verified executable, run the local renderer interface tests. These tests start local HTTP fixtures and check JavaScript rendering, redirects, HTTP errors, readiness, per-call cancellation, and network blocking. Only the trusted fixture scope permits IPv4 loopback; production options keep private networks blocked.

```sh
pnpm build
node --test \
  dist/test/interface/website-fetcher-cancellation.test.js \
  dist/test/interface/website-fetcher-http.test.js \
  dist/test/interface/website-fetcher-network.test.js \
  dist/test/interface/website-fetcher-readiness.test.js \
  dist/test/interface/website-fetcher-redirects.test.js
```

The separate smoke test contacts public websites. It needs public network access and can fail when a site changes or refuses bots:

```sh
pnpm build
node --test dist/test/interface/website-fetcher.test.js
```

`pnpm test:interface` and `pnpm test` include that public-site smoke test. The fetcher turns [telemetry](#telemetry) off for each renderer run of these tests and of the renderer gate. `npm run check` runs type checking, offline unit tests, and build acceptance tests. It does not run the live renderer interface tests or the renderer gate.

With `LIGHTPANDA_BIN` set to the verified executable, run the explicit renderer gate. It checks the fetch and search tools with this renderer:

```sh
npm run test:mcp:renderer
```

The command makes a clean build and runs both
`dist/test/acceptance/mcp/get-url-as-markdown.runtime.js` and
`dist/test/acceptance/mcp/search-pipeline.runtime.js`. Their `.runtime.ts`
names do not match ordinary suite globs. The final phase of
`npm run build:hosted` runs both files too. The fetch runtime file runs the
self-hosted server in the test process with real Better Auth, the real
cleaning pipeline, trusted test rules, and this renderer. The real MCP SDK HTTP client calls `getURLAsMarkdown` for local HTTP pages on `127.0.0.1`. The test-only `permitIPv4Fixture` seam lets the renderer reach only that address in the test scope. It keeps the other launch options of the fetcher, also the renderer environment. The gate needs no public network access and no Axiom credentials.

The nine fetch cases check these behaviors:

- In the modern 2026-07-28 and legacy 2025-11-25 protocol eras, a user signs in and consents on the bundled pages. The client then gets exact cleaned Markdown from a local JavaScript page, and the server writes one safe completion record.
- A local server whose environment does not set `LIGHTPANDA_DISABLE_TELEMETRY` gets a local JavaScript page, and the renderer run has telemetry off. The case gives the server a new `HOME` and an `XDG_DATA_HOME` under it. Lightpanda 1.0.0 makes its data directory there at each start: on macOS under `HOME`, on Linux under `XDG_DATA_HOME`. With telemetry on, it writes its telemetry install ID, the file `iid`, there and starts the telemetry sender, which alone connects to `telemetry.lightpanda.io`. The case checks that the directory holds no file.
- After a redirect that changes the host and the path, `requestedUrl` keeps the requested spelling. The final URL selects the ad rules and resolves the relative links.
- Hidden content is removed. HTML that the sanitizer withholds gives exact empty success. An HTTP error gives a safe HTTP detail, such as `Page fetch failed: HTTP 404`, and no renderer setup report. A DOM deeper than 256 levels gives `Page processing failed`.
- A page whose script completes after 6.5 seconds returns its rendered content within the 20-second readiness allowance.
- A page that never reaches network idle gets `Page fetch failed: Renderer readiness timed out` and no partial Markdown. The renderer child stops before the call completes. The server writes one safe readiness report and one `fetch_failed` completion record.
- A modern client cancellation stops the renderer child, and the server writes one `cancelled` record.
- Server shutdown cancels a legacy call. The renderer child stops before the server finishes stopping, and the server writes one `cancelled` record.

Both runtime files and the live search file use the shared validator
`test/support/processes/pinned-renderer.ts`. Setup fails when
`LIGHTPANDA_BIN` is unset or empty, relative, does not run, or reports a
version other than 1.0.0. Then no gate test passes and no provider request
starts. Each setup message starts with `Renderer gate setup failed:` and
points to this document. The setup acceptance test checks all three files
with outbound network access blocked. The [test gate policy](implementation/test-gate-policy.md#renderer-gate-mcp-p03) gives the evidence rules.

The search runtime file uses a test-only `WebsiteFetcher` transport. It maps
the canonical Brave URL to a local fixture rendered by the pinned executable,
then returns canonical Brave metadata to the real adapter. The classifier,
cleaners, and MCP result run with that rendered page and a test identity
provider. The transport keeps its
loopback allowance inside the isolated fixture scope. It adds no production
endpoint override or network bypass. A local gate pass proves this pipeline;
it does not prove current Brave access. A renderer gate pass requires every
case in both runtime files to pass; nine passing fetch cases alone are not a
complete gate pass.

Run the separate public Brave proof with the same verified executable:

```sh
npm run test:mcp:search:live
```

This command makes a clean backend build and runs only
`dist/test/acceptance/mcp/search-pipeline.live.js`. It uses a local Better Auth
account and the production search composition. The real provider response
must pass the adapter, classifier, cleaners, and MCP result checks. The proof
requires a useful external result link with description text in the same
paragraph or the next paragraph, without crossing another result or a section
boundary. An unrelated footer paragraph does not satisfy that check. It needs public network access,
with no Brave API key or Axiom credential. Ordinary, offline, and container
build gates exclude this `.live.ts` file. A block, HTTP 429, unsupported page,
or setup failure is an incomplete live proof. Record the command, date,
pinned version, and tool result in a new dated implementation record. Keep
earlier records intact. [SEARCH-09](implementation/search-09.md) records the
stronger assertion and its live result. The local fixture
gate and earlier raw or nightly probes cannot replace this proof.

## Upgrade policy

Other releases, nightly builds, and unverified local builds are unsupported. They can reject required flags or change JSON output, HTTP errors, readiness, or network blocking. If a required option fails, keep the failure visible. Do not remove safety flags to make another build run.

To change the supported runtime, select an exact official release, record all four asset digests, and update this recipe in the same change. Run `npm run check`, the local renderer interface tests, and the renderer gate with that executable. The renderer gate accepts only version 1.0.0, so change its version check in the same change. Review its network policy, CLI behavior, and telemetry. The fetcher turns telemetry off with `LIGHTPANDA_DISABLE_TELEMETRY`, and the telemetry case of the renderer gate needs the `iid` file of 1.0.0. Update the fetcher and network policy documents if behavior changes. Change the image in the same change: the asset URLs and the two Linux digests in the `Dockerfile` and in `docker/check-lightpanda-digest.sh`, the version in the `LIGHTPANDA_BIN` path, and the version checks of the container gate. Update `Dockerfile.hosted` and its hosted image checks in the same change, then run the dedicated hosted image gate as the [test gate policy](implementation/test-gate-policy.md) requires. Run `npm run test:container` for the self-hosted image. Test each platform before you claim support for it. Keep the previous version directory until the new release passes these checks.
