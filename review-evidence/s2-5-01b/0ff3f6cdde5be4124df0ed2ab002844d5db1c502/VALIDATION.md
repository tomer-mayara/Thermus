# Validation

Candidate `0ff3f6cdde5be4124df0ed2ab002844d5db1c502` is stacked on actual parent `122d65bf1f035fc195792cc083732aa05c423c58` (PR #251).
Complete candidate selection uses main `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`. The final worktree was clean
for the tier check. [Machine results](validation.json) retain exact Node counts.

All selected test/type/build gates pass. Ordinary suite: 4,920 backend + 49 portal.
PostgreSQL: 22; hosted staging: 28; Collector: 10; self-hosted container: 11;
Linux AMD64 hosted image: seven, including the full offline hosted build.
Changed compiled focus: 95. Each selected new/changed test ran before its source
commit, including the dedicated runtime tests. All passing Node summaries have
zero failures, cancelled tests, skipped tests, and todo tests. The ordinary suite
registers the gated container suite without cases; the explicit 11-case run above
is its real proof. The coverage run likewise leaves that gated suite for the
separate command; it is not a container coverage claim.

The nested image build necessarily ran build:hosted and its check command. No
extra standalone npm run check was added. A separate renderer run is N/A because
this ticket does not change renderer/pipeline source; the image's required offline
build still exercises its runtime fixtures. The live Brave and Axiom interface-
only gates are not newly selected. Ordinary tests include existing Axiom cases
using the owner's established local environment. No production Supabase or WorkOS
membership deletion was performed. Release/restore/live-removal gates remain
S2.5-02; browser and trusted customer capture proof remain S2.5-01c.

## Commands, environments, and provenance

Logs under checks retain commands, outputs, and counts. Node 24.20.0 and pinned
Lightpanda 1.0.0 were used. The ordinary run loaded the existing local env file;
the hosted-live run used the existing Keychain staging launcher. No credentials
are included in this evidence. The 28-case live gate includes real five-minute
access-token expiry, which explains its duration. PostgreSQL 17 used disposable
local containers and verified test TLS; no cloud account or paid resource.
Collector used its isolated Docker network and TLS fixtures. Hosted image used
Linux AMD64 under Colima emulation and completed the real renderer/CLI checks.

The ordinary run precedes the final type-only placement of request/result types.
A fresh build compared all 177 emitted production JS files and found zero byte
changes (`checks/runtime-type-move-comparison.json`). All final changed tests then
ran in the 95-case compiled focus and 22-case PostgreSQL gate. The subsequent
source edit changes only two explanatory comment lines; exact source comparison
in `checks/final-source-equivalence.json` proves all other source bytes identical
between implementation d75b8676 and final head. Final typecheck, snapshots, process,
and checker bind to final head; documentation commits change no runtime input.
The image started from that implementation's working source; its VCS label still
names the earlier scope commit, so the label alone is not claimed as candidate proof.
Its source selection includes the new 3,205-test unit suite and provider fix.

Coverage was recollected on fb9b0fd0 from all already-selected unit, integration,
and acceptance packages: 3,205 backend unit + 29 portal unit; 1,080 integration;
571 backend acceptance + 20 portal acceptance. It records 172 files and 1,309
processes. Final process reuses verified compatible coverage across the prose-only
commit. Exact capture identities, manifests, and hashes remain in coverage.json;
raw V8 files remain local in ast-report/coverage-captures. No fabricated coverage,
manual share, or source mapping was inserted. Main-derived architecture base
values with head coverage are estimates, not measured base coverage. The process
compares main; incremental MI snapshots and CRAP/checker compare the actual parent.

## Red steps and failure/retry history

- The public two-case acceptance failed because removeMember did not exist.
  Focused rules, lifetime, and outcomes went red before implementation, then green.
- SQL tests failed on missing operations/table, then passed with the migration.
  Three crash cases failed before removal/close existed, then passed after actual
  SIGKILL and a fresh PID using the same database. The final 22-case gate repeats them.
- A direct-TypeScript composition attempt first failed on unsupported TS syntax.
  That is not counted as feature red. The transformed rerun reproduced two real
  composition failures before wiring, then passed. The lifecycle timing assertion
  was adjusted to observe async removal-before-SQL close, without changing its
  once-only or independent-cleanup contract.
- Independent review reproduced six provider-read lifetime failures and ten unit
  failures. The read signal fix passed all cases and 106 provider regressions.
- The first full run/typecheck stopped on an unknown-valued logger fixture written
  into a string array. The fixture changed to unknown[], then typecheck/full tests
  passed. Later type-only declarations and an explicit test assertion also passed
  their focused checks. Earlier successful runs are retained but superseded.
- Native metrics comparison initially refused the dirty candidate. After commit,
  all four stages completed. Unit-only coverage left two callbacks unmapped;
  combined selected-suite coverage resolves them. One different source mapping
  remains unknown and passes the conservative bound, as QUALITY.md explains.
- The first self-hosted container gate failed 0/11 with ENOSPC. Removed only old
  stopped Thermus test edge/image artifacts, then retry passed 11/11. One attempted
  image deletion was refused because the stopped edge still referenced it; it was
  removed normally after inspecting its labels and empty mount list. No database
  volume or running application was removed. No global prune was used.
- The Supabase CLI scaffold referred to a missing inherited permission profile.
  No control was bypassed; a local timestamped SQL file was written and tested.
  The SQL migration did not run against Supabase.

## Manual checks and limits

The SQL privilege drill used pre-existing API roles and broad default grants,
including service_role BYPASSRLS. Runtime SELECT/INSERT/UPDATE work, DELETE/DDL
and API reads are denied, and RLS is enabled and forced. Effective permissions
still need a project-owner check before rollout. No new env/key/resource is needed.
Local Markdown targets, git diff --check, 49 current API snapshots, empty snooze,
all architecture source/render matches, and clean candidate status were verified.
The snapshot command ignores 33 diagnostics in two non-public files by its design;
the actual complete typecheck passes. No prose/config test was added.

GitHub reported no checks or status contexts for this exact head at publication;
that is not a separate remote CI pass. The local checker is T2/eligible without
local blockers. Parent merge and independent architect approval still block merge.
The preserved user draft will be restored after clean-candidate checks and Ready;
it is not included in this PR.
