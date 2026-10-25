# S2.5-01b habit-hook dispositions

## Scope and result

Reviewed `../checks/habit-complete.log` against the actual stacked parent
`122d65bf1f035fc195792cc083732aa05c423c58` and candidate
`d75b8676cbbc37be2f69356d577ade1ffb87b783`. The review covers all 320
reported findings, all 27 changed source/test files, and the 16 unchanged
files that the report also names. The [line inventory](habit-inventory.json)
records each finding, its candidate text, and whether that line was already
in the parent. Line numbers in this document refer to that candidate.

One inherited comment became inaccurate because the new removal behavior
expanded the meaning of `unknown`. The manager corrected it in
`fb9b0fd09991747a38ca8b06f63e30e55ef0853e`. I read the committed fix: it now
states that removal admission or finalization can be unconfirmed without a
known provider effect. The change is two comment lines only. No outstanding
habit correction remains from this review.

All other findings have the reasons below. The snooze file is `[]` at both
reviewed candidates and was not changed. No source edit, Git mutation, metric
run, or test run was performed for this report. This is a hook disposition
review; the manager owns final complete-candidate validation and human review.

| Category | Reported | New in this slice | Present in parent | Disposition |
| --- | ---: | ---: | ---: | --- |
| high-complexity | 1 | 0 | 1 | Retain the existing composition owner. |
| too-many-parameters | 4 | 3 | 1 | Retain explicit operation context and composition inputs. |
| non-essential-comment | 302 | 14 | 288 | Retain contract and evidence comments; correct the now-stale two-line outcome comment. |
| oversized-file | 13 | 2 | 11 | Retain cohesive provider, composition, fixture, and test files. |

The parent/new split compares the reported lines and thresholds, not only file
names. For example, `application.ts` changed, but its four-input composition
signature and size threshold already existed. The final corrected comment is
listed under inherited text because that is the text the hook report read.

## Parameter and complexity findings

| Location | History | Reason retained |
| --- | --- | --- |
| `src/accounts/organizations/membership-removal-checks.ts:17` | New; four arguments | The rule needs the directory, actor, request, and guarded read operation. These are distinct inputs with visible authority and lifetime. A parameter bag only renames the list. |
| `src/accounts/organizations/membership-removal.ts:49` | New; five arguments | The admitted phase needs actor/request, the exact durable intent, available store, and this call's lifetime. The store is narrowed from optional before admission. Moving these values onto the reusable service would share per-call state. |
| `src/accounts/organizations/membership-removal.ts:66` | New; five arguments | Completion must show the store, exact intent, expected terminal result, caller result, and lifetime together. This makes the difference between provider completion and durable completion visible. A second operation object would mainly forward these values. |
| `src/app/application.ts:154` | Four arguments already in parent; optional storage shape extended | Config, provider parts, account parts, and the shared storage lifetime are composition inputs. This is their existing assembly point. Combining unrelated parts into one options bag would not reduce coupling or clarify close order. |
| `src/app/hosted-workos-application.ts:97` | Entire file and function unchanged | The composition chooses explicit overrides, owns the optional audit capture, and transfers cleanup ownership only after construction succeeds. The flat branches express these lifetime and precedence rules. Splitting each override into a new factory would obscure the one construction/cleanup boundary. |

The small removal methods keep checks, dispatch, and completion at different
catch boundaries. This prevents a later storage failure from being classified
as a pre-dispatch refusal. The exact per-file MI and method-path review is in
[coordinator-quality.md](coordinator-quality.md). Its retained MI reasons do
not replace this hook review or required human approval.

## New or changed comment text

All 14 new or changed comment lines are accounted for here. These comments
state contracts, safety limits, or test evidence limits that names and types
alone do not establish.

| Location | Lines | Reason retained |
| --- | ---: | --- |
| `src/accounts/organizations/change-records.ts:29` | 1 | Names the removal action in the shared record vocabulary. This is an event contract alongside existing invitation/grant action names. |
| `src/accounts/organizations/directory-reads.ts:18` | 1 | States that a repeated cursor or page limit fails the whole read. A partial list must not appear complete to a safety decision. |
| `src/accounts/organizations/membership-removal-checks.ts:46` | 1 | Explains why direct target facts are copied before another await: a mutable provider record must not change the earlier observation. |
| `src/accounts/organizations/membership-removal-lifetime.ts:5,19` | 2 | Defines server ownership, the limit of read cancellation, and admission uncertainty. Aborting later reads does not cancel an HTTP call already sent or prove an admission did not commit. |
| `src/accounts/organizations/organization-administration.ts:55-56` | 2 | Updates the service responsibility and safe recording contract to include removal; keeps billing and operator setup boundaries visible. |
| `src/accounts/organizations/organization-directory.ts:100` | 1 | Documents the optional signal's narrow promise. It stops later provider reads while an already-sent read keeps its existing timeout. |
| `src/accounts/providers/workos/workos-organizations.ts:304` | 1 | Explains the same provider-side cancellation limit beside the guard that enforces it. It prevents a false claim of transport cancellation. |
| `src/app/application.ts:176` | 1 | Gives the required shutdown order: stop removal before closing its shared SQL runtime. |
| `src/app/logging-storage.ts:12` | 1 | Records one private SQL runtime for settings and removal intent, so a later composition does not add a second independent store. |
| `test/integration/auth/hosted-storage-lifecycle.test.ts:23` | 1 | Explains why held MCP/listener cleanup must not delay removal and SQL shutdown. This is the behavior under test. |
| `test/support/processes/membership-removal-child.ts:67` | 1 | Explains why child failure output excludes provider values and database connection details. |
| `test/support/processes/membership-removal-process.ts:20` | 1 | Defines ownership of the child that a crash test can terminate. The test must never kill a shared server or another process. |

The inherited `change-records.ts:7-8` comment required correction. Its former
wording placed every `unknown` outcome during a directory write. That is false
for uncertain admission and final receipt writes. Commit `fb9b0fd0` now makes
this distinction explicit. The comment remains useful because a plain string
union cannot express these phase and recovery semantics.

## Inherited comment findings

The following table covers all 288 inherited comment lines. The full individual
locations and exact text remain in the inventory. Keeping them is based on
their current contract or evidence purpose, not merely their presence in the
parent. Simple labels at the start of a contract block stay with that block.

| File | Inherited lines | Current reason |
| --- | ---: | --- |
| `src/accounts/organizations/change-records.ts` | 15 | Record field units, action vocabulary, credential exclusion, no replay, and recording failure isolation. Lines 7-8 are corrected as described above. |
| `src/accounts/organizations/directory-reads.ts` | 3 | Complete-page reads and later-record authority explain why partial results and duplicate counts are unsafe. |
| `src/accounts/organizations/organization-administration.ts` | 14 | Actor versus selected organization, default permissionless roles, invitation ownership, case-insensitive pending checks, and explicit-result authority are caller-visible rules. |
| `src/accounts/organizations/organization-directory.ts` | 30 | Public contract semantics: subject versus email, all grant evidence, statuses, revisions, invitation credentials, provider recipient rules, no-effect results, and no global account deletion. |
| `src/accounts/providers/workos/workos-organizations.ts` | 54 | Pinned provider quirks and safety interpretation: raw management evidence before SDK defaults, documented no-effect codes, active/default filters, pagination limits, serial user reads, expiry, role preservation, and safe error mapping. |
| `src/app/application.ts` | 15 | Composition contracts, route ordering, private provider APIs, resource ownership, trusted diagnostics, and failure/drain observation. |
| `src/app/hosted-workos-application.ts` | 13 | Provider override precedence, fail-closed configuration, one authority/client, no retries, fixed per-call timeout, and shared directory composition. |
| `src/app/logging-storage.ts` | 1 | States that test and export share native DNS/TLS/HTTP admission, not merely the same type. |
| `test/acceptance/auth/hosted-live/administration-proofs.ts` | 8 | Documents what a live proof observes, why it forces small pages, and which independent provider reads it compares. |
| `test/acceptance/auth/hosted-live/administration-server.ts` | 6 | Marks credential boundaries, safe failure diagnostics, session continuity, and the browser action represented by its driver. |
| `test/acceptance/auth/hosted-live/operator-setup.ts` | 1 | States that this setup uses the real hosted application reads against staging. |
| `test/acceptance/auth/hosted-membership-deletion.test.ts` | 1 | Limits the parent ticket's proof to the directory collaborator; it makes no browser-removal claim. |
| `test/integration/auth/workos-provider-administration.test.ts` | 14 | Distinguishes local fake/real-package integration from live provider evidence, documents multi-role fixture intent, and explains exact write/page record selection. |
| `test/integration/auth/workos-provider-directory.test.ts` | 3 | States wire-format and hosted-catalog assumptions, with an explicit limit on live provider claims. |
| `test/integration/auth/workos-provider-organizations.test.ts` | 8 | States real composition versus probe roles, fixture membership differences, billing-page ownership, and excluded key-set reads. |
| `test/support/doubles/organizations/directory-double-records.ts` | 4 | Explains deliberate credential fixtures, failing pages, and the permissionless default after the last role is removed. |
| `test/support/doubles/organizations/organization-directory-double.ts` | 6 | Documents the fake's stateful behavior, current authority, paging/fault controls, and invited-role-only reactivation. |
| `test/support/doubles/workos/workos-fake-directory.ts` | 18 | Records provider behavior reproduced by the fake: default roles, cursor position after changes, reactivation, role/resource addressing, and idempotent role operations. |
| `test/support/doubles/workos/workos-fake.ts` | 33 | Documents model inputs and provider-specific fixture semantics for credentials, external IDs, overlapping pages, faults, token expiry, and invitation acceptance. |
| `test/support/processes/module-paths.ts` | 16 | Explains the mandated single path owner, source versus emitted layout, build prerequisites, isolated container inputs, and scripts that run directly from source. |
| `test/unit/auth-workos/fixtures/workos-organizations-double.ts` | 19 | Documents pinned SDK field/error shapes, fixture authority/time, read/write spy behavior, preserved roles, and secret-free failures. |
| `test/unit/auth-workos/workos-organizations-members.test.ts` | 1 | Explains the direct-ID and page consistency of the shared membership fixture. |
| `test/unit/auth-workos/workos-organizations-memberships.test.ts` | 3 | States forbidden access-resolution calls and the cursor/recording semantics needed to check complete current membership reads. |
| `test/unit/auth-workos/workos-organizations.test.ts` | 2 | States the same no-write access-resolution boundary and the query observations used by the tests. |

## File-size findings

Two new test files cross the line threshold. Eleven files were already over
the threshold in the parent; two of those source files change in this slice.
All counts below are physical lines from the pinned Git blobs.

| File | Parent → candidate lines | Reason retained |
| --- | ---: | --- |
| `src/accounts/providers/workos/workos-organizations.ts` | 430 → 440 | One provider adapter owns its wire-to-domain mapping and SDK semantics. The new read guard applies to existing reads. Separating each guarded read would obscure shared provider interpretation and add boundaries unrelated to this ticket. |
| `src/app/application.ts` | 224 → 229 | One composition root owns provider/account assembly, public request routing, and shutdown order. The new closure links the existing owners; splitting it would make order harder to see. |
| `test/unit/organizations/membership-removal-lifetime.test.ts` | 0 → 230 | Thirteen focused cases cover the same server lifetime: exact/cumulative deadline, shutdown, late replies, and signal propagation. They share a timing fixture but remain independent. A split at the threshold would separate the same stop invariant. |
| `test/unit/organizations/membership-removal-rules.test.ts` | 0 → 213 | One suite covers current membership safety, using scenario tables for one-dimension refusals. Actor/target reconciliation and complete Admin count must be reviewed together. |
| `test/acceptance/auth/hosted-live/administration-proofs.ts` | 206 → 206 | One live evidence driver compares application reads with provider facts; its proof boundaries stay adjacent. |
| `test/acceptance/auth/hosted-live/administration-server.ts` | 288 → 288 | One live site/driver owns server diagnostics, browser actions, and credential-safe observations. |
| `test/integration/auth/workos-provider-administration.test.ts` | 406 → 406 | One real-package integration composition supports a matrix of provider administration results, rather than separate duplicated sites per result. |
| `test/integration/auth/workos-provider-organizations.test.ts` | 234 → 234 | One browser/MCP integration composition checks organization selection and current role access through the same fixtures. |
| `test/support/doubles/workos/workos-fake-directory.ts` | 205 → 205 | One fake directory owns related membership/role routes over the same provider state. |
| `test/unit/auth-workos/fixtures/workos-organizations-double.ts` | 234 → 234 | The double keeps the SDK-shaped state and the methods that change or observe it together. |
| `test/unit/auth-workos/workos-organizations-members.test.ts` | 291 → 291 | One adapter member contract matrix covers current facts, safe mapping, and deletion effects. |
| `test/unit/auth-workos/workos-organizations-memberships.test.ts` | 227 → 227 | One current-membership contract matrix covers permissions, complete pages, and failure behavior. |
| `test/unit/auth-workos/workos-organizations.test.ts` | 285 → 285 | One provider access-resolution matrix keeps its no-write boundary and exact query observations together. |

## Changed source and test inventory

Every changed source/test file is listed here, including files with no hook
finding. A zero is limited to this report's hook selection; it is not a claim
that the file has no possible defect.

| Changed file | Reported categories and disposition |
| --- | --- |
| `src/accounts/organizations/change-records.ts` | 16 comment lines: retain contract text; two inherited lines corrected in `fb9b0fd0`. |
| `src/accounts/organizations/directory-reads.ts` | 4 comment lines: retain completeness and duplicate policy. |
| `src/accounts/organizations/membership-removal-checks.ts` | 1 parameter finding and 1 comment: retain explicit rule inputs and snapshot reason. |
| `src/accounts/organizations/membership-removal-lifetime.ts` | 2 comment lines: retain cancellation and uncertainty limits. |
| `src/accounts/organizations/membership-removal.ts` | 2 parameter findings: retain explicit per-operation completion context. |
| `src/accounts/organizations/organization-administration.ts` | 16 comment lines: retain public authority/result contracts. |
| `src/accounts/organizations/organization-directory.ts` | 31 comment lines: retain portable data and read-cancellation contracts. |
| `src/accounts/organizations/removal-operation-store.ts` | No finding. |
| `src/accounts/providers/workos/workos-organizations.ts` | 55 comment lines and inherited size threshold: retain provider semantics and cohesive adapter. |
| `src/app/application.ts` | 16 comment lines, inherited parameter threshold, and inherited size threshold: retain composition/close authority. |
| `src/app/logging-storage.ts` | 2 comment lines: retain shared runtime and sender ownership. |
| `src/logs/audit/pg-destination-settings-store.ts` | No finding. |
| `test/acceptance/auth/membership-removal-restart.runtime.ts` | No finding. |
| `test/acceptance/auth/membership-removal.runtime.ts` | No finding. |
| `test/acceptance/logging/audit/hosted-storage-failure.runtime.ts` | No finding. |
| `test/integration/auth/hosted-storage-lifecycle.test.ts` | 1 comment: retain tested shutdown dependency. |
| `test/integration/auth/workos-removal-lifetime.test.ts` | No finding. |
| `test/integration/logging/audit/removal-operations.runtime.ts` | No finding. |
| `test/support/processes/membership-removal-child.ts` | 1 comment: retain safe child failure output boundary. |
| `test/support/processes/membership-removal-process.ts` | 1 comment: retain owned-process termination boundary. |
| `test/support/processes/module-paths.ts` | 16 inherited comment lines: retain source/emitted/container path rules. |
| `test/unit/auth-workos/workos-organizations-read-lifetime.test.ts` | No finding. |
| `test/unit/logging/audit/pg-removal-operation-store.test.ts` | No finding. |
| `test/unit/organizations/fixtures/membership-removal-fixtures.ts` | No finding. |
| `test/unit/organizations/membership-removal-lifetime.test.ts` | New size finding: retain one complete lifetime behavior suite. |
| `test/unit/organizations/membership-removal-outcomes.test.ts` | No finding. |
| `test/unit/organizations/membership-removal-rules.test.ts` | New size finding: retain one current-membership safety suite. |

The former non-null-assertion and unused-export categories no longer appear in
the complete report. Their earlier fixes remain in the candidate. No category
or location from the supplied report was suppressed or snoozed.
