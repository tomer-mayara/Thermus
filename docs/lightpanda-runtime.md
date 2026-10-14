# Lightpanda runtime

Thermus supports the official Lightpanda **1.0.0** release. The renderer is an external executable. `pnpm install` does not install it. The [release page](https://github.com/lightpanda-io/browser/releases/tag/1.0.0) provides four platform assets. The recipe below pins that release and checks each asset against its recorded SHA256 digest. The [container image](#container-image) holds the pinned Linux executable, so a container needs no installation.

Use macOS or Linux on x86-64 or ARM64. The Linux binary requires glibc; Alpine Linux with musl is not supported by this recipe. On Windows, run the Linux recipe inside WSL2. See the [official installation guide](https://lightpanda.io/docs/open-source/installation/) for WSL2 setup.

The macOS ARM64 asset download, SHA256 digest, and `version` output were verified. The 29 local renderer interface tests and the renderer gate passed with that executable. The Linux ARM64 executable runs in the container gate. A `linux/amd64` build of the renderer stage, with emulation on an ARM64 host, checked the digest of the Linux x86-64 asset, and that executable reported `1.0.0`. No test rendered a page with it. The macOS x86-64 asset was not exercised.

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

## Select the executable

The self-hosted server reads `LIGHTPANDA_BIN` from its environment when it starts. It gives the value to the fetcher constructor. The fetcher takes no setting, such as `LIGHTPANDA_BIN`, from the environment. A nonempty value selects the executable. Use an absolute path so it works from any working directory. Paths with spaces work when quoted in shell commands:

```sh
export LIGHTPANDA_BIN="/absolute/path with spaces/lightpanda"
"$LIGHTPANDA_BIN" version
```

The fetcher passes the value directly as the executable path. It preserves spaces. The value is not a shell command; do not append flags or include quote characters in the value. If `LIGHTPANDA_BIN` is empty or unset, the fetcher runs `lightpanda` from `PATH`. To use that fallback, verify it first:

```sh
unset LIGHTPANDA_BIN
command -v lightpanda
lightpanda version
```

A selected executable that is missing or cannot start produces an error that points to this document and keeps the process error in `cause`. A configured path does not fall back to another executable. The fetcher does not run a version check on each fetch. Server startup does not run or check the renderer. A server with a missing executable starts. Each page fetch then fails with `Page fetch failed` and a `fetch_failed` completion record. Clients and completion records do not get the fetcher error. The server log gets a [renderer setup report](#renderer-setup-report). The operator must verify the runtime before use with the commands above.

## Telemetry

Lightpanda 1.0.0 sends telemetry to `telemetry.lightpanda.io` on each run, also a `fetch` run, when `LIGHTPANDA_DISABLE_TELEMETRY` is not set. Any value of the variable turns telemetry off. The fetcher starts each renderer run with the environment of the server and `LIGHTPANDA_DISABLE_TELEMETRY=true`. Thus telemetry is off also when the server environment does not set the variable, for example for a local server. The other variables of the server environment, such as `PATH` and `HOME`, reach the renderer unchanged. The image sets the variable too.

The `version` command stops before telemetry starts, so the version checks in this document send nothing. Other Lightpanda commands that you start yourself, such as `fetch`, send telemetry unless you set the variable.

## Renderer setup report

When the renderer cannot start, the self-hosted server writes one `ERROR` line to its log, for example:

```text
Renderer setup failure: the Lightpanda executable is missing (ENOENT). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.
```

The line gives the failure class, `is missing` or `cannot start`, and the system error code. It shows no URL, reason, renderer arguments, page text, token, executable path, or process output. The client still gets `Page fetch failed`, and the completion record still has `fetch_failed`. HTTP errors, timeouts, and blocked destinations write no such line.

The server writes the line one time for each code in the life of its process, so a renderer that stays missing adds only one line. A new code adds one new line.

| Code | Failure class | Usual cause | Correction |
| --- | --- | --- | --- |
| `ENOENT` | is missing | `LIGHTPANDA_BIN` names a file that does not exist, or it is unset and `lightpanda` is not on the `PATH` of the server. | Install the pinned release with the recipe above. Set `LIGHTPANDA_BIN` to the absolute path of the executable. |
| `EACCES` | cannot start | The file has no execute permission, or the path is a directory. | Give the file execute permission, for example with `chmod 755`. Set `LIGHTPANDA_BIN` to the executable, not to its directory. |
| `ENOEXEC` | cannot start | macOS only: the file is not an executable for this platform, for example the asset of another operating system. | Install the asset for this platform with the recipe above. |

On Linux, the system gives a file that it cannot execute to `/bin/sh`. The process then starts and fails, so each page fetch fails without a renderer setup report. Another code shows another reason why the system cannot start the process; a code without a system error name shows as `UNKNOWN`. A system limit, `EAGAIN`, `EMFILE`, `ENFILE`, or `ENOMEM`, is temporary and gives no report. In each case, verify the executable with `"$LIGHTPANDA_BIN" version`. The server reads `LIGHTPANDA_BIN` when it starts, so restart it after you change the setting. If you correct the file at the same path, the next page fetch uses it without a restart. After a correction, a recurrence of a reported code writes no new line until the next server start.

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

With `LIGHTPANDA_BIN` set to the verified executable, run the explicit renderer gate. It proves the production fetch tool with this renderer:

```sh
npm run test:mcp:renderer
```

The command makes a clean build and runs `dist/test/acceptance/mcp/get-url-as-markdown.runtime.js`. The `.runtime.ts` name does not match the `*.test.js` globs, so `pnpm test` and `pnpm test:acceptance` do not select the file. The gate runs the self-hosted server in the test process with real Better Auth, the real cleaning pipeline, trusted test rules, and this renderer. The real MCP SDK HTTP client calls `getURLAsMarkdown` for local HTTP pages on `127.0.0.1`. The test-only `permitIPv4Fixture` seam lets the renderer reach only that address in the test scope. It keeps the other launch options of the fetcher, also the renderer environment. The gate needs no public network access and no Axiom credentials.

The seven cases prove these behaviors:

- In the modern 2026-07-28 and legacy 2025-11-25 protocol eras, a user signs in and consents on the bundled pages. The client then gets exact cleaned Markdown from a local JavaScript page, and the server writes one safe completion record.
- A local server whose environment does not set `LIGHTPANDA_DISABLE_TELEMETRY` gets a local JavaScript page, and the renderer run has telemetry off. The case gives the server a new `HOME` and an `XDG_DATA_HOME` under it. Lightpanda 1.0.0 makes its data directory there at each start: on macOS under `HOME`, on Linux under `XDG_DATA_HOME`. With telemetry on, it writes its telemetry install ID, the file `iid`, there and starts the telemetry sender, which alone connects to `telemetry.lightpanda.io`. The case checks that the directory holds no file.
- After a redirect that changes the host and the path, `requestedUrl` keeps the requested spelling. The final URL selects the ad rules and resolves the relative links.
- Hidden content is removed. HTML that the sanitizer withholds gives exact empty success. An HTTP error gives `Page fetch failed` and no renderer setup report. A DOM deeper than 256 levels gives `Page processing failed`.
- A modern client cancellation stops the renderer child, and the server writes one `cancelled` record.
- Server shutdown cancels a legacy call. The renderer child stops before the server finishes stopping, and the server writes one `cancelled` record.

Setup fails when `LIGHTPANDA_BIN` is unset or empty, when it is relative, when it does not run, or when it reports a version other than 1.0.0. Then no gate test passes. Each setup message starts with `Renderer gate setup failed:` and points to this document. The [test gate policy](implementation/test-gate-policy.md#renderer-gate-mcp-p03) gives the evidence rules.

## Upgrade policy

Other releases, nightly builds, and unverified local builds are unsupported. They can reject required flags or change JSON output, HTTP errors, readiness, or network blocking. If a required option fails, keep the failure visible. Do not remove safety flags to make another build run.

To change the supported runtime, select an exact official release, record all four asset digests, and update this recipe in the same change. Run `npm run check`, the local renderer interface tests, and the renderer gate with that executable. The renderer gate accepts only version 1.0.0, so change its version check in the same change. Review its network policy, CLI behavior, and telemetry. The fetcher turns telemetry off with `LIGHTPANDA_DISABLE_TELEMETRY`, and the telemetry case of the renderer gate needs the `iid` file of 1.0.0. Update the fetcher and network policy documents if behavior changes. Change the image in the same change: the asset URLs and the two Linux digests in the `Dockerfile` and in `docker/check-lightpanda-digest.sh`, the version in the `LIGHTPANDA_BIN` path, and the version checks of the container gate. Then run `npm run test:container`. Test each platform before you claim support for it. Keep the previous version directory until the new release passes these checks.
