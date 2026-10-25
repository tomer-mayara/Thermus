# S2.5-02 validation selection

Actual stack parent: `2271545702a8f1ec28c6f7dd913fec7024ecadeb`
(`origin/codex/s2-5-01c-members-removal`, PR #254).
Trusted main: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.

The increment changes tests, test-gate commands, runbooks, legal review documents,
and the plan. It adds no production source. The complete candidate against main
includes all three removal implementation increments under `src/`. Repository
policy therefore selects the full ordinary suite, typecheck, portal build,
private PostgreSQL, Collector, WorkOS staging, Members Chromium, self-hosted
container, and Linux AMD64 hosted image gates. The image's nested offline build
covers `build:hosted`; no separate `npm run check` is selected.

Run the new integrated PostgreSQL case and the exact-fixture WorkOS live case
locally before the first implementation commit. The former initially characterizes
existing production behavior. Compile and fixture expectation failures are not
new source behavior/TDD red steps. No production gap is claimed from those failures.
Shared live helper defaults are covered by the existing hosted-live-site integration
group and full staging gate. The manual fetch-public-script live scenario changes
no subject behavior; its shared default application construction is covered by
these selected hosted site/live groups. No new public-web fetch/search contract
is introduced and no unrelated search-live gate is selected.

The new `.runtime.ts` and `.live.ts` files are registered in their dedicated
commands and remain outside ordinary globs. WorkOS files run in sequence because
they bind the same local ports. Never reset dist while a gate runs. Read-only
cloud inventory and the disposable restore control drill are manual evidence;
no tests are added for scripts, prose, or helper code alone.

Architecture/tier use the actual parent. Complete-candidate metrics process keeps
main; compatible existing coverage may be reused with its exact provenance.
Production MI/CRAP delta against the actual parent is empty unless source changes.
Retained main-stack findings keep their recorded reasons and linked evidence.
