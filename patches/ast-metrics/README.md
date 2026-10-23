# Local ast-metrics repair

This patch applies to upstream ast-metrics 0.43.1 at commit
`b2f83dc17bc5f13084c163400def4d55d691f983`. It builds as
`0.43.1-thermus.1`. It does not change the upstream tag or a global installation.

## Source and license

- Source: https://github.com/ast-metrics/ast-metrics
- Archive: https://codeload.github.com/ast-metrics/ast-metrics/tar.gz/b2f83dc17bc5f13084c163400def4d55d691f983
- Archive SHA-256: `44c26e5c3bcb97ac4028904a89183d7ad84ab673e009a9cc3683aa8643680517`
- License: MIT. [LICENSE.txt](LICENSE.txt) is the unchanged upstream notice.
  Keep that notice with copies of the patched source or binary.
- Upstream `go.mod` requires Go 1.25.0 or later. Go downloads and checksums
  are published at https://go.dev/dl/.

## Changes

Native function enumeration used qualified names to remove repeated AST
references. Anonymous callbacks in one class have the same qualified name, so
this removed distinct declarations. The patch uses valid declaration byte
ranges first. The previous name and pointer rules remain for records without
valid locations. Names and function complexity formulas stay the same.

The function visitor also visits parameter expressions and the body node
itself. This retains functions in default parameters and nested concise arrow
bodies. A nested function owns its decisions; its parent does not gain them.

`get_file_metrics` adds two fields:

- File field `source_sha256`: the lowercase SHA-256 hash of the exact UTF-8
  bytes read by the TypeScript parser. Cached responses retain that hash.
- Function field `source_range`: an object with `coordinates: "utf8-bytes"`,
  an inclusive `start`, and an exclusive `end`. Zero is emitted. The object
  is absent when the native location is missing or invalid.

The TypeScript parser stores the hash in the existing `File.Checksum` field
with a `sha256:` prefix. The MCP output removes that prefix. Other language
engines do not gain a source hash from this patch.

The review command evaluates each revision with its own configuration and
source scopes. Before the repair, it evaluated detached base files with head
scopes and could report existing rule violations as new. This change does not
suppress findings or change lint comparison rules, path matching, baseline
entries, or rename policy. New and worsened native findings remain reportable.

## Build

Use the local installer from the Thermus root:

```sh
pnpm exec node script/code-quality/ast-metrics-install.ts
```

The installer requires Go 1.27.3, a C compiler, Git, and tar. Set `GO_BIN` to
an absolute Go executable path when it is not on `PATH`. The installer verifies
the source archive and patch, then publishes the binary under the ignored
`.cache/ast-metrics/0.43.1-thermus.1/<platform>-<arch>/` directory. It does not
replace a global tool.

For a manual developer build, extract the pinned archive into an isolated
directory. Run `git init --quiet` there before `git apply --check` and
`git apply`. This prevents an enclosing repository from changing patch path
selection. Build with:

```sh
go build -trimpath -buildvcs=false \
  -ldflags '-s -w -X main.version=0.43.1-thermus.1 -X main.commit=b2f83dc17bc5f13084c163400def4d55d691f983 -X main.date=2026-10-22T00:00:00Z' \
  -o /absolute/local/output/ast-metrics ./cmd/ast-metrics
```

The version uses the upstream build variables. Keep the version distinct from
stock 0.43.1. The local installer checks the archive, patch, and binary identity.

## Wrapper requirements

Check the parsed source hash before using metrics. Convert byte offsets to
UTF-16 only at valid UTF-8 boundaries. Match each executable source declaration
to exactly one native function. Reject missing, duplicate, invalid, or unrelated
ranges. Do not replace missing native metrics with inferred counts or scores.
A legacy response without ranges cannot prove anonymous function identity.
Keep unknown coverage and source identity unresolved.

## Manual verification

Use the bounded Thermus MCP session wrapper. Do not register a persistent MCP
server. Temporary fixtures checked class callbacks, repeated nested names,
Unicode before declarations, a declaration at byte zero, empty and constant
files, overload signatures, default-parameter callbacks, and nested concise
arrow bodies. Check one-to-one declaration ranges, source hashes, and own
complexity. A missing-file call must fail. After a file changes during a cached
session, its live hash must differ from the hash in the cached response.

Use a temporary Git repository to check review behavior: unchanged rule debt
must not be new; a new violation and a genuine worsened function must remain.
A rename retains the upstream conservative path-based comparison. This patch
does not claim rename correspondence without evidence.

No tooling test files are added to Thermus. Required checks use builds, type
checks, lint, and manual command runs.
