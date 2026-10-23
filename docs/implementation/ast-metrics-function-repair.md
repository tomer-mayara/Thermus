# Repair function measurements in ast-metrics

This change repairs the quality tools used by the Slice 1 stack. It keeps the
MI and CRAP goals, review thresholds, baseline, and human approval rules.

## Cause and correction

Upstream ast-metrics 0.43.1 removes duplicate function records by name. Distinct
anonymous callbacks in a class can have the same name. It also skips functions
in default parameters and some concise arrow bodies. Its MCP response does not
include source positions. These limits prevent a complete function assessment.

The local patch retains distinct declaration ranges and visits those expressions.
It exports the exact parsed-source SHA-256 hash and UTF-8 byte ranges. The wrapper
checks the hash, matches every executable TypeScript declaration exactly once,
and derives its UTF-16 range and syntax identity. Missing declarations, duplicate
ranges, wrong hashes, and missing complexity remain errors. A native name alone
does not prove identity.

The upstream Review command also evaluates the base tree with the head tree's
source scopes. That can label existing debt as new. The patch uses each tree's
own configuration. It does not refresh baseline entries or suppress findings.

See the [patch and provenance](../../patches/ast-metrics/README.md). The installer
builds the pinned source and patch as `0.43.1-thermus.1` in the local ignored
cache. It verifies the source archive, Go modules, patch, binary, and a bounded
MCP fixture before publication. It leaves a global installation unchanged.

## Coverage and comparison

Coverage report version 3 retains a source identity for each measured function.
For emitted JavaScript, exact source-map boundaries connect the V8 range to the
TypeScript declaration. Live source, emitted code, and map hashes are checked;
capture provenance binds the complete build and selected inputs. Anonymous
functions and repeated method names can therefore have distinct measured shares.
The module initializer does not acquire a callback identity.

Missing or ambiguous mappings remain unknown. A function with no own characters
remains unmeasured. Legacy reports remain readable but cannot provide exact
matches for current source identities. Collect fresh compatible coverage; do not
edit an old report to claim new measurements.

Source identity uses `typescript-tokens-v2`. Version 1 retains its original
validation restrictions. Within a proven file correspondence, a unique named
declaration establishes continuity. A unique unchanged body and signature can
prove a move. If complete source inventories cannot establish a partner, the
head declaration takes the stricter new-function goal. This does not assert that
no earlier form existed. Deleted functions and ambiguous copies cannot relax
the goal. Incomplete source evidence still blocks a required assessment.

## Verification scope

This repair changes tooling and documents. Its selected checks are TypeScript,
habit-hooks, command help, manual fixtures, and the quality process. It adds no
tests under `test/`, runs no production suite solely for tooling, and collects no
production coverage in this standalone candidate. The complete Slice 1 source
candidate selects its own ordinary suite, hosted gates, and fresh coverage.

Manual evidence covers:

- Callback inventory, repeated names, nested arrows, default parameters,
  overload signatures, Unicode, byte zero, empty modules, and own complexity.
- Strict rejection of missing, duplicate, malformed, unrelated, or stale native
  evidence. The original Slice 1 source at `181285276c2f1355181d4a3e5b222914d1977571`
  has 1,234 executable declarations; all have a checked native partner.
- Real V8 captures of both emitted JavaScript and stripped TypeScript, exact
  source mapping, distinct covered and uncovered namesakes, unmeasured ranges,
  stale source/build rejection, and legacy report limits.
- Installer reuse, missing and wrong Go, corrupt or stale files, bad archive
  checksum, install locking, failed-build cleanup, and rejection of a stock
  binary that only has a changed version string. The build was tested on macOS
  arm64; Linux and x64 use the same recipe but were not built in this session.
- Native Review with unchanged debt, a new violation, a genuine regression,
  and a conservative rename comparison.

The native Review command still compares functions by name and files by path.
Its report alone does not prove anonymous-function or rename correspondence.
The wrapper's source identities and complete CRAP inventory supply that evidence.

## Architecture and review

This standalone repair changes no application component, public application
contract, runtime authority, resource lifetime, provider, or deployment. The
context, container, component, runtime, and deployment views in the
[registry](../../architecture/components.md) remain accurate. No Mermaid block
changes. The local developer tool uses the existing bounded MCP process wrapper.

Quality-tool and assessment-policy changes require at least T1 Team review.
Agent review does not replace independent human approval. The Slice 1 stack
retains its separate architecture and release requirements.

The standalone process completed all four stages successfully. Production
coverage and CRAP goals are N/A because this candidate changes no production
file. Native Review reports no high finding. Its medium findings concern
bounded installer sequencing and strict source, range, and version validation;
the low findings count their direct dependencies. These checks remain explicit
at the boundary that owns them. The source MI goal does not apply to tooling.

Habit-hooks retains complexity and parameter findings for those same complete
validation inputs and the bounded MCP lifecycle. Splitting their guards across
callers would weaken the evidence check. Comments state units, provenance,
failure behavior, and lifecycle limits. The installer is registered as a real
CLI entry in `knip.json`; no ignore or snooze hides it. The unused local type
export was removed. The runtime manifest path and install instruction stay private
because only the runtime lookup uses them. No unused export remains in that module.
The snooze file remains empty. These are documented review
findings, not a claim that habit-hooks exits successfully.
