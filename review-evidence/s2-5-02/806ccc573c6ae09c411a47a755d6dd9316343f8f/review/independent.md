# Independent S2.5-02 review

Reviewed 25 October 2026. Parent: `2271545702a8f1ec28c6f7dd913fec7024ecadeb`.
Final reviewed candidate SHA: `806ccc573c6ae09c411a47a755d6dd9316343f8f`.
Reviewed the complete committed increment against the parent, including the plan,
impact declaration, gate commands, runbooks, legal proposal revision 3, and new
test/support files. The final working tree is clean. The later README, inventory, impact declaration,
and status-prose changes have been reviewed at this immutable SHA. Behavioral
gates and final metric sections are complete. No
build, test, cloud write, or source edit was performed by this reviewer.

## Final documentation correction review

The README/test-inventory consistency finding is resolved in committed
`806ccc573c6ae09c411a47a755d6dd9316343f8f`. README names both hosted-live files
and Docker/OpenSSL. The test inventory describes all four controlled SQL cases,
the scoped WorkOS case, exact-ID cleanup, provider/factor/recipient limits and
the dedicated commands. Its hosted-live section matches the current password
profile and labels older MFA/Super Admin expectations historical. The gate table
also names Docker. Final status prose preserves actual gate failures/retries and
all release holds. No code, document, or declaration correction remains open.

## Impact declaration review

The committed architect `contract` flag is correctly false for this increment against the
actual parent. The playbook defines this flag as a change to an observable
contract across containers or with an external client, including important
guarantees. Production source, public declarations, selected runtime notices,
and deployed/public text do not change. New notice/help bytes remain explicitly
unapproved and unpublished; no existing accepted legal bytes are overwritten.
The new test-only composition options do not form a production component or
external-client contract. The runbook makes the planned unresolved-operation
and restore safety rule concrete without adding a production recovery guarantee
or backup promise. It grants no production-write or release authority.

`policy: true` still describes the changed gate selection and process. Required
team review and separate exact-byte owner legal approval remain. This is a
correction of the declaration before final classification, not permission to
waive a changed guarantee or de-escalate a published final review decision.
The final committed declaration and checker agree with this assessment.

## Proposal revision 3 review

The P2 complete Audit-help mismatch is resolved. Read the revised Audit help
and Privacy sections against logging-page.ts, logging-form.ts, logging-routes.ts,
logging-test-page.ts, and DestinationSettingsService. The copy now explains
Axiom/Custom with Bearer only, no token-removal control, the masked four-character
preview, Save before Test including the enabled state, and no rollback of a
successful Save when Test fails. This agrees with current source behavior. The
future recovery procedure also keeps the export switch off until explicit
enable is intended. No source switch or legal approval is inferred.

Recomputed all five revision 3 document byte counts and hashes; they match the
manifest. The current manifest SHA-256 is
`04656d2305ca2eb2aad3099e8736305fa3add27d5fe255d8ee302d8ae9352e05`.
The proposal records earlier unapproved review hashes and keeps the prior frozen
bundle and agreement. No new content blocker was found in this revision.

## Earlier review findings and fixes

- Cleanup now catches journal failures and still runs exact-owned-ID cleanup and
  every verification. It aggregates failure evidence after these attempts.
  The prior journal-before-cleanup blocker is resolved in source.
- Live self-removal now reads the emitted workspace and sign-in links. It
  follows the guidance, completes AuthKit when needed, checks the return to the
  selector, and selects the only surviving eligible workspace. The prior
  root-page-sign-in substitution is removed.
- Other-workspace and rejoin Connect grants now check OAuth state, as the
  initial grants do.

## Acceptance and fixture review

The integrated runtime has four cases: complete removal with a retained session,
complete removal with controlled provider session ending and reauthentication,
enabled SQL-backed export failure, and actual stopped-PostgreSQL refusal while
portal and an MCP product call remain usable. It uses the real hosted HTTP
composition, removal coordinator, SQL store, snapshots, Collector, authorization,
and product pipeline. Its provider, factor sentinels, export transport, and
renderer seams remain controlled and are labelled as such. The manager's
`integrated-runtime-3.log` reports 4 passed, 0 failed, 0 skipped, and 0 todo. The
fixture corrections are recorded separately; no false red was introduced.

The live proof creates fresh exact organization, user, membership, and client
IDs. It does not invoke the broad stale-fixture sweep. Resource registration
precedes journal writes. Cleanup deletes only registered fixture resources and
checks exact IDs. It verifies ordinary-management facts, stale/foreign/User/CSRF
refusals, exact provider deletion, browser/MCP denial, counts, last-Admin refusal,
other account/membership access, emitted recovery guidance, and a replacement
membership with only the new invited role. No passwords, Bearer tokens, OAuth
codes, or invitation links appear in its evidence calls. Factor and privileged
API-invitation-acceptance limits are explicit.

The earlier live record ended with organization cleanup-read failures; it is
retained as failure history. The final isolated run in
`removal-live-isolated.log` passes 1/1 with no skips or todo. Its exact run ID is
`s25-02-mvnrfbo3-d99a20`; the journal records all owned organization, user,
application, and membership cleanup reads and ends `cleanup-complete` with an
empty failures list. Cleanup uses bounded exact-ID reads after deletion; it
never retries DELETE. The code does not turn a timeout or unexpected response
into a successful absent result.

The live journal identifies the then-HEAD `2d196cc...` and a dirty working tree.
The manager's tested-files.json binds all six current test/support files by
SHA-256. Independently compared each recorded hash to its committed bytes in
`b429c308...`: all six match. This preserves the actual precommit-run provenance
without pretending the live run happened after the commit.

The ordinary staging selection records 29 cases: 28 passed and one failed
with WorkOS HTTP 408. The affected complete operator group then passed 5/5.
Publication keeps the original failure; it is not an initial full-command pass.
Independently read the final native container log (11/11) and hosted AMD64 log
(7/7, including the parent); neither has skips, todo or failures. The temporary
owned Docker profile was removed, with the original context/services retained
as the manager cleanup record states.

## Runbooks, proposal, and gates

The removal runbook separates current access reads from settlement evidence. It
forbids blind retry, independent parallel reductions, global-user/factor repair,
and destructive replacement of later memberships or grants. The restore hold
uses effective SQL privileges outside restored rows, closes old senders and
sessions, excludes ACL replay, requires a no-delete admission check, and keeps
independent reconciliation before release. Exact pending-row compare-and-set
and manual one-row confirmation agree with the existing schema. No production
backup prerequisite or recovery service is introduced. Slice 4 and the
historical operator procedure point to the new safety rule.

The proposal remains explicitly unapproved and unpublished. It names earlier
S2-04 release, owner approval, source integration, exact-byte publication,
actual presentation, existing-agreement treatment, and capacity as separate
holds. Manual review recomputed all five UTF-8 byte counts and SHA-256 values;
they match the r3 manifest. Current manifest SHA-256:
`04656d2305ca2eb2aad3099e8736305fa3add27d5fe255d8ee302d8ae9352e05`.
All prior v3 bundle files and the agreement are byte-identical to the parent.
This checks artifact consistency, not approval or publication.

The package commands add the new controlled runtime to the PostgreSQL group and
run both hosted-live files in one serial file selection. Their `.runtime.ts`
and `.live.ts` names stay outside ordinary globs. The gate policy describes
these additions and the Docker prerequisite. Shared live helpers select their
real hosted-live consumers; no tests of scripts, prose, or configuration were
added. README, test inventory, plan/status evidence and final check/classification
records are now reviewed at `806ccc57`. Status prose records completed proof
without calling the ticket released or Done.

## Component registry impact

`architecture/components.md` is byte-identical to the parent. Inventory of every
Mermaid block, at current opening-fence lines:

| Line | View |
| --- | --- |
| 30 | Context |
| 61 | Hosted containers |
| 95 | Local containers |
| 146 | Tool processing components in the Node server |
| 198 | Hosted authentication components in the Node server |
| 264 | Hosted membership removal components in the Node server |
| 356 | Hosted Audit settings and delivery components in the Node server |
| 441 | System and Audit log components in the Node server |
| 643 | Local authentication components in the Node server |
| 690 | Collaboration overview |
| 762 | MCP page fetch and renderer cancellation |
| 833 | Hosted default sign-in landing |
| 900 | Hosted member read |
| 1031 | Self-hosted Compose deployment |
| 1056 | Recorded hosted Render deployment |

No `src/`, SQL migration, public declaration snapshot, production configuration,
container/deployment file, dependency, lockfile, architecture rule, or registry
file changes exist against the parent. `package.json` changes gate commands only.
The support options compose existing production parts in tests; they add no
production owner, source edge, callable contract, runtime capability, or Level 2
container. The membership-removal, authentication, Audit, resource-ownership,
and deployment prose remains accurate. Restore guidance records an operator
restriction on the existing store rather than a new production mechanism.

Registry edit, architecture comparison drawing, Mermaid rendering, L4 detail,
API-snapshot regeneration, and production MI/CRAP analysis are N/A for this
increment. No production callable contract changed; there is no L4 review
question that a new diagram would answer. The manager must refresh this
assessment if the candidate gains a source, public contract, registry, or
production configuration change.

## Final metrics and publication review

Read the final process, native review, actual-parent snapshots/CRAP, verified
coverage and checker reports. All four full-main sections completed at `806ccc57`:
Delta, Review and CRAP retain goal misses; Architecture passes. The actual-parent
snapshots have 186 equal file records and CRAP has no rows. All 20 native
regressions have substantive dispositions (5 high, 8 medium, 7 low), with tracked
source/test/declaration bytes verified unchanged and noncandidate cache artifacts
identified separately. See metric-dispositions.json and its concise companion.
No report/coverage value was changed. Inherited exception bytes are unchanged.
The two mapping gaps remain unknown, with conservative intervals [1,2] and [4,20].

Fresh complete selected coverage passed 3,219 backend + 29 portal unit, 1,120
integration, 594 backend + 20 portal acceptance cases. It covers 172 source files
and 1,321 processes in three verified captures at
`1a6abbb2acfd9030e28ae7dc8d9e4b56583f2584`. The coverage SHA-256 matches
final-candidate-binding.json, and its comparison identity matches the final
snapshot. Git confirms that only admin-s2-5-02.md changed from that capture
commit to the final candidate. The earlier incompatible parent capture is not
accepted as final evidence. All six executable test/support hashes still match
the passing-run binding.

Final Habit Hooks has 464 retained findings: 7 complexity, 5 parameters, 435
comments, 17 file-size findings. All have reasons; 437 inherited reasons were
reused only after whole-file hash equality. Five initial non-null assertions
are corrected and absent from the final hook. Snooze remains empty. The
inventory is refreshed to the final hook hash and `806ccc57`.

Reviewed pr-body.md and publication-text/{README,VALIDATION,QUALITY}.md. They
distinguish full-main inherited goal misses from the empty parent increment;
state 464 hook findings, actual precommit test provenance and fresh capture `1a6abbb2`;
retain 29 WorkOS selections / 28 passes / one 408 plus 5/5 retry; and preserve the
explicit publication, integration, earlier release, production storage/capacity
and deployed-journey holds. The exact T1 reasons are read_paths for the test gate
policy and impact.policy; architecture facts are empty. The earlier statement
that contract documents mechanically select this tier is superseded by these
exact checker reasons. Two minor evidence-wording fixes clarify the inherited
checks score and declaration-file scope. No material publication inaccuracy
remains. Substitute actual Validation/Quality comment URLs for footer placeholders
and read back the published bodies as the manager workflow requires.

## Final sign-off and limits

The complete `806ccc57` increment passes independent agent review. No source,
test, document, impact declaration or architecture correction remains open. The
checker reports T1 Team review, preliminary local eligibility, no blocker, no
architecture fact, unchanged 49 snapshots and the 2,189-line size note. Complete
notice bytes, review patch, cohesive proof and runbooks account for that size.
Required current-head independent authorized human team/owner approval and the
unmerged parent remain merge holds. This agent sign-off is not human approval,
legal approval, a release decision or merge authority. Actual earlier release,
exact owner approval, runtime notice/help integration and presentation, public
publication, production migration/capacity checks and deployment remain open.
