# S2.5-R1 final metric dispositions

Candidate: `076e661d830b969bf233522e1163c22cd1934361`. Actual parent: `0530dd634fe8302b55d4a0669463ef733199cc40`.
Full process base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.

Metrics disposition approved. The full-main process completes Delta, Review and CRAP with retained goal misses and Architecture passes; these are complete stages, not tool failures. Actual-parent snapshots and CRAP pass. All 14 machine-classified changed/new functions have measured 100% coverage and pass their strict applicable goal; none needs an exception. The checker reports T2 Need architect, preliminary local eligible, no blockers. Required human approval remains separate.

The [full per-location JSON](metric-dispositions.json) records all 30 current native regressions, 20 measured full-main source-file notes, 327 full-main function rows, all 14 parent-relative changed/new functions, exact report hashes, inherited reasons and byte scope. Prior inventory SHA-256: `3c6741c5824ae15405f66ae76f38cf1a86b695e9dd893eba254bc3e972665cbc`, from [the immutable S2.5-02 inventory](https://github.com/tomer-mayara/Thermus/blob/339b5716dab08f2195c2d88330a7707b776fca52/review-evidence/s2-5-02/806ccc573c6ae09c411a47a755d6dd9316343f8f/review/metric-dispositions.json). Reuse claims distinguish current/parent/prior hashes; changed R1 files have fresh reasons.

## R1 source files

| File | Actual-parent MI | Candidate MI | Disposition |
| --- | --- | --- | --- |
| src/accounts/organizations/membership-removal-checks.ts | 61.01765055781432 | 61.01765055781432 | Keep complete current authority, exact direct/paged target agreement, supported grants and the last-Admin decision in one safety owner. R1 changes only the page collaborator and facts type; total paths remain 43 and the largest function has 9. Per-guard files would hide ordering. |
| src/accounts/organizations/organization-directory.ts | N/A | N/A | Type/interface-only module has no raw runtime MI; explicit N/A, not missing required evidence. |
| src/accounts/providers/workos/workos-organizations.ts | 47.08422952684704 | 45.14186681028025 | The adapter owns WorkOS wire interpretation, current catalog mapping, raw management evidence, revisions and stop-guarded reads. R1 adds one explicit three-path facts page and one one-path projection; existing display enrichment remains separate. The facts projection prevents duplicated safety mapping. A new reader framework or moving individual guards into files would hide the facts/display contract. |

WorkOS native53.483 → 45.142 is a full-main finding. R1 is 47.084 → 45.142 (drop 1.942), not an 8.34-point R1 drop. Removal checks stay 61.018 with 43 total paths. The directory type module has no runtime MI.

## Changed/new function goals against actual parent

| File / source line | Function and owner | Change | Paths | CRAP | Goal |
| --- | --- | --- | --- | --- | --- |
| src/accounts/organizations/membership-removal-checks.ts:17 | checkRemoval (module) | changed | 9 | 9 | CRAP<30: pass |
| src/accounts/organizations/membership-removal-checks.ts:33 | targetRefusal (module) | changed | 5 | 5 | CRAP<30: pass |
| src/accounts/organizations/membership-removal-checks.ts:41 | removalSupported (module) | changed | 4 | 4 | CRAP<30: pass |
| src/accounts/providers/workos/workos-organizations.ts:161 | workos-organizations\WorkOSOrganizations.memberFactsPage (ClassDeclaration:WorkOSOrganizations) | new | 3 | 3 | CRAP≤15 (and <30): pass |
| src/accounts/organizations/membership-removal-checks.ts:24 | (anonymous) (FunctionDeclaration:checkRemoval) | new | 1 | 1 | CRAP≤15 (and <30): pass |
| src/accounts/organizations/membership-removal-checks.ts:24 | (anonymous) (FunctionDeclaration:checkRemoval/ArrowFunction:@1535) | new | 1 | 1 | CRAP≤15 (and <30): pass |
| src/accounts/organizations/membership-removal-checks.ts:52 | targetFacts (module) | changed | 1 | 1 | CRAP<30: pass |
| src/accounts/providers/workos/workos-organizations.ts:313 | memberFactsOf (module) | new | 1 | 1 | CRAP≤15 (and <30): pass |
| src/accounts/providers/workos/workos-organizations.ts:118 | workos-organizations\WorkOSOrganizations. (ClassDeclaration:WorkOSOrganizations/Constructor:constructor) | new | 1 | 1 | CRAP≤15 (and <30): pass |
| src/accounts/providers/workos/workos-organizations.ts:164 | workos-organizations\WorkOSOrganizations. (ClassDeclaration:WorkOSOrganizations/MethodDeclaration:memberFactsPage) | new | 1 | 1 | CRAP≤15 (and <30): pass |
| src/accounts/providers/workos/workos-organizations.ts:165 | workos-organizations\WorkOSOrganizations. (ClassDeclaration:WorkOSOrganizations/MethodDeclaration:memberFactsPage) | new | 1 | 1 | CRAP≤15 (and <30): pass |
| src/accounts/providers/workos/workos-organizations.ts:167 | workos-organizations\WorkOSOrganizations. (ClassDeclaration:WorkOSOrganizations/MethodDeclaration:memberFactsPage) | new | 1 | 1 | CRAP≤15 (and <30): pass |
| src/accounts/providers/workos/workos-organizations.ts:153 | workos-organizations\WorkOSOrganizations. (ClassDeclaration:WorkOSOrganizations/MethodDeclaration:memberPage) | new | 1 | 1 | CRAP≤15 (and <30): pass |
| src/accounts/providers/workos/workos-organizations.ts:272 | workos-organizations\WorkOSOrganizations.memberOf (ClassDeclaration:WorkOSOrganizations) | changed | 1 | 1 | CRAP<30: pass |

Anonymous short names and machine new classifications are preserved, including the untouched default-clock callback. Identity/owner/offset remains in JSON; a short repeated name is not evidence of new authorship. The new facts page has 3 paths/CRAP 3; projection 1/1. Existing safety functions top out at 9.

## Every current native high finding

- **.cache/s25-r1/prepare-review-evidence.py:32: new-complex-function.** Ignored cache-only packager inventories/stages exact candidate-bound reports, snapshots, review notes and source copies. Its explicit candidate, clean-tree, safe-path/extension and publication-inventory checks explain the decision count. It is not committed production, test or repository tooling. Retain the real finding/path in this report; do not describe it as a production regression or claim a Git-parent byte match. Scope: ignored cache artifact outside Git candidate. New local cache artifact; no inherited byte claim.
- **src/accounts/organizations/membership-removal-lifetime.ts:6: new-violation:maintainability.** One lifetime owns the total deadline, admission uncertainty, read-stop signal, guarded continuations and one result. Separating timer, stop and result state would obscure release-once and no-late-dispatch rules. The class-level native finding (70) differs from file MI (73.50). Scope: unchanged from actual parent. Prior reason/file hash retained in JSON; exact prior recorded-byte match: true.
- **src/accounts/organizations/membership-removal.ts:7: new-violation:maintainability.** One removal owner keeps current authorization, durable admission, current target checks, one provider dispatch and operation-bound terminal completion in order. Splitting those phases across owners would scatter no-replay and exact-receipt authority without reducing decisions. Scope: unchanged from actual parent. Prior reason/file hash retained in JSON; exact prior recorded-byte match: true.
- **src/accounts/providers/workos/workos-organizations.ts: maintainability-regression.** The adapter owns WorkOS wire interpretation, current catalog mapping, raw management evidence, revisions and stop-guarded reads. R1 adds one explicit three-path facts page and one one-path projection; existing display enrichment remains separate. The facts projection prevents duplicated safety mapping. A new reader framework or moving individual guards into files would hide the facts/display contract. Scope: changed source file in R1. Prior reason/file hash retained in JSON; exact prior recorded-byte match: false.
- **src/logs/audit/pg-destination-settings-store.ts: maintainability-regression.** The adapter keeps short atomic SQL, expected-revision and exact-operation predicates, result mapping and shared-pool ownership together. Coupling counts existing storage/organization contracts and runtime owners, not a new source edge. No transaction spans provider HTTP. Scope: unchanged from actual parent. Prior reason/file hash retained in JSON; exact prior recorded-byte match: true.
- **test/integration/auth/workos-connection.test.ts: maintainability-regression.** One integration contract keeps the pinned SDK timeout, no-retry behavior and exact provider-write counts visible together. Longer fixture and failure assertions protect those timing/write guarantees. Tests have no production MI target. Scope: unchanged from actual parent. Prior reason/file hash retained in JSON; exact prior recorded-byte match: true.

All medium/low locations and reasons remain in JSON, including current cache provenance, packaging, publication and hook-report generators. They are ignored evidence helpers, not shipped source. The inherited full-main test MI/Halstead and facade declaration-coupling findings retain their prior reasons after explicit hash checks. No giant inherited table is needed in the PR summary.

## Unknowns and exceptions

Verified unit/integration/acceptance capture binds current SHA, 172 source files, 1327 processes and one build fingerprint. All three capture records are verified at the candidate. Full-main unknown composeLoggingStorage has 1 path and CRAP bound [1,2]; it is unchanged from parent, and both goals pass from the bound. Unchanged encodeAuditEvent has 4 paths and bound [4,20]; its inherited bound 20 exception expires 2026-12-23. Do not label either as measured coverage. Full-main eventAttributes CRAP 16 is an advisory 15-target miss on a changed legacy function; it remains below 30 and is unchanged in R1. No R1 function has unknown coverage or an unknown classification.

The exceptions file is byte-identical to actual parent and prior candidate. No new/expanded or increment-used exception appears in the checker. Existing checks MI and encoder bounds stay recorded; an existing low-MI file does not become an added file. Keep all full-main inherited reasons and source hashes in the linked JSON.

## Checker information and limits

- **49 public modules, 1 snapshot changed** Exactly one existing public module declaration changes: facts base type plus memberFactsPage. Other49-module membership and15 registry Mermaid views remain. This fact selects T2 and is declared.
- **public module touched, declarations unchanged: src/accounts/organizations/administration-overviews.ts (imports changed src/accounts/organizations/membership-removal-checks.ts)** Transitive declaration generation touches this import-dependent module, but its emitted public declarations compare equal. No caller-visible contract change is inferred from a type import dependency alone.
- **public module touched, declarations unchanged: src/accounts/organizations/administration-overviews.ts (imports changed src/accounts/organizations/organization-directory.ts)** Transitive declaration generation touches this import-dependent module, but its emitted public declarations compare equal. No caller-visible contract change is inferred from a type import dependency alone.
- **public module touched, declarations unchanged: src/accounts/organizations/customer-roles.ts (imports changed src/accounts/organizations/organization-directory.ts)** Transitive declaration generation touches this import-dependent module, but its emitted public declarations compare equal. No caller-visible contract change is inferred from a type import dependency alone.
- **public module touched, declarations unchanged: src/accounts/organizations/organization-administration.ts (imports changed src/accounts/organizations/organization-directory.ts)** Transitive declaration generation touches this import-dependent module, but its emitted public declarations compare equal. No caller-visible contract change is inferred from a type import dependency alone.
- **ratchet.review_findings_high: src/accounts/providers/workos/workos-organizations.ts: Maintainability index: 53 -> 45 (below 85 is hard to maintain)** Native full-main WorkOS MI53.483 → 45.142 is retained with adapter ownership reason above. Actual-parent MI47.084→45.142 drops1.942; the native high is an informational retained finding, not an extra architecture fact or a new8.34-point R1 loss.
- **5 findings on unchanged files, reason unchanged by this PR.** Five of six native highs lie outside the changed-file increment, including the ignored cache high. That count is not a claim that all those cache paths are Git tracked or byte-identical to parent.
- **Local eligibility is preliminary.** Manager checks and independent current-head human architect approval remain required.

Both snapshot dependency reports retain the same unresolved user-portal CSS import. The native global report withholds its edge/cycle delta on that incomplete evidence; it alone cannot prove global absence. The authoritative PR checker and manager review of every changed import establish the R1 increment's unchanged component/module edge set. No UI/CSS import changes, so this native global limitation does not make the inspected R1 increment uncertain. Full-main architecture bands have app 1 / audit 5 unknowns and zero known≥30 functions, not an exact global zero guarantee. Historical trend/base-coverage estimates and gaps remain in process.md. No metrics/build/test/cloud command or coverage edit ran in this review.

Cache declaration copies were also compared with the actual parent administration declaration: SHA-256 `5550ea08a3ed1080e66a90da5933f5bdd23fa664b10ac894ef741a188d23a7ec`; all three copies match those bytes. Cache helper hashes are review-time observations, not proof of metric-capture-time cache bytes.
