# Code quality process

## Delta

Status: goal miss.

```text
  54.0  src/interfaces/web/account/quick-start-content.ts  below 85
Result: 1 of 1 production file below 85. Goal: 85 or more for each production file.
Comparison with origin/main: ast-report/compare.html
```

## Review

Status: passed.

## AST Metrics found no regression

0 new critical issue(s), 0 other regression(s)

### Summary

- ➖ **Complexity: -**
- ➖ **Ease of maintenance: -**
- ➖ **Outgoing dependencies: -**
- ➖ **Probability of bugs: -**

No architectural change detected on modified code.

## CRAP

Status: passed.

Reused verified compatible unit + integration coverage.

## CRAP goals

Goals: CRAP < 30; new functions also CRAP ≤ 15.

| File | Function | Change | Paths | Coverage | CRAP | To do |
| --- | --- | --- | --- | --- | --- | --- |
| src/interfaces/web/account/quick-start-content.ts | trustedUrl | unchanged | 6 | 100% | 6.0 | ok; unchanged by this PR |
| src/interfaces/web/account/quick-start-content.ts | quickStartContent | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/quick-start-content.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/quick-start-content.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/quick-start-content.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/quick-start-content.ts | markdownLink | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/quick-start-content.ts | markdownText | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |

Known limit violations: 0. Measured target misses: 0. Unmeasured functions: 0. Required functions with unknown assessment or identity: 0.

## Architecture

Status: passed.

## Architecture of src/: base cc2ed669 → head

Modularity 0.42 → 0.42 · cross share 0.23 → 0.23 · cycles 1 → 1 · communities 4 → 4 · functions ≥ 30: 0 → 0

```mermaid
flowchart LR
  c_accounts["accounts<br/>110 files · MI 61.5 · paths 2451<br/>● good: 0 fn ≥ 30"]
  c_app__application_["app (application)<br/>34 files · MI 65.9 · paths 555<br/>● good: 0 fn ≥ 30"]
  c_app__tenants_["app (tenants)<br/>46 files · MI 80.0 · paths 532<br/>assessment incomplete: 1 unknown; 0 known fn ≥ 30"]
  c_pipelines["pipelines<br/>62 files · MI 49.2 · paths 1404<br/>● good: 0 fn ≥ 30"]
  c_accounts -. "14 · cycle" .-> c_app__application_
  c_accounts -. "3 · cycle" .-> c_app__tenants_
  c_app__application_ -. "56 · cycle" .-> c_accounts
  c_app__application_ -. "7 · cycle" .-> c_app__tenants_
  c_app__application_ -. "13 · cycle" .-> c_pipelines
  c_app__tenants_ -. "13 · cycle" .-> c_accounts
  c_app__tenants_ -. "11 · cycle" .-> c_app__application_
  c_pipelines -. "8 · cycle" .-> c_accounts
  c_pipelines -. "5 · cycle" .-> c_app__application_
  c_pipelines -. "3 · cycle" .-> c_app__tenants_
  linkStyle 0 stroke:#d03b3b,stroke-width:2px
  linkStyle 1 stroke:#d03b3b,stroke-width:2px
  linkStyle 2 stroke:#d03b3b,stroke-width:2px
  linkStyle 3 stroke:#d03b3b,stroke-width:2px
  linkStyle 4 stroke:#d03b3b,stroke-width:2px
  linkStyle 5 stroke:#d03b3b,stroke-width:2px
  linkStyle 6 stroke:#d03b3b,stroke-width:2px
  linkStyle 7 stroke:#d03b3b,stroke-width:2px
  linkStyle 8 stroke:#d03b3b,stroke-width:2px
  linkStyle 9 stroke:#d03b3b,stroke-width:2px
  classDef touched stroke-width:3px
  classDef gone stroke-dasharray:4 4,color:#999999
  classDef good stroke:#0ca30c
  class c_accounts touched
  class c_accounts,c_app__application_,c_pipelines good
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
  c_app["app<br/>15 files · MI 68.2 · paths 242<br/>● good: 0 fn ≥ 30"]
  c_audit_logs["audit-logs<br/>25 files · MI 61.1 · paths 664<br/>● good: 0 fn ≥ 30"]
  c_better_auth["better-auth<br/>5 files · MI 58.7 · paths 166<br/>● good: 0 fn ≥ 30"]
  c_billing["billing<br/>2 files · MI 90.1 · paths 6<br/>● good: 0 fn ≥ 30"]
  c_cli["cli<br/>2 files · MI 53.7 · paths 56<br/>● good: 0 fn ≥ 30"]
  c_config["config<br/>11 files · MI 74.7 · paths 158<br/>● good: 0 fn ≥ 30"]
  c_execution["execution<br/>4 files · MI 83.4 · paths 10<br/>● good: 0 fn ≥ 30"]
  c_html_processing["html-processing<br/>37 files · MI 46.9 · paths 946<br/>● good: 0 fn ≥ 30"]
  c_http["http<br/>5 files · MI 67.8 · paths 74<br/>● good: 0 fn ≥ 30"]
  c_identity["identity<br/>11 files · MI 86.2 · paths 77<br/>● good: 0 fn ≥ 30"]
  c_mcp["mcp<br/>19 files · MI 67.9 · paths 296<br/>● good: 0 fn ≥ 30"]
  c_organizations["organizations<br/>12 files · MI 71.6 · paths 208<br/>● good: 0 fn ≥ 30"]
  c_page_fetch["page-fetch<br/>5 files · MI 49.9 · paths 109<br/>● good: 0 fn ≥ 30"]
  c_render["render<br/>8 files · MI 84.7 · paths 126<br/>● good: 0 fn ≥ 30"]
  c_search["search<br/>6 files · MI 48.3 · paths 131<br/>● good: 0 fn ≥ 30"]
  c_search_engine["search-engine<br/>2 files · MI 33.0 · paths 56<br/>● good: 0 fn ≥ 30"]
  c_sql["sql<br/>1 file · MI 45.5 · paths 48<br/>assessment incomplete: 1 unknown; 0 known fn ≥ 30"]
  c_system_logs["system-logs<br/>3 files · MI 63.1 · paths 39<br/>● good: 0 fn ≥ 30"]
  c_tenants["tenants<br/>22 files · MI 87.9 · paths 159<br/>● good: 0 fn ≥ 30"]
  c_user_portal["user-portal<br/>9 files · MI 54.1 · paths 78<br/>● good: 0 fn ≥ 30"]
  c_web["web<br/>37 files · MI 60.9 · paths 719<br/>● good: 0 fn ≥ 30"]
  c_website_fetcher["website-fetcher<br/>6 files · MI 60.9 · paths 133<br/>● good: 0 fn ≥ 30"]
  c_workos["workos<br/>16 files · MI 55.9 · paths 555<br/>● good: 0 fn ≥ 30"]
  c_app -- "7" --> c_audit_logs
  c_app -- "2" --> c_better_auth
  c_app -- "2" --> c_billing
  c_app -- "1" --> c_cli
  c_app -- "9" --> c_config
  c_app -- "2" --> c_execution
  c_app -- "1" --> c_html_processing
  c_app -- "4" --> c_http
  c_app -- "5" --> c_identity
  c_app -- "6" --> c_mcp
  c_app -- "3" --> c_organizations
  c_app -- "1" --> c_page_fetch
  c_app -- "1" --> c_render
  c_app -- "1" --> c_search
  c_app -- "1" --> c_search_engine
  c_app -- "1" --> c_sql
  c_app -- "10" --> c_system_logs
  c_app -- "4" --> c_tenants
  c_app -- "4" --> c_web
  c_app -- "1" --> c_website_fetcher
  c_app -- "2" --> c_workos
  c_audit_logs -- "1" --> c_identity
  c_audit_logs -- "2" --> c_organizations
  c_audit_logs -- "1" --> c_sql
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
  c_mcp -- "3" --> c_http
  c_mcp -- "8" --> c_identity
  c_mcp -- "3" --> c_page_fetch
  c_mcp -- "3" --> c_search
  c_mcp -- "3" --> c_system_logs
  c_organizations -- "2" --> c_billing
  c_organizations -- "6" --> c_identity
  c_page_fetch -- "3" --> c_execution
  c_page_fetch -- "1" --> c_identity
  c_page_fetch -- "2" --> c_website_fetcher
  c_render -- "6" --> c_tenants
  c_search -- "3" --> c_execution
  c_search -- "1" --> c_identity
  c_search -- "1" --> c_search_engine
  c_search -- "2" --> c_website_fetcher
  c_search_engine -- "2" --> c_website_fetcher
  c_tenants -- "3" --> c_sql
  c_tenants -- "3" --> c_system_logs
  c_web -- "8" --> c_audit_logs
  c_web -- "2" --> c_billing
  c_web -- "6" --> c_http
  c_web -- "9" --> c_identity
  c_web -- "10" --> c_organizations
  c_web -- "3" --> c_workos
  c_workos -- "1" --> c_billing
  c_workos -- "6" --> c_identity
  c_workos -- "4" --> c_organizations
  classDef touched stroke-width:3px
  classDef gone stroke-dasharray:4 4,color:#999999
  classDef good stroke:#0ca30c
  class c_web touched
  class c_app,c_audit_logs,c_better_auth,c_billing,c_cli,c_config,c_execution,c_html_processing,c_http,c_identity,c_mcp,c_organizations,c_page_fetch,c_render,c_search,c_search_engine,c_system_logs,c_tenants,c_user_portal,c_web,c_website_fetcher,c_workos good
```

Legend: thick border = a component this pull request touched; `· new` and `· gone` = a component or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; border color = the CRAP band of the component (● good: complete assessment, no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse); numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base. Edges count distinct importing files per target component.

## Complexity of the changed files

| File | Maintainability | Decision paths | CRAP ≥ 30 | Risk rank |
| --- | --- | --- | --- | --- |
| src/interfaces/web/account/quick-start-content.ts | 54.0 → 54.0 | 13 → 13 | 0 → 0 | |

### Functions at CRAP 30 or more, added or worse

None.

Unmatched functions: 0 (anonymous, duplicate, or not in the coverage).

Base functions without an estimated covered share: 94.

Coverage: unit + integration suites at cc2ed669.

## Trend of src/ on main

| Commit | PR | Date | Modularity | Cross share | Cycles | Maintainability | Functions ≥ 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6e2c6739 | #277 | 2026-10-27 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| 77477864 | #279 | 2026-10-27 | 0.34 | 0.17 | 1 | 55.5 | 60 (estimate) |
| f6b52396 | #280 | 2026-10-27 | 0.34 | 0.21 | 1 | 57.3 | 0 (estimate; integration + unit) |
| a421afc0 | #282 | 2026-10-27 | 0.34 | 0.21 | 1 | 57.3 | 0 (estimate; integration + unit) |
| 89e79754 | #281 | 2026-10-27 | 0.34 | 0.21 | 1 | 57.3 | 0 (estimate; integration + unit) |
| b4bcf956 | #284 | 2026-10-27 | 0.36 | 0.24 | 1 | 57.6 | 61 (estimate) |
| 106a4221 | #286 | 2026-10-27 | 0.42 | 0.25 | 1 | 59.6 | 0 (estimate; integration + unit) |
| feeaad4d | #285 | 2026-10-27 | 0.42 | 0.23 | 1 | 61.5 | 0 (estimate; integration + unit) |
| 7e9cc19a | #289 | 2026-10-28 | 0.42 | 0.23 | 1 | 61.3 | 0 (estimate; integration + unit) |
| cc2ed669 | #290 | 2026-10-28 | 0.42 | 0.23 | 1 | 61.3 | 0 (estimate; integration + unit) |
| this pull request | #290 | | 0.42 | 0.23 | 1 | 61.3 | 0 (measured; integration + unit) |

Historical estimates use head coverage from the first recording pull request. Later estimates for the same base can differ. Counts include known lower-bound violations; other unknown functions are not counted.

### Maintainability trend

Missing values are gaps; lines stop at each gap.

Maintainability (maintainability), 6e2c6739 to this pull request.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Maintainability"
    x-axis ["6e2c6739", "77477864", "f6b52396", "a421afc0", "89e79754", "b4bcf956", "106a4221", "feeaad4d", "7e9cc19a", "cc2ed669", "this pull request"]
    y-axis "Maintainability" 55.2 --> 61.5
    line [55.2, 55.5, 57.3, 57.3, 57.3, 57.6, 59.6, 61.5, 61.3, 61.3, 61.3]
```


### Functions ≥ 30 trend

Missing values are gaps; lines stop at each gap or change of count basis.

Functions ≥ 30 (head-derived estimate), 6e2c6739 to 77477864.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate"
    x-axis ["6e2c6739", "77477864"]
    y-axis "Functions at CRAP 30 or more" 59 --> 61
    line [60, 60]
```

Functions ≥ 30 (head-derived estimate; integration + unit), f6b52396 to 89e79754.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate; integration + unit"
    x-axis ["f6b52396", "a421afc0", "89e79754"]
    y-axis "Functions at CRAP 30 or more" 0 --> 1
    line [0, 0, 0]
```

b4bcf956: 61 (head-derived estimate). One point; no line.

Functions ≥ 30 (head-derived estimate; integration + unit), 106a4221 to cc2ed669.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate; integration + unit"
    x-axis ["106a4221", "feeaad4d", "7e9cc19a", "cc2ed669"]
    y-axis "Functions at CRAP 30 or more" 0 --> 1
    line [0, 0, 0, 0]
```

this pull request: 0 (measured; integration + unit). One point; no line.


### Trend by component

| Component | 6e2c6739 | 77477864 | f6b52396 | a421afc0 | 89e79754 | b4bcf956 | 106a4221 | feeaad4d | 7e9cc19a | cc2ed669 | this pull request |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app | MI 60.2; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 64.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.2; functions ≥ 30: 0 (estimate) | MI 65.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.2; functions ≥ 30: 0 (measured; integration + unit) |
| audit-logs | MI 53.4; functions ≥ 30: 0 (estimate) | MI 54.9; functions ≥ 30: 0 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 61.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 61.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 61.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 61.1; functions ≥ 30: 0 (measured; integration + unit) |
| better-auth | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.7; functions ≥ 30: 0 (measured; integration + unit) |
| billing | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 90.1; functions ≥ 30: 0 (estimate) | MI 90.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 90.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 90.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 90.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 90.1; functions ≥ 30: 0 (measured; integration + unit) |
| cli | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 0 (measured; integration + unit) |
| config | MI 59.6; functions ≥ 30: 0 (estimate) | MI 61.4; functions ≥ 30: 0 (estimate) | MI 70.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 70.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 70.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 70.9; functions ≥ 30: 0 (estimate) | MI 72.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 74.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 74.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 74.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 74.7; functions ≥ 30: 0 (measured; integration + unit) |
| execution | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (measured; integration + unit) |
| html-processing | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (measured; integration + unit) |
| http | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 67.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 67.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 67.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 67.8; functions ≥ 30: 0 (measured; integration + unit) |
| identity | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 85.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 85.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 85.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 85.2; functions ≥ 30: 0 (estimate) | MI 85.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 86.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 86.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 86.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 86.2; functions ≥ 30: 0 (measured; integration + unit) |
| mcp | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.7; functions ≥ 30: 3 (estimate) | MI 51.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 67.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 67.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 67.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 67.9; functions ≥ 30: 0 (measured; integration + unit) |
| organizations | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 69.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 69.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 71.6; functions ≥ 30: 1 (estimate) | MI 71.6; functions ≥ 30: 0 (estimate; integration + unit) | MI 71.6; functions ≥ 30: 0 (estimate; integration + unit) | MI 71.6; functions ≥ 30: 0 (estimate; integration + unit) | MI 71.6; functions ≥ 30: 0 (estimate; integration + unit) | MI 71.6; functions ≥ 30: 0 (measured; integration + unit) |
| page-fetch | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 0 (measured; integration + unit) |
| render | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI 84.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 84.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 84.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 84.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 84.7; functions ≥ 30: 0 (measured; integration + unit) |
| search | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 0 (measured; integration + unit) |
| search-engine | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (measured; integration + unit) |
| sql | MI –; functions ≥ 30: – | MI 41.9; functions ≥ 30: 0 (estimate) | MI 41.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 41.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 41.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 41.9; functions ≥ 30: 0 (estimate) | MI 45.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 45.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 45.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 45.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 45.5; functions ≥ 30: 0 (measured; integration + unit) |
| system-logs | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 63.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 63.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 63.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 63.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 63.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 63.1; functions ≥ 30: 0 (measured; integration + unit) |
| tenants | MI –; functions ≥ 30: – | MI 79.0; functions ≥ 30: 0 (estimate) | MI 79.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 79.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 79.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 79.0; functions ≥ 30: 0 (estimate) | MI 88.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 87.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 87.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 87.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 87.9; functions ≥ 30: 0 (measured; integration + unit) |
| user-portal | MI 51.1; functions ≥ 30: 0 (estimate) | MI 51.1; functions ≥ 30: 0 (estimate) | MI 51.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 54.2; functions ≥ 30: 0 (estimate) | MI 54.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 54.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 54.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 54.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 54.1; functions ≥ 30: 0 (measured; integration + unit) |
| web | MI 60.0; functions ≥ 30: 22 (estimate) | MI 60.0; functions ≥ 30: 22 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 59.6; functions ≥ 30: 0 (estimate; integration + unit) | MI 59.9; functions ≥ 30: 23 (estimate) | MI 59.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 61.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (measured; integration + unit) |
| website-fetcher | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (measured; integration + unit) |
| workos | MI 55.9; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 55.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 55.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 55.9; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 55.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 55.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 55.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 55.9; functions ≥ 30: 0 (measured; integration + unit) |

1 commits of main between b4bcf956 and 106a4221 have no record.
