# Quality review

Candidate: `a3aef3f2633145c685feccd136f8638ce08d58d7`. Trusted base: `7d01d2fb61c1ee0faebd1a1b78819902f832f5f4`. The final local checker reports **T2 Need architect**, **eligible**, `blockers: []`, `factsToDeclare: []`. I accept the retained quality dispositions for manager review. This agent review does not supply current-candidate human architect approval or prove that every gate, owner hold, activation or release condition is complete.

The generated architecture reason is:

> T2: component set changed for 3 components; 8 allowed edges added or widened; 5 public modules added; declarations changed in 4 public modules; 2 registry views added, 4 registry views edited; 13 external imports added; 2 dependency keys added or removed

All 36 architecture/dependency facts and all 82 tier reasons remain in [the full checker report](../quality/tier.json). The authoritative main Architecture comparison shows the facts and four complete changed-declaration diffs. The [machine-readable quality review](../quality/quality-review.json) adds a disposition to every tier reason, every informational note and every policy question. The explicit impact flags describe the complete Slice 2 increment against current main; they cannot reduce review.

## Current quality results and comparison

| Evidence | Final result |
| --- | --- |
| Base/head snapshots | Exit 0; exact final pins. |
| Metrics process | Exit 1; Delta, Review and CRAP are goal misses; Architecture passed. All four sections completed. |
| Standalone CRAP | Exit 1; 0 strict 30 violations; 0 required numeric new/changed misses. Retained unknown encoder target remains unproved. |
| Habit-hooks | Exit 1; 377 retained findings; snooze `[]`. |
| Checker | Exit 0; T2, locally eligible, no blockers or undeclared facts. |
| Public declaration snapshots | 48 committed snapshots; generation/`--check` passed. |

MI remains below 85 in 43 of 46 measured production files. Three meet 85. Two production paths have no executable measurement: the style constant file and destination settings type contract. The final delta also lists nine generated declaration snapshots as unmeasured, making 11 total unmeasured files; these declaration files have no production MI goal. 115 test/support files have no production goal.

Compared with the historical `pr245-merge` report for 785d2076 against b03e2d2c, every head raw file MI, all 437 CRAP rows and all 377 habit counts are identical. The review still has 13 high, 28 medium, 5 low findings and 3 improvements; no added or removed regression finding. File counts changed from 59 to 63 modified and 104 to 109 added, with 9 deleted in both reports. Four changed and five new API declaration snapshots explain that reporting delta. Source/test bytes are unchanged from 785d2076.

The repository keeps 26 MI exceptions and one CRAP exception with their reasons and expiry dates. The checker applies 25: 24 new-file MI exceptions and the encoder CRAP bound. The two moved System sink MI entries remain retained but do not need new-file exemptions after move detection. The projection bound correction from 37 to 36.9 records the exact raw 36.99712939607105 score (display 37.0), retains its ownership reason and 2026-12-24 expiry, and changes no global threshold or baseline. The earlier c280 block remains historical; it is not a passing result.

The 13 high findings retain their reviewed owner reasons: hosted acquisition/disposal composition; current-Admin route checks and safe outcomes; collector FIFO/authority/byte/lifetime accounting; snapshot reservations/freshness/physical reads; SQL deadlines and atomic expected revisions; tenant-bound codec framing; saved-Test and sender physical settlement; and System logger versus console sink responsibilities. One high finding concerns the tool-completion unit file, which has no production MI goal. Class-level warnings and raw file MI remain distinct. Every high finding, every medium/low finding, every below-goal file and each applied exception retains its exact reason in [quality-review.json](../quality/quality-review.json). A mechanical split, generic parser/request framework or collaborator bag would hide these reviewed responsibilities.

## CRAP and coverage limits

There are 437 rows: 211 new, 36 changed, 190 unchanged. The tool's one measured 15-target miss is changed MCP `callTool` at 15.000006075; it meets its applicable strict 30 goal. New `eventAttributes` is exactly 15 and meets the inclusive 15 goal. There is no required numeric CRAP miss.

Ten source mappings remain unknown, including seven new functions. Do not call them uncovered or 100% covered. Their numeric bounds and behavior evidence have different meanings:

| Unknown row | Classification | CRAP bound and retained reason |
| --- | --- | --- |
| OTLP `encodeAuditEvent` | New | [4,20]; target 15 unproved. Retain the explicit 20 exception and 2026-12-23 expiry, encoding/Collector behavior evidence and source-map limitation. |
| Audit `captureAuditResult` | New | [3,12]; 15 holds at any coverage share. Boundary/Unicode/redaction tests verify behavior, not a source coverage percentage. |
| `composeLoggingStorage`, `redactAuditText`, `redactAuditUrl`, `requestAuditExport`, SQL close callback | Five new rows | [1,2] each; 15 holds by one-path bound. Mapping stays unknown. |
| Entry-point deadline `arm` | Unchanged | [2,6]; retain unchanged deadline behavior and unknown mapping. |
| Two entry-point deadline callbacks | Unchanged | [1,2] each; same unchanged reason. |

Fresh coverage ran at 1e6077ce and passed 3,051 backend unit, 29 portal unit and 1,069 integration cases. The final docs-only immutable metrics record changes the commit ID but not compatible inputs; the final tools accepted verified source/input fingerprints. Runtime is Node 24.20.0, compiler TypeScript 7.0.2, unit+integration own-character coverage. V8 own-character share is only an approximation to path coverage. The source fingerprint is `34bab321c6d36d617f28700378ba35e5c15f351b99e747ea7a4a32b4c06475cb` and input fingerprint is `fff78cf2adb7152d40338b0a9843a5b1ecec0b8e76cbf99930da878a2a5569d1`. No coverage file was edited. Prior functional/image results and their input bindings remain owned by the maintained Validation report; this quality review does not relabel earlier tool inputs as current.

The final declaration checker permits 33 TS2883 portability diagnostics in two unlisted, unchanged modules: Better Auth runtime and CSS selectors. It regenerates all 48 listed snapshots successfully. This is an explicit tool limit, not a declaration error in a listed module or proof that every unlisted declaration emits cleanly. `tier.stderr.log` retains the diagnostic. `tier-combined-output.log` keeps the earlier reporting wrapper's JSON parse failure from mixed stdout/stderr; the checker itself exited 0. The pure JSON rerun is complete. The wrapper failure is not a failed required gate, and it is not erased.

## Habit-hooks and architecture limits

The 377 retained habit findings comprise 24 high-complexity sites, 18 test-only non-null assertions, one oversized MCP server factory, seven parameter sites, one entry-point disposal binding, 310 comments and 16 oversized files. Relative to 380596ef, the only additions remain three Audit content safety comments and the capture unit file crossing 200 lines. The comments explain enclosure/fallback rules, the escaped-quote scan guard and validated-URL context. Parameterized malformed-input, public-boundary, Unicode and byte-budget examples still cover one capture owner. Keep this cohesion rather than split only to satisfy length.

Retained complexity keeps distinct authority, admission, retries and resource settlement at the right owners. Explicit parameters keep collaborator roles visible. The `using deadline` binding registers disposal. Existing comments explain security/lifetime/test constraints; large composition/fixture/test files retain their scoped responsibilities. These dispositions retain findings; they do not make habit-hooks exit 0. Full details are in [habit.log](../quality/habit.log) and [quality-review.json](../quality/quality-review.json).

Architecture metrics retain the same unresolved portal CSS import on both revisions and the same coarse cycle count 1 → 1, modularity 0.39 → 0.34 and cross share 0.15 → 0.31. Incomplete community edge evidence does not establish a removed import or a new owner cycle. The owner checker has no forbidden-edge, cycle-growth or undeclared-fact blocker. Base CRAP bands derived from head coverage are estimates, not measured base coverage.

Redaction keeps complete recognized quote/Markdown/autolink boundaries, whole raw query-value redaction, existing byte limits and best-effort capture. Only one level of balanced Markdown parentheses is recognized. Richer syntax keeps the conservative fallback and can lose public syntax without `truncated` becoming true. The finite 64 KB escaped-quote sample improved from about 1.5 seconds to below 1 millisecond; this is not a general performance proof, general document parser, arbitrary-secret detector or lossless-all-formats promise.

## Policy answers

**protected_paths.policy** — Does this change what the checks enforce, or who decides? Record the new rule and why.

The Slice 2 rules name System/Audit owners, exact allowed imports, forbidden cross-log edges, new public modules and the separate PostgreSQL/Collector gates. Existing habit import guards move with the logging owners. Current-main architecture-facts, snapshot verification, skip/todo blocking and report rules are retained without weakening. The only final bound correction is the explicit projection MI 37 → 36.9 exception with unchanged expiry; global thresholds/baseline are unchanged. Source/fixture selection does not run broader suites by a wrapper. T2 facts require independent current-candidate human architect approval.

**protected_paths.contracts** — Does a client, a user or an operator see a different input, output, error or default? Record the promise.

Current Admins can read/Save/Test a tenant-scoped destination. Public UI describes best-effort export, limits and Test meaning; customer capture carries named bounded redacted input/result, and System messages remain private. SystemLog replaces ApplicationLogger at process/tool composition; Audit capture is an optional composition dependency; the schema field-status helper is no longer exported, and account-form exports a shared exact-field parser. Generated snapshots expose these actual public differences and no declaration change for organization modules. MCP success/failure and ordinary auth authority retain their public outcomes.

**protected_paths.deploy_and_data** — What changes in the image, the runtime, or the stored data, and how is it rolled back? Record the recovery step.

The stack adds server-only optional PostgreSQL/key/CA settings, a restricted tenant-scoped forced-RLS settings migration, lazy bounded SQL runtime, packaged pg adapter and offline synthetic hosted-image probe. The database stores destination configuration/revisions/encrypted credential only, not event history. Rollback/recovery keeps hosted maintenance or Audit disabled, preserves key/tenant compatibility and has owner-reviewed restore/reconcile procedures; no migration or deployment was executed by this work. The test fixture removes its own anonymous volume at cleanup; no production storage policy changes. Activation/release and a real selected destination smoke remain separate owner holds.

**protected_paths.security** — Does this change admission, trust, permissions, or what untrusted content can reach? Record the guarantee that holds after the change.

Current Admin authority, organization/actor binding, CSRF and exact bounded form fields guard settings mutations. Tenant-bound authenticated encryption keeps token content out of public settings/UI/events. Fresh saved revision/enabled/credential data authorizes each dispatch; snapshots admit work but cannot authorize sending. Public IP/DNS/peer and verified-TLS checks precede credentials/events; no redirect credential forwarding is added. Raw recognized query values remain redacted; defined enclosure recognition preserves public syntax and richer syntax falls back conservatively. Fixed bytes/admission/deadlines/settlement and cancellation clearing bound private data lifetimes. No general secret-free claim or owner rollout approval is made.

**Dependency facts and maintenance.** pg 8.23.1 and @types/pg 8.23.1 are pinned in the manifest/lockfile for the optional PostgreSQL settings adapter. The driver runs only in hosted configured storage; local composition does not load it. Node crypto owns key/nonce handling, DNS/net/HTTPS/TLS support bounded validated delivery, and fs/promises reads server-trusted CA configuration. OTel/path/stream/url allowances move with System diagnostics, retaining the same upstream OTel package. These are explicit dependency facts, not a live storage/delivery claim.

## Informational notes and reasons

These 28 notes do not set a review tier. Each remains visible with its disposition; unchanged public declarations do not prove unchanged internal behavior.

<details>
<summary > All 28 checker notes and their reasons</summary>

1. `48 public modules, 4 snapshots changed, 5 added`

   The committed surface inventory is 48: 43 base modules, 5 added modules, 4 existing declarations changed. Generator and --check pass; added modules and changed declarations are T2 facts, not a second runtime capability.

2. `allowed edge removed: app -> logging (runtime)`

   The old logging owner splits into system-logs and audit-logs. App retains the diagnostic operation through explicit SystemLogger/sink composition and separately composes Audit services. Only the old owner edge is removed; diagnostics remain.

3. `declaration snapshot added: src/logs/system/system-logger.ts`

   Concrete SystemLogger, narrowed info/error role, output sink and log record; sink composition preserves formatting and error propagation. Snapshot text records the existing reviewed source contract; generation adds no runtime call. The module addition is already a T2 fact.

4. `declaration snapshot added: src/logs/audit/destination-settings-service.ts`

   Current-Admin settings service, tenant-bound credentials, atomic revisions, required saved-Test sender and fresh export authorization. Snapshot text records the existing reviewed source contract; generation adds no runtime call. The module addition is already a T2 fact.

5. `declaration snapshot added: src/logs/audit/audit-log.ts`

   Explicit bounded nonthrowing customer events with supported named input/result/administration/destination fields. Snapshot text records the existing reviewed source contract; generation adds no runtime call. The module addition is already a T2 fact.

6. `declaration snapshot added: src/logs/audit/otlp-audit-sender.ts`

   One-shot outcome and tracked-start sender operations, with physical settlement separate from the caller outcome. Snapshot text records the existing reviewed source contract; generation adds no runtime call. The module addition is already a T2 fact.

7. `declaration snapshot added: src/logs/audit/audit-send.ts`

   Destination, safe outcomes, tracked attempt lifetime, sender role and fixed send bounds. Snapshot text records the existing reviewed source contract; generation adds no runtime call. The module addition is already a T2 fact.

8. `external import removed: logging: @opentelemetry/api-logs`

   This allowance moves with unchanged System diagnostic ownership from logging to system-logs. The package/builtin dependency remains declared there; no runtime dependency is claimed removed.

9. `external import removed: logging: node:path`

   This allowance moves with unchanged System diagnostic ownership from logging to system-logs. The package/builtin dependency remains declared there; no runtime dependency is claimed removed.

10. `external import removed: logging: node:stream`

   This allowance moves with unchanged System diagnostic ownership from logging to system-logs. The package/builtin dependency remains declared there; no runtime dependency is claimed removed.

11. `external import removed: logging: node:url`

   This allowance moves with unchanged System diagnostic ownership from logging to system-logs. The package/builtin dependency remains declared there; no runtime dependency is claimed removed.

12. `public module touched, declarations unchanged: src/accounts/organizations/change-records.ts`

   Administration capture passes a function explicitly rather than a former recorder object and keeps the roleless revoke mapping. Named action/target/role/outcome declarations stay identical; no new exported declaration is implied by the internal call change.

13. `public module touched, declarations unchanged: src/accounts/organizations/organization-administration.ts (imports changed src/accounts/organizations/change-records.ts)`

   This unchanged module imports the changed change-record owner. Its generated declaration bytes are identical. The importer note does not prove a new user contract or authority change.

14. `size.production_lines_note_above: 2200 production lines, above the limit of 400`

   The full Slice 2 integration includes settings storage, diagnostics separation, saved Test, capture, snapshots and bounded delivery across the preserved stack. 2,200 production diff lines exceed 400; retain the full scope and review each responsibility. Splitting history to evade the count would not reduce this candidate.

15. `size.total_lines_note_above: 12903 lines without generated files, above the limit of 1500`

   The full stack includes required acceptance/unit/integration/support evidence and affected design/implementation/release records. 12,903 non-generated diff lines exceed 1,500; retain them with concise report links, not a weaker threshold.

16. `ratchet.maintainability_index.existing_file_drop_note_at: src/app/hosted-workos-application.ts: 62.161664960403826 to 56.20859397680054`

   Keep resource acquisition, failure disposal, shared composition, and ownership transfer visible in one hosted boundary. The raw drop 62.1616649604 → 56.2085939768 is visible; it is a note under trusted current-main policy, not an 85-goal pass.

17. `ratchet.review_findings_high: src/app/hosted-workos-application.ts: Maintainability index: 62 -> 56 (below 85 is hard to maintain)`

   Keep resource acquisition, failure disposal, shared composition, and ownership transfer visible in one hosted boundary. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

18. `ratchet.review_findings_high: src/interfaces/web/account/logging-routes.ts: Maintainability too low: got 46 (min: 85)`

   Keep current-Admin authority, exact request checks, safe Save/Test outcomes and trusted capture at one route owner. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

19. `ratchet.review_findings_high: src/logs/audit/audit-collector.ts: Maintainability too low: got 40 (min: 85)`

   Keep tenant FIFO, shared admission/bytes, pre-send authority, bounded retry, payload lifetime and release-once cleanup in one queue owner. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

20. `ratchet.review_findings_high: src/logs/audit/audit-snapshots.ts: Maintainability too low: got 50 (min: 85)`

   Keep activity admission, freshness/backoff, physical reads and shutdown reservations with the snapshot lifetime owner. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

21. `ratchet.review_findings_high: src/logs/audit/bounded-sql-runtime.ts: Maintainability too low: got 42 (min: 85)`

   Keep SQL admission, deadlines, late native work and disposal with one SQL runtime owner. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

22. `ratchet.review_findings_high: src/logs/audit/destination-credential-codec.ts: Maintainability too low: got 57 (min: 85)`

   Keep copied key, nonce/tag framing, tenant-bound authenticated data and fail-closed decryption in one codec. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

23. `ratchet.review_findings_high: src/logs/audit/destination-settings-service.ts: Maintainability too low: got 46 (min: 85)`

   Keep validated credentials, atomic Save, saved Test and fresh dispatch authority with one settings owner. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

24. `ratchet.review_findings_high: src/logs/audit/destination-test.ts: Maintainability too low: got 55 (min: 85)`

   Keep four-slot admission, caller deadline, cancellation and physical settlement in one lifetime owner. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

25. `ratchet.review_findings_high: src/logs/audit/otlp-audit-sender.ts: Maintainability too low: got 71 (min: 85)`

   Keep payload preparation, safe result mapping, caller outcome and physical cleanup with the sender. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

26. `ratchet.review_findings_high: src/logs/audit/pg-destination-settings-store.ts: Maintainability too low: got 56 (min: 85)`

   Keep atomic SQL, expected revisions and row-to-outcome mapping in one adapter. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

27. `ratchet.review_findings_high: src/logs/system/console-system-log-sink.ts: Maintainability too low: got 81 (min: 85)`

   Keep console severity/color/format/Writable mapping in one output adapter; inheritance removal improves file MI. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

28. `ratchet.review_findings_high: src/logs/system/system-logger.ts: Maintainability too low: got 55 (min: 85)`

   Keep level filtering, caller location, safe failure rendering and explicit sink dispatch as one System diagnostic contract. Retain the high finding; class-level and raw file MI are distinct. Current-main makes this a note, while the independent T2 facts and applicable exceptions remain.

</details>

## Approval and evidence limits

The local checker does not verify human identity/approval or all completed gates. The manager's remote read reports mergeable state with no remote check runs/statuses and an empty remote review list. Those fields do not themselves establish current-candidate human architect approval. Keep the trusted approval history and actual current scope explicit; this agent grants none. Separate owner activation/release holds remain in force.

Historical blocked metric-rounding, stale-coverage and ENOSPC attempts remain preserved. Their retries and final source-gate completion belong in Validation. This review ran no tests, builds, Docker, metrics, source/ref change or PR mutation. It reads the fresh final reports and compares retained evidence.

Full accessible reports: [process](../quality/process.md), [process JSON](../quality/process.json), [review findings](../quality/review.json), [CRAP](../quality/crap.json), [tier](../quality/tier.json), [habit-hooks](../quality/habit.log), [all retained reasons](../quality/quality-review.json), and [committed exceptions](https://github.com/tomer-mayara/Thermus/blob/a3aef3f2633145c685feccd136f8638ce08d58d7/.code-quality-exceptions.yaml). The report coordinator replaces `..` with the immutable evidence commit before publication; a local path is not a GitHub evidence link.

## Concise PR-quality section

For `a3aef3f2633145c685feccd136f8638ce08d58d7` against `7d01d2fb61c1ee0faebd1a1b78819902f832f5f4`, snapshots and all four metrics sections completed with compatible verified unit+integration coverage. Delta/Review/CRAP and habit-hooks retain exit 1 goal findings; Architecture passed. Counts remain 43/46 file MI misses, 13 high/28 medium/5 low findings, 377 habits and no required numeric CRAP miss. Ten function mappings remain unknown; the encoder's [4,20] target retains its exception, while other required unknown bounds prove 15. All 28 informational notes and four policy questions have reasons above; all 82 tier reasons and existing exception/high/habit dispositions are retained in the linked JSON. The final checker reports T2, locally eligible, blockers [], factsToDeclare []. This is not an all-targets-green claim or current human approval. Validation owns complete gates and failure/retry provenance; owner activation/release holds remain separate.
