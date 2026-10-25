# S2.5-01c habit-hook dispositions

Reviewed the complete-candidate hook report against parent `0ff3f6cdde5be4124df0ed2ab002844d5db1c502`.
Candidate at review: `cd7ccf3a3b543ad94bf9fe9d88a205b93f84bcf4`. The per-file content hashes in
[the JSON inventory](habit-dispositions.json) bind the reviewed source and test text.
The final hook verifies the non-null fix. Two inherited comment lines need correction.

The final report contains **439 findings**: 6 complexity, 5 parameter count,
412 comment lines, and 16 file size findings. The snooze
file remains `[]`. Every location has a disposition and reason in the inventory.

## Required correction

The new `events[0]!` reported at `test/unit/logging/audit/audit-removal.test.ts:14`
was replaced with an explicit `assert.ok(event)` after the first full suite ended.
The manager verified the four changed test files: 29/29 passed. Commit `cd7ccf3a`
contains the fix; the final hook has no non-null assertion.

The final selection adds 15 inherited comment lines and one inherited size finding
from `hosted-workos-administration.test.ts`. Lines 116–117 incorrectly describe
a single-role provider write above the generic `changeRecords` parser. These two
lines need deletion or correction; no source or test edit was made during this review.
The initial 424-finding record remains in [the initial inventory](habit-dispositions-initial.json).

## Complexity and parameter findings

| Location | History | Reason retained |
| --- | --- | --- |
| `src/app/hosted-workos-application.ts:97` | Unchanged function in parent | Composition keeps override precedence, optional capture lifetime, and cleanup transfer visible at one assembly boundary. Splitting each optional override into a factory would obscure ownership. |
| `src/interfaces/web/account/administration-routes.ts:181` | Unchanged invitation function in parent | The flat invitation boundary preserves method, origin, form, selected-organization, uncertain-effect, and final-result decisions in order. This PR does not add removal to that outcome state machine. |
| `src/logs/audit/audit-event-projection.ts:30` | Unchanged function in parent | Input validation and redaction distinguish the two supported tool payloads, URL authority restrictions, and text bounds before capture. A generic mapping would weaken the explicit accepted-input contract. |
| `src/logs/audit/audit-event-projection.ts:73` | New function | Three explicit action-to-target cases accept only named metadata. They enforce email for invite, invitation ID for invitation updates, and membership ID for removal. The guards remain flat and prevent arbitrary fields from reaching customer logs. |
| `src/logs/audit/otlp-audit-encoding.ts:22` | Existing function changed | The encoder owns one finite Audit event union and its OTLP attribute validation. Removal adds one explicit target shape; retained branches preserve per-event numeric and byte constraints. A generic object serializer would expose fields outside the contract. |
| `test/acceptance/auth/hosted-member-removal.test.ts:26` | New acceptance scenario outline | Ten independent executions each change exactly one valid removal precondition. The setup branches make the changed axis visible beside the shared no-deletion/no-applied-receipt assertions; they do not combine multiple changes in one test. |
| `src/accounts/organizations/membership-removal-checks.ts:17` | Unchanged four-argument function | The directory, actor, target request, and guarded read lifetime are separate authority inputs. A parameter bag would rename the list without reducing coupling. |
| `src/accounts/organizations/membership-removal.ts:49` | Unchanged five-argument function | The admitted phase keeps actor/request, exact intent, available store, and per-call lifetime explicit. Moving call state onto a reusable service risks cross-request sharing. |
| `src/accounts/organizations/membership-removal.ts:66` | Unchanged five-argument function | Completion distinguishes durable intent, terminal receipt, caller outcome, store, and lifetime. Keeping those values together makes uncertain commit behavior reviewable. |
| `src/app/application.ts:154` | Unchanged four-argument function | Config, provider parts, account parts, and shared storage are distinct composition inputs at their existing owner; they define cleanup and routing order. |
| `src/interfaces/web/account/administration-routes.ts:204` | Existing four-argument function; target union extended | Checked scope, action, form target, and result are distinct facts assembled only at the safe capture boundary. No new arity is added. A wrapper object would hide the distinction between trusted tenant and submitted target. |

## Comments

Only six reported comment lines are new or changed relative to the actual parent.
The added hook coverage of web and Audit files explains most of the larger count.
These six state trust, lifetime, or evidence limits, or correct dispatch wording.

| Location | Reason retained |
| --- | --- |
| `src/accounts/organizations/administration-overviews.ts:21` | The view states which roles are displayed, the count unit, complete-page behavior, and credential exclusion. Its new removable field is a display snapshot, not authority to bypass current checks. |
| `src/accounts/organizations/membership-removal-checks.ts:40` | The new display hint must not replace current target checks. The existing snapshot note explains why mutable provider facts are copied before awaits. |
| `test/support/in-process/workos-site.ts:24` | The composition notes distinguish real product/server behavior from the WorkOS fake, specify override and signup order, and define teardown ownership. The new portal asset note states why geometry proof loads the production build. |
| `src/interfaces/web/account/account-pages.ts:96` | Fixed text avoids untrusted interpolation. A completed removal response must not depend on the next Members read, and denied access must retain identity-only recovery guidance. |
| `src/interfaces/web/account/account-routes.ts:93` | The comments specify current-access versus operation authority, cookie ordering after failures, identity-only recovery, dispatch precedence, origin-first parsing, base-path scope, and copied trusted context lifetime. |
| `test/support/doubles/organizations/removal-operation-store-fake.ts:3` | The fake proves browser admission and receipt behavior only. Real persistence remains the separate PostgreSQL gate; this limit prevents overstating the acceptance proof. |

The other 406 reported lines remain in the parent. Their current contract and
evidence purposes were checked; all have individual locations and per-file reasons
in the JSON inventory. [The parent review](https://github.com/tomer-mayara/Thermus/blob/e87fa04a948f840ea021c2f83797b774fbd4ec86/review-evidence/s2-5-01b/0ff3f6cdde5be4124df0ed2ab002844d5db1c502/review/habit-dispositions.md) supplies the earlier full
dispositions. In particular, the inherited unknown-result wording now correctly
covers uncertain admission and finalization. The new browser route comments match removal behavior. The two stale legacy
test comments are the only open habit correction.

## File size

| File | Parent → candidate lines | Reason retained |
| --- | --- | --- |
| `src/accounts/providers/workos/workos-organizations.ts` | 440 → 440 | One provider adapter owns wire-to-domain mapping, SDK result semantics, and guarded reads. These rules share provider interpretation; splitting individual reads would obscure it. |
| `src/app/application.ts` | 229 → 229 | One composition root owns provider/account assembly, public request routing, and shutdown order. It must show removal stopping before the shared SQL runtime closes. |
| `src/interfaces/web/account/administration-routes.ts` | 191 → 215 | One checked browser administration owner holds tenant scope, native forms, result mapping, and safe Audit capture. The 215-line file has short distinct page/change methods; a separate removal router would duplicate or export its trust boundary for one operation. |
| `test/acceptance/auth/hosted-live/administration-proofs.ts` | 206 → 206 | One live evidence driver compares application reads with provider facts; its proof boundaries stay adjacent. |
| `test/acceptance/auth/hosted-live/administration-server.ts` | 288 → 288 | One live site/driver owns server diagnostics, browser actions, and credential-safe observations. |
| `test/acceptance/auth/hosted-workos-administration.test.ts` | 349 → 352 | One hosted acceptance composition covers the current-access and invitation journeys with the same WorkOS fake, HTTP driver, and exact provider-write observations. Its six added form assertions preserve the former scope; a threshold-only split would duplicate those shared journey facts. |
| `test/integration/auth/workos-provider-administration.test.ts` | 406 → 406 | One real-package integration composition supports a matrix of provider administration results, rather than separate duplicated sites per result. |
| `test/integration/auth/workos-provider-organizations.test.ts` | 234 → 234 | One browser/MCP integration composition checks organization selection and current role access through the same fixtures. |
| `test/support/doubles/workos/workos-fake-directory.ts` | 205 → 205 | One fake directory owns related membership/role routes over the same provider state. |
| `test/unit/auth-workos/fixtures/workos-organizations-double.ts` | 234 → 234 | The double keeps the SDK-shaped state and the methods that change or observe it together. |
| `test/unit/auth-workos/workos-organizations-members.test.ts` | 291 → 291 | One adapter member contract matrix covers current facts, safe mapping, and deletion effects. |
| `test/unit/auth-workos/workos-organizations-memberships.test.ts` | 227 → 227 | One current-membership contract matrix covers permissions, complete pages, and failure behavior. |
| `test/unit/auth-workos/workos-organizations.test.ts` | 285 → 285 | One provider access-resolution matrix keeps its no-write boundary and exact query observations together. |
| `test/unit/organizations/membership-removal-lifetime.test.ts` | 230 → 230 | Thirteen focused cases cover the same server lifetime: exact/cumulative deadline, shutdown, late replies, and signal propagation. They share a timing fixture but remain independent. A split at the threshold would separate the same stop invariant. |
| `test/unit/organizations/membership-removal-rules.test.ts` | 213 → 213 | One suite covers current membership safety, using scenario tables for one-dimension refusals. Actor/target reconciliation and complete Admin count must be reviewed together. |
| `test/unit/organizations/organization-administration-members.test.ts` | 186 → 204 | One independent-case suite covers the Members projection and count contract. The new removable hint cases belong beside existing status/grant/identity/pagination cases and reuse the same fixture; a threshold-only split adds no new responsibility. |

The two new threshold crossings are the browser administration owner and its
domain overview test suite. All other size findings were already over the threshold
in the parent. Keeping them is based on the responsibilities above, not on their age.

This review does not replace full validation, metrics goals, or independent human
review. No suppressions, parameter bags, or threshold-only splits were added.
