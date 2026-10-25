# Slice 2.5 domain and WorkOS review

Reviewed SHA: `806ccc573c6ae09c411a47a755d6dd9316343f8f`.
Comparison base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546` (`origin/main`).
Review date: 25 October 2026.

I read AGENTS.md and docs/coding-principles.md. I reviewed source and tests independently before any previous PR review comments. I used the WorkOS skill for provider facts. No source or tracked file was changed. I wrote only this evidence and the cache-only probe and its JSON output.

## Finding: P2 — Removal hydrates display email for every member before its safety decision

Primary location: `src/accounts/organizations/membership-removal-checks.ts:24`.
Supporting locations: `src/accounts/providers/workos/workos-organizations.ts:154-156,262-266`; `src/accounts/organizations/membership-removal-lifetime.ts:3,34-49`; `src/accounts/organizations/membership-removal.ts:41-46,51-54`.

The safety check calls the display-oriented member page. The WorkOS adapter calls getUser once for every membership, in sequence, to supply email. The safety decision uses membership ID, subject, status, management, revision and grants; it never uses email. All these display reads occur after the durable intent is admitted. A routine complete scan can consume the fixed 30-second lifetime and create a permanent pending hold, even though no DELETE was sent.

Reproduction through the real WorkOSOrganizations and OrganizationAdministration:

- Provide 100 active members in one page, one acting Admin, and an ordinary User target with a current revision.
- Make all membership, role-catalog and storage calls immediate.
- Make each getUser completion advance both monotonic time and the fake timer by 300 ms. This models successful, bounded network calls, not an outage.
- The direct target enrichment and 99 page enrichments consume 30 seconds. The first request returns unknown. The next valid request returns busy. The durable operation remains pending. DELETE count is zero.

Observed output from the read-only stdin probe:

```json
{"activeMembers":100,"simulatedLatencyPerUserMs":300,"elapsedMonotonicMs":30000,"userEnrichmentReads":100,"deletes":0,"first":"unknown","second":"busy","operationOutcome":null}
```

The same probe is saved as `.cache/s25-review/member-read-budget-probe.mjs` for an independent rerun. It checks the source SHA and asserts all six outcomes above. Run `node --import tsx .cache/s25-review/member-read-budget-probe.mjs`. The saved rerun exited 0; its output is `.cache/s25-review/member-read-budget-probe.json`, with the command, reviewed SHA and explicit clock units. It does not call live provider or SQL services.

Why tests miss it: ordinary rule cases have immediate getUser calls. Lifetime cases prove safe stopping and retained holds; they do not test successful per-member latency against useful organization capacity. Ten pages is an upper bound, not a capacity promise, so this is an availability/cost defect rather than a false claim that the implementation breaks its stated stop rules. The latency is simulated; no production latency measurement was made.

Smallest correct repair: let removal read complete safety facts without per-member display enrichment. Keep all pages, all current grants, management evidence, revisions, current actor checks, duplicate handling and the last-Admin decision. Keep the 30-second lifetime and the no-replay/hold rules. Avoid an unbounded Promise.all or a larger deadline as a substitute. If a guaranteed provider response already supplies the email, retaining it could remove duplicate reads; verify that guarantee before changing the adapter. Otherwise add a narrowly scoped facts read rather than making the full directory API generic. Add a behavior case for a moderately sized organization with bounded read latency.

## Rules that appear correct

- Initial authority precedes durable admission. Authority and target facts are checked again after admission. Browser selection grants nothing.
- The target must be ordinary, active, current, and contain only supported User/Admin roles. Permissionless extra roles are retained and refused. Explicit false is the only WorkOS evidence that establishes ordinary management.
- Admin counting requires product access and both management permissions. Pending/inactive memberships and invitations do not count. Later records replace duplicate IDs. The target snapshot is copied before subsequent awaits, and the paged target must match.
- The SQL hold serializes app removals per organization. Independent provider/operator/IdP changes are explicitly constrained by the plan and runbook; app reads cannot make these globally atomic. I did not classify that known limit as a new race defect.
- A possible send remains unknown on error. Only a confirmed result or known no-send refusal can settle the same operation. Exact terminal receipt readback can recover an uncertain final commit. A mismatch cannot settle a replacement operation.
- The lifetime stops late local continuations before dispatch. The provider checks the shared stop signal around every read substep. Shutdown and expiry do not claim to undo an already-sent request. A terminal SQL write already in flight can finish its own receipt.
- The production WorkOS client has zero retries and a five-second per-call timeout. The source adapter maps normal void DELETE completion to applied, and only the documented directory-managed 422/code to unsupported. Other answers remain uncertain.

Provider source: [WorkOS organization membership reference](https://workos.com/docs/reference/authkit/organization-membership). It documents explicit active-list filtering, permanent membership deletion, and the exact directory-managed 422 refusal. I inspected the installed pinned SDK 11.0.0 deletion and transport code as well as the production connection. No live WorkOS mutation tool was used.

## Essential complexity and safe simplification

Retain one durable owner, one per-organization hold, operation identity, terminal receipt confirmation, monotonic lifetime, stop checks at provider read boundaries, complete current safety facts, and explicit unknown outcomes. Replacing these with an in-memory lock, lease, automatic retry, or Promise.race alone loses correctness. The small lifetime class owns a real resource lifetime and is justified. The raw membership reader prevents the SDK serializer from converting absent management evidence to false and is justified.

Remove display hydration from the safety path as above. Consolidate repeated planning prose around one state table: before admission; admitted/no send; possible send; known terminal result; durable terminal receipt. Keep the existing numeric budgets and the distinct evidence needed to leave each state. Do not add a recovery service, status API, or generic operation framework to make the plan shorter.

Release-order clarification is useful but is not a confirmed runtime authorization bug: the implementation record requires actual S2-04 release, exact notice approval/integration/publication/presentation, then production migration after all approvals. Missing storage blocks deletion. There is no runtime legal-approval switch. Name the first write-capable deployment and put approved runtime notice selection and storage activation in one ordered release checklist. Whether merge itself deploys to an already-migrated environment needs deployment evidence; this review did not establish it.

## Verification and limits

The following focused source tests passed: 111 tests, 0 failures, skips or todos, exit 0. Their output was returned through the tool session; a complete raw log was not saved, so none is fabricated here. Command:

```sh
node --import tsx --test --test-concurrency=1 test/unit/organizations/membership-removal-rules.test.ts test/unit/organizations/membership-removal-outcomes.test.ts test/unit/organizations/membership-removal-lifetime.test.ts test/unit/auth-workos/workos-membership-reads.test.ts test/unit/auth-workos/workos-organizations-deletion.test.ts test/unit/auth-workos/workos-organizations-read-lifetime.test.ts test/integration/auth/workos-removal-lifetime.test.ts test/integration/auth/workos-connection.test.ts
```

These cover current authority, target dimensions, actor/count consistency, page and deadline limits, late reads/writes, receipt mismatch/readback, no retry, and controlled HTTP DELETE behavior. I read the real PostgreSQL contention and separate-process crash specifications but did not rerun their container gate. I did not rerun the full ordinary suite, builds, live staging, SQL, browser, deployment, legal publication or migration gates. Existing reports do not substitute for fresh deployed evidence. An unrelated untracked document was present; I did not change it.
