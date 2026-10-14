# Lightpanda runtime

Thermus supports the official Lightpanda **1.0.0** release. The renderer is an external executable. `pnpm install` does not install it. The [release page](https://github.com/lightpanda-io/browser/releases/tag/1.0.0) provides four platform assets. The recipe below pins that release and checks each asset against its recorded SHA256 digest.

Use macOS or Linux on x86-64 or ARM64. The Linux binary requires glibc; Alpine Linux with musl is not supported by this recipe. On Windows, run the Linux recipe inside WSL2. See the [official installation guide](https://lightpanda.io/docs/open-source/installation/) for WSL2 setup.

The macOS ARM64 asset download, SHA256 digest, and `version` output were verified for this change. The 29 local renderer interface tests passed with that executable. The Linux and macOS x86-64 binaries are official vendor assets; they were not exercised for this change.

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

## Select the executable

A nonempty `LIGHTPANDA_BIN` value selects the executable. Use an absolute path so it works from any working directory. Paths with spaces work when quoted in shell commands:

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

A selected executable that is missing produces an error that points to this document and keeps the process error in `cause`. A configured path does not fall back to another executable. The fetcher does not run a version check on each fetch. The operator must verify the runtime before use.

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

`pnpm test:interface` and `pnpm test` include that public-site smoke test. `npm run check` runs type checking, offline unit tests, and build acceptance tests. It does not run the live renderer interface tests.

## Upgrade policy

Other releases, nightly builds, and unverified local builds are unsupported. They can reject required flags or change JSON output, HTTP errors, readiness, or network blocking. If a required option fails, keep the failure visible. Do not remove safety flags to make another build run.

To change the supported runtime, select an exact official release, record all four asset digests, and update this recipe in the same change. Run `npm run check` and the local renderer interface tests with that executable. Review its network policy and CLI behavior. Update the fetcher and network policy documents if behavior changes. Test each platform before you claim support for it. Keep the previous version directory until the new release passes these checks.
