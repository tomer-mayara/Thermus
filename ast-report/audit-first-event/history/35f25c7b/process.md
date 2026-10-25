# Code quality process

## Delta

Status: goal miss.

```text
  48.6  src/logs/audit/audit-snapshots.ts  below 85
  61.7  src/logs/audit/audit-snapshot-state.ts  below 85
  19.3  test/unit/logging/audit/audit-snapshots.test.ts  no goal
  25.3  test/unit/logging/audit/audit-snapshot-pending.test.ts  no goal
  30.1  test/integration/logging/audit/audit-sender.runtime.ts  no goal
  32.9  test/acceptance/logging/audit/hosted-snapshot-composition.test.ts  no goal
  32.9  test/acceptance/logging/audit/hosted-customer-export.test.ts  no goal
  37.7  test/acceptance/logging/audit/hosted-audit-journey.runtime.ts  no goal
  38.0  test/acceptance/logging/audit/activity-snapshots.test.ts  no goal
  39.8  test/unit/logging/audit/audit-collector-observation.test.ts  no goal
  42.0  test/support/in-process/hosted-audit-journey-site.ts  no goal
  45.3  test/acceptance/logging/audit/collector-dispatch.test.ts  no goal
  51.2  test/support/processes/audit-capture-export-probe.ts  no goal
  65.6  test/support/in-process/audit-collector-site.ts  no goal
  65.7  test/unit/logging/audit/fixtures/audit-snapshot-fixtures.ts  no goal
Result: 2 of 2 production files below 85. Goal: 85 or more for each production file. 13 other files without a goal.
Comparison with origin/main: ast-report/compare.html
```

## Review

Status: goal miss.

## AST Metrics found blocking regressions

2 new critical issue(s), 2 other regression(s), 1 improvement(s)

### Summary

- ➖ **Complexity: -**
- ⚠️  **Ease of maintenance: -0**
- ➖ **Outgoing dependencies: -**
- ➖ **Probability of bugs: -**

### Regressions

- **src/logs/audit/audit-snapshot-state.ts** (`src/logs/audit/audit-snapshot-state.ts`, high)
  Maintainability index: 68 -> 62 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **test/acceptance/logging/audit/activity-snapshots.test.ts** (`test/acceptance/logging/audit/activity-snapshots.test.ts`, high)
  Maintainability index: 43 -> 38 (below 85 is hard to maintain)
  Suggested action: Refactor long or deeply nested functions and reduce responsibilities in this file
- **src/logs/audit/audit-snapshots.ts** (`src/logs/audit/audit-snapshots.ts`, medium)
  Too many Lines of code (156 > 150)
- **src/logs/audit/audit-snapshots.ts** (`src/logs/audit/audit-snapshots.ts`, low)
  Efferent coupling too high: got 13 (max: 10)

### Improvements

- **test/support/in-process/audit-collector-site.ts** (`test/support/in-process/audit-collector-site.ts`): Maintainability index: 55 -> 66

## CRAP

Status: passed.

Collected verified compatible unit coverage.

## CRAP goals

Goals: CRAP < 30; new functions also CRAP ≤ 15.

| File | Function | Change | Paths | Coverage | CRAP | To do |
| --- | --- | --- | --- | --- | --- | --- |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.read | changed | 10 | 99.5% | 10.0 | ok |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.writeAuditEvent | changed | 9 | 100% | 9.0 | ok |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.loadLater | changed | 7 | 100% | 7.0 | ok |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.flushPending | new | 6 | 99% | 6.0 | ok |
| src/logs/audit/audit-snapshot-state.ts | snapshotFrom | unchanged | 5 | 100% | 5.0 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshot-state.ts | snapshotBounds | unchanged | 4 | 82.1% | 4.1 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshot-state.ts | boundedSnapshotText | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshot-state.ts | retainPendingEvent | new | 4 | 100% | 4.0 | ok |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.close | changed | 4 | 100% | 4.0 | ok |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.makeRoom | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshot-state.ts | detachedAuditEvent | unchanged | 3 | 93.4% | 3.0 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots. | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.current | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.expire | changed | 3 | 100% | 3.0 | ok |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.residentFor | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.finish | changed | 2 | 100% | 2.0 | ok |
| src/logs/audit/audit-snapshot-state.ts | clearPendingEvents | new | 1 | 100% | 1.0 | ok |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots. | new | 1 | 100% | 1.0 | ok |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/logs/audit/audit-snapshots.ts | audit-snapshots\AuditSnapshots.constructor | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |

Known limit violations: 0. Measured target misses: 0. Unmeasured functions: 0. Required functions with unknown assessment or identity: 0.

## Architecture

Status: passed.

## Architecture of src/: base 9d0546b9 → head

Modularity 0.34 → 0.34 · cross share 0.31 → 0.31 · cycles 1 → 1 · communities 4 → 4 · functions ≥ 30: 58 → 58

```mermaid
flowchart LR
  c_accounts["accounts<br/>36 files · MI 57.1 · paths 919<br/>▲ warning: 23 fn ≥ 30; assessment incomplete: 16 unknown"]
  c_app["app<br/>70 files · MI 60.1 ↓0.2 · paths 1497 ↑14<br/>▲ warning: 22 fn ≥ 30; assessment incomplete: 51 unknown"]
  c_pipelines["pipelines<br/>62 files · MI 49.1 · paths 1401<br/>▲ warning: 13 fn ≥ 30"]
  c_shared_kernel["shared kernel<br/>3 files · MI 57.5 · paths 78<br/>● good: 0 fn ≥ 30"]
  c_accounts -. "48 · cycle" .-> c_app
  c_accounts -. "9 · cycle" .-> c_pipelines
  c_accounts -- "1" --> c_shared_kernel
  c_app -. "52 · cycle" .-> c_accounts
  c_app -. "1 · cycle" .-> c_pipelines
  c_app -- "3" --> c_shared_kernel
  c_pipelines -. "11 · cycle" .-> c_accounts
  c_pipelines -. "2 · cycle" .-> c_app
  c_pipelines -- "2" --> c_shared_kernel
  linkStyle 0 stroke:#d03b3b,stroke-width:2px
  linkStyle 1 stroke:#d03b3b,stroke-width:2px
  linkStyle 3 stroke:#d03b3b,stroke-width:2px
  linkStyle 4 stroke:#d03b3b,stroke-width:2px
  linkStyle 6 stroke:#d03b3b,stroke-width:2px
  linkStyle 7 stroke:#d03b3b,stroke-width:2px
  classDef touched stroke-width:3px
  classDef gone stroke-dasharray:4 4,color:#999999
  classDef good stroke:#0ca30c
  classDef warning stroke:#fab219
  class c_app touched
  class c_shared_kernel good
  class c_accounts,c_app,c_pipelines warning
```

Legend: thick border = a community this pull request touched; `· new` and `· gone` = a community or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; border color = the CRAP band of the community (● good: complete assessment, no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse); numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base.

### Community edge evidence

Tool references and deduplicated file pairs have different units. An unchanged import means the same normalized file pair, after proven path moves; evidence kinds can differ.

Dependency evidence incomplete: base has 1 issue; head has 1 issue. A missing pair on an incomplete side does not prove an import change.

- base: <code>src/interfaces/user-portal/main.ts</code> → <code>./style.css</code> — unresolved-local.
- head: <code>src/interfaces/user-portal/main.ts</code> → <code>./style.css</code> — unresolved-local.

No new or gone community edges.

## Components of src/

Component dependency evidence is incomplete: known head dependencies and proven cycles are shown; edge and cycle changes are withheld. Additional dependencies or cycles may exist.

```mermaid
flowchart LR
  c_app["app<br/>9 files · MI 60.0 · paths 174<br/>assessment incomplete: 12 unknown; 0 known fn ≥ 30"]
  c_audit_logs["audit-logs<br/>21 files · MI 54.3 ↓0.4 · paths 578 ↑14<br/>assessment incomplete: 6 unknown; 0 known fn ≥ 30"]
  c_better_auth["better-auth<br/>5 files · MI 58.8 · paths 165<br/>▲ warning: 2 fn ≥ 30"]
  c_billing["billing<br/>2 files · MI 68.8 · paths 6<br/>● good: 0 fn ≥ 30"]
  c_cli["cli<br/>2 files · MI 53.7 · paths 56<br/>▲ warning: 3 fn ≥ 30"]
  c_config["config<br/>3 files · MI 57.6 · paths 78<br/>● good: 0 fn ≥ 30"]
  c_execution["execution<br/>4 files · MI 83.4 · paths 10<br/>● good: 0 fn ≥ 30"]
  c_html_processing["html-processing<br/>37 files · MI 46.9 · paths 946<br/>● good: 0 fn ≥ 30"]
  c_http["http<br/>4 files · MI 64.5 · paths 66<br/>● good: 0 fn ≥ 30"]
  c_identity["identity<br/>5 files · MI 62.0 · paths 12<br/>● good: 0 fn ≥ 30"]
  c_mcp["mcp<br/>9 files · MI 51.2 · paths 185<br/>▲ warning: 3 fn ≥ 30"]
  c_organizations["organizations<br/>7 files · MI 76.4 · paths 100<br/>▲ warning: 1 fn ≥ 30"]
  c_page_fetch["page-fetch<br/>5 files · MI 49.9 · paths 109<br/>▲ warning: 5 fn ≥ 30"]
  c_search["search<br/>6 files · MI 48.3 · paths 131<br/>▲ warning: 7 fn ≥ 30"]
  c_search_engine["search-engine<br/>2 files · MI 33.0 · paths 56<br/>● good: 0 fn ≥ 30"]
  c_system_logs["system-logs<br/>3 files · MI 63.1 · paths 39<br/>● good: 0 fn ≥ 30"]
  c_user_portal["user-portal<br/>8 files · MI 51.2 · paths 71<br/>● good: 0 fn ≥ 30"]
  c_web["web<br/>29 files · MI 60.9 · paths 594<br/>▲ warning: 21 fn ≥ 30; assessment incomplete: 40 unknown"]
  c_website_fetcher["website-fetcher<br/>6 files · MI 60.9 · paths 133<br/>▲ warning: 1 fn ≥ 30"]
  c_workos["workos<br/>15 files · MI 58.9 · paths 501<br/>▲ warning: 15 fn ≥ 30; assessment incomplete: 16 unknown"]
  c_app -- "4" --> c_audit_logs
  c_app -- "2" --> c_better_auth
  c_app -- "2" --> c_billing
  c_app -- "1" --> c_cli
  c_app -- "4" --> c_config
  c_app -- "2" --> c_execution
  c_app -- "1" --> c_html_processing
  c_app -- "2" --> c_http
  c_app -- "2" --> c_identity
  c_app -- "3" --> c_mcp
  c_app -- "2" --> c_organizations
  c_app -- "1" --> c_page_fetch
  c_app -- "1" --> c_search
  c_app -- "1" --> c_search_engine
  c_app -- "5" --> c_system_logs
  c_app -- "2" --> c_web
  c_app -- "1" --> c_website_fetcher
  c_app -- "1" --> c_workos
  c_audit_logs -- "1" --> c_organizations
  c_better_auth -- "2" --> c_http
  c_better_auth -- "3" --> c_identity
  c_cli -- "1" --> c_config
  c_cli -- "2" --> c_identity
  c_cli -- "1" --> c_system_logs
  c_execution -- "1" --> c_website_fetcher
  c_html_processing -- "1" --> c_execution
  c_html_processing -- "2" --> c_website_fetcher
  c_http -- "1" --> c_config
  c_http -- "2" --> c_system_logs
  c_mcp -- "1" --> c_audit_logs
  c_mcp -- "2" --> c_execution
  c_mcp -- "1" --> c_http
  c_mcp -- "6" --> c_identity
  c_mcp -- "3" --> c_page_fetch
  c_mcp -- "3" --> c_search
  c_mcp -- "1" --> c_system_logs
  c_organizations -- "1" --> c_billing
  c_organizations -- "4" --> c_identity
  c_page_fetch -- "3" --> c_execution
  c_page_fetch -- "1" --> c_identity
  c_page_fetch -- "2" --> c_website_fetcher
  c_search -- "3" --> c_execution
  c_search -- "1" --> c_identity
  c_search -- "1" --> c_search_engine
  c_search -- "2" --> c_website_fetcher
  c_search_engine -- "2" --> c_website_fetcher
  c_web -- "6" --> c_audit_logs
  c_web -- "1" --> c_billing
  c_web -- "5" --> c_http
  c_web -- "7" --> c_identity
  c_web -- "9" --> c_organizations
  c_web -- "3" --> c_workos
  c_workos -- "1" --> c_billing
  c_workos -- "6" --> c_identity
  c_workos -- "4" --> c_organizations
  classDef touched stroke-width:3px
  classDef gone stroke-dasharray:4 4,color:#999999
  classDef good stroke:#0ca30c
  classDef warning stroke:#fab219
  class c_audit_logs touched
  class c_billing,c_config,c_execution,c_html_processing,c_http,c_identity,c_search_engine,c_system_logs,c_user_portal good
  class c_better_auth,c_cli,c_mcp,c_organizations,c_page_fetch,c_search,c_web,c_website_fetcher,c_workos warning
```

Legend: thick border = a component this pull request touched; `· new` and `· gone` = a component or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; border color = the CRAP band of the component (● good: complete assessment, no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse); numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base. Edges count distinct importing files per target component.

## Complexity of the changed files

| File | Maintainability | Decision paths | CRAP ≥ 30 | Risk rank |
| --- | --- | --- | --- | --- |
| src/logs/audit/audit-snapshot-state.ts | 67.6 → 61.7 ↓5.9 | 16 → 21 ↑5 | 0 → 0 | |
| src/logs/audit/audit-snapshots.ts | 51.6 → 48.6 ↓3.0 | 49 → 58 ↑9 | 0 → 0 | 9 |

### Functions at CRAP 30 or more, added or worse

None.

Unmatched functions: 0 (anonymous, duplicate, or not in the coverage).

Base functions without an estimated covered share: 127.

Coverage: unit suite at 35f25c7b.

## Trend of src/ on main

| Commit | PR | Date | Modularity | Cross share | Cycles | Maintainability | Functions ≥ 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 53da7ac4 | #232 | 2026-10-23 | 0.40 | 0.16 | 1 | 56.1 | – |
| 7cebe4cf | #233 | 2026-10-23 | 0.40 | 0.16 | 1 | 56.1 | – |
| 1c7a0b68 | – | 2026-10-23 | 0.39 | 0.15 | 1 | 55.9 | 59 (estimate) |
| bb19a988 | – | 2026-10-23 | 0.39 | 0.15 | 1 | 55.9 | 59 (estimate) |
| b03e2d2c | – | 2026-10-23 | 0.39 | 0.15 | 1 | 55.9 | 0 (estimate; integration + unit) |
| 7d01d2fb | – | 2026-10-24 | 0.39 | 0.15 | 1 | 55.9 | 0 (estimate; integration + unit) |
| 845cec30 | – | 2026-10-24 | 0.34 | 0.31 | 1 | 55.8 | 58 (estimate) |
| a7411fd0 | #248 | 2026-10-24 | 0.34 | 0.31 | 1 | 55.8 | 58 (estimate) |
| 74f75656 | – | 2026-10-24 | 0.34 | 0.31 | 1 | 55.8 | 58 (estimate) |
| 9d0546b9 | #250 | 2026-10-25 | 0.34 | 0.31 | 1 | 55.8 | 58 (estimate) |
| this pull request | – | | 0.34 | 0.31 | 1 | 55.7 | 58 (measured) |

Historical estimates use head coverage from the first recording pull request. Later estimates for the same base can differ. Counts include known lower-bound violations; other unknown functions are not counted.

### Maintainability trend

Missing values are gaps; lines stop at each gap.

Maintainability (maintainability), 53da7ac4 to this pull request.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Maintainability"
    x-axis ["53da7ac4", "7cebe4cf", "1c7a0b68", "bb19a988", "b03e2d2c", "7d01d2fb", "845cec30", "a7411fd0", "74f75656", "9d0546b9", "this pull request"]
    y-axis "Maintainability" 55.7 --> 56.1
    line [56.1, 56.1, 55.9, 55.9, 55.9, 55.9, 55.8, 55.8, 55.8, 55.8, 55.7]
```


### Functions ≥ 30 trend

Missing values are gaps; lines stop at each gap or change of count basis.

Functions ≥ 30 (head-derived estimate), 1c7a0b68 to bb19a988.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate"
    x-axis ["1c7a0b68", "bb19a988"]
    y-axis "Functions at CRAP 30 or more" 58 --> 60
    line [59, 59]
```

Functions ≥ 30 (head-derived estimate; integration + unit), b03e2d2c to 7d01d2fb.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate; integration + unit"
    x-axis ["b03e2d2c", "7d01d2fb"]
    y-axis "Functions at CRAP 30 or more" 0 --> 1
    line [0, 0]
```

Functions ≥ 30 (head-derived estimate), 845cec30 to 9d0546b9.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate"
    x-axis ["845cec30", "a7411fd0", "74f75656", "9d0546b9"]
    y-axis "Functions at CRAP 30 or more" 57 --> 59
    line [58, 58, 58, 58]
```

this pull request: 58 (measured). One point; no line.


### Trend by component

| Component | 53da7ac4 | 7cebe4cf | 1c7a0b68 | bb19a988 | b03e2d2c | 7d01d2fb | 845cec30 | a7411fd0 | 74f75656 | 9d0546b9 | this pull request |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app | MI 61.3; functions ≥ 30: – | MI 61.3; functions ≥ 30: – | MI 60.9; functions ≥ 30: 0 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (measured) |
| audit-logs | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI 55.2; functions ≥ 30: 0 (estimate) | MI 54.8; functions ≥ 30: 0 (estimate) | MI 54.8; functions ≥ 30: 0 (estimate) | MI 54.7; functions ≥ 30: 0 (estimate) | MI 54.3; functions ≥ 30: 0 (measured) |
| better-auth | MI 58.8; functions ≥ 30: – | MI 58.8; functions ≥ 30: – | MI 58.8; functions ≥ 30: 2 (estimate) | MI 58.8; functions ≥ 30: 2 (estimate) | MI 58.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.8; functions ≥ 30: 2 (estimate) | MI 58.8; functions ≥ 30: 2 (estimate) | MI 58.8; functions ≥ 30: 2 (estimate) | MI 58.8; functions ≥ 30: 2 (estimate) | MI 58.8; functions ≥ 30: 2 (measured) |
| billing | MI 68.8; functions ≥ 30: – | MI 68.8; functions ≥ 30: – | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (measured) |
| cli | MI 53.8; functions ≥ 30: – | MI 53.8; functions ≥ 30: – | MI 53.8; functions ≥ 30: 3 (estimate) | MI 53.8; functions ≥ 30: 3 (estimate) | MI 53.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (measured) |
| config | MI 56.8; functions ≥ 30: – | MI 56.8; functions ≥ 30: – | MI 56.8; functions ≥ 30: 0 (estimate) | MI 56.8; functions ≥ 30: 0 (estimate) | MI 56.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 56.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (measured) |
| execution | MI 83.4; functions ≥ 30: – | MI 83.4; functions ≥ 30: – | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (measured) |
| html-processing | MI 46.9; functions ≥ 30: – | MI 46.9; functions ≥ 30: – | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (measured) |
| http | MI 64.6; functions ≥ 30: – | MI 64.6; functions ≥ 30: – | MI 64.6; functions ≥ 30: 0 (estimate) | MI 64.6; functions ≥ 30: 0 (estimate) | MI 64.6; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.6; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (measured) |
| identity | MI 62.0; functions ≥ 30: – | MI 62.0; functions ≥ 30: – | MI 62.0; functions ≥ 30: 0 (estimate) | MI 62.0; functions ≥ 30: 0 (estimate) | MI 62.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 62.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 62.0; functions ≥ 30: 0 (estimate) | MI 62.0; functions ≥ 30: 0 (estimate) | MI 62.0; functions ≥ 30: 0 (estimate) | MI 62.0; functions ≥ 30: 0 (estimate) | MI 62.0; functions ≥ 30: 0 (measured) |
| logging | MI 62.4; functions ≥ 30: – | MI 62.4; functions ≥ 30: – | MI 62.4; functions ≥ 30: 0 (estimate) | MI 62.4; functions ≥ 30: 0 (estimate) | MI 62.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 62.4; functions ≥ 30: 0 (estimate; integration + unit) | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – |
| mcp | MI 51.1; functions ≥ 30: – | MI 51.1; functions ≥ 30: – | MI 51.1; functions ≥ 30: 5 (estimate) | MI 51.1; functions ≥ 30: 5 (estimate) | MI 51.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (measured) |
| organizations | MI 75.0; functions ≥ 30: – | MI 75.0; functions ≥ 30: – | MI 76.4; functions ≥ 30: 1 (estimate) | MI 76.4; functions ≥ 30: 1 (estimate) | MI 76.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 76.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 76.4; functions ≥ 30: 1 (estimate) | MI 76.4; functions ≥ 30: 1 (estimate) | MI 76.4; functions ≥ 30: 1 (estimate) | MI 76.4; functions ≥ 30: 1 (estimate) | MI 76.4; functions ≥ 30: 1 (measured) |
| page-fetch | MI 49.9; functions ≥ 30: – | MI 49.9; functions ≥ 30: – | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (measured) |
| search | MI 48.3; functions ≥ 30: – | MI 48.3; functions ≥ 30: – | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (measured) |
| search-engine | MI 33.0; functions ≥ 30: – | MI 33.0; functions ≥ 30: – | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (measured) |
| system-logs | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (measured) |
| user-portal | MI 52.7; functions ≥ 30: – | MI 52.7; functions ≥ 30: – | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (measured) |
| web | MI 62.7; functions ≥ 30: – | MI 62.7; functions ≥ 30: – | MI 61.8; functions ≥ 30: 20 (estimate) | MI 61.8; functions ≥ 30: 20 (estimate) | MI 61.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 61.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 61.0; functions ≥ 30: 21 (estimate) | MI 61.0; functions ≥ 30: 21 (estimate) | MI 60.9; functions ≥ 30: 21 (estimate) | MI 60.9; functions ≥ 30: 21 (estimate) | MI 60.9; functions ≥ 30: 21 (measured) |
| website-fetcher | MI 60.9; functions ≥ 30: – | MI 60.9; functions ≥ 30: – | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (measured) |
| workos | MI 59.3; functions ≥ 30: – | MI 59.3; functions ≥ 30: – | MI 58.9; functions ≥ 30: 15 (estimate) | MI 58.9; functions ≥ 30: 15 (estimate) | MI 58.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.9; functions ≥ 30: 15 (estimate) | MI 58.9; functions ≥ 30: 15 (estimate) | MI 58.9; functions ≥ 30: 15 (estimate) | MI 58.9; functions ≥ 30: 15 (estimate) | MI 58.9; functions ≥ 30: 15 (measured) |

8 commits of main between 7cebe4cf and 1c7a0b68 have no record.
1 commits of main between b03e2d2c and 7d01d2fb have no record.
