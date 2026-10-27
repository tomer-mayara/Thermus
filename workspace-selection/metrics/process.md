# Code quality process

## Delta

Status: goal miss.

```text
  54.0  src/interfaces/web/account/account-routes.ts  below 85
  65.7  src/interfaces/web/account/organization-selection-page.ts  below 85
  1.1  test/acceptance/auth/hosted-member-removal-browser.runtime.ts  no goal
  36.6  test/acceptance/auth/hosted-organization-requests.test.ts  no goal
  36.8  test/integration/hosted-admin/account-routes-organization-page.test.ts  no goal
  40.2  test/integration/hosted-admin/account-routes-workspace-navigation.test.ts  no goal
  40.3  test/acceptance/auth/hosted-workspace-selection.test.ts  no goal
  41.2  test/support/drivers/browser/workspace-selection-browser.ts  no goal
  43.4  test/integration/auth/workos-provider-organizations.test.ts  no goal
  50.4  test/integration/hosted-admin/organization-selection-page.test.ts  no goal
  67.1  test/support/in-process/hosted-workspace-selection-site.ts  no goal
  not measured  src/interfaces/web/account/organization-selection-style.ts
Result: 2 of 2 production files below 85. Goal: 85 or more for each production file. 9 other files without a goal. 1 file not measured.
Comparison with origin/main: ast-report/compare.html
```

## Review

Status: goal miss.

## AST Metrics review

Thermus review policy: new-function warnings require >10 paths; high starts at 25. Approved layer rules use CR-13 resolved imports.

Regressions: 1 high, 0 medium, 0 low. Improvements: 0. Gate: failed.

### Regressions

- **high**: Maintainability index: 59 -&gt; 54 (below 85 is hard to maintain) (`src/interfaces/web/account/account-routes.ts`, rule `maintainability-regression`)
  Refactor long or deeply nested functions and reduce responsibilities in this file

## CRAP

Status: passed.

Reused verified compatible unit + integration coverage.

## CRAP goals

Goals: CRAP < 30; new functions also CRAP ≤ 15.

| File | Function | Change | Paths | Coverage | CRAP | To do |
| --- | --- | --- | --- | --- | --- | --- |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.organizationPage | changed | 7 | 100% | 7.0 | ok |
| src/interfaces/web/account/account-routes.ts | currentAdminAccess | new | 7 | 100% | 7.0 | ok |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.selectOrganization | unchanged | 6 | 100% | 6.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.tenantOperation | unchanged | 5 | 100% | 5.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | deepFreeze | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.answerSignedIn | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.route | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.showAdminNavigation | new | 3 | 100% | 3.0 | ok |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.switchAnswer | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | requireTrustedTenant | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | withCookies | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/organization-selection-page.ts | (anonymous) | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | (anonymous) | new | 2 | 100% | 2.0 | ok |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.handle | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | directoryUrl | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/organization-selection-page.ts | organizationSelectionPage | changed | 2 | 100% | 2.0 | ok |
| src/interfaces/web/account/account-routes.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.constructor | changed | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/account-routes.ts | frozenCopy | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |

Known limit violations: 0. Measured target misses: 0. Unmeasured functions: 0. Required functions with unknown assessment or identity: 0.

## Architecture

Status: passed.

## Architecture of src/: base 77477864 → head

Modularity 0.34 → 0.34 · cross share 0.17 → 0.16 · cycles 1 → 1 · communities 4 → 4 · functions ≥ 30: 0 → 0

```mermaid
flowchart LR
  c_accounts["accounts<br/>95 files · MI 58.8 ↓0.1 · paths 2254 ↑16<br/>● good: 0 fn ≥ 30"]
  c_app["app<br/>12 files · MI 57.7 · paths 239<br/>● good: 0 fn ≥ 30"]
  c_pipelines["pipelines<br/>71 files · MI 49.5 · paths 1590<br/>● good: 0 fn ≥ 30"]
  c_shared_kernel["shared kernel<br/>5 files · MI 61.4 · paths 89<br/>● good: 0 fn ≥ 30"]
  c_accounts -. "5 · cycle" .-> c_app
  c_accounts -- "2" --> c_shared_kernel
  c_app -. "33 · cycle" .-> c_accounts
  c_app -. "5 · cycle" .-> c_pipelines
  c_app -- "2" --> c_shared_kernel
  c_pipelines -. "27 · cycle" .-> c_accounts
  c_pipelines -. "2 · cycle" .-> c_app
  c_pipelines -- "3" --> c_shared_kernel
  linkStyle 0 stroke:#d03b3b,stroke-width:2px
  linkStyle 2 stroke:#d03b3b,stroke-width:2px
  linkStyle 3 stroke:#d03b3b,stroke-width:2px
  linkStyle 5 stroke:#d03b3b,stroke-width:2px
  linkStyle 6 stroke:#d03b3b,stroke-width:2px
  classDef touched stroke-width:3px
  classDef gone stroke-dasharray:4 4,color:#999999
  classDef good stroke:#0ca30c
  class c_accounts touched
  class c_accounts,c_app,c_pipelines,c_shared_kernel good
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
  c_app["app<br/>9 files · MI 60.0 · paths 179<br/>assessment incomplete: 3 unknown; 0 known fn ≥ 30"]
  c_audit_logs["audit-logs<br/>20 files · MI 54.9 · paths 562<br/>● good: 0 fn ≥ 30"]
  c_better_auth["better-auth<br/>5 files · MI 58.7 · paths 166<br/>● good: 0 fn ≥ 30"]
  c_billing["billing<br/>2 files · MI 68.8 · paths 6<br/>● good: 0 fn ≥ 30"]
  c_cli["cli<br/>2 files · MI 53.7 · paths 56<br/>● good: 0 fn ≥ 30"]
  c_config["config<br/>5 files · MI 61.4 · paths 89<br/>● good: 0 fn ≥ 30"]
  c_execution["execution<br/>4 files · MI 83.4 · paths 10<br/>● good: 0 fn ≥ 30"]
  c_html_processing["html-processing<br/>37 files · MI 46.9 · paths 946<br/>● good: 0 fn ≥ 30"]
  c_http["http<br/>4 files · MI 64.5 · paths 66<br/>● good: 0 fn ≥ 30"]
  c_identity["identity<br/>5 files · MI 66.4 · paths 19<br/>● good: 0 fn ≥ 30"]
  c_mcp["mcp<br/>9 files · MI 51.2 · paths 186<br/>● good: 0 fn ≥ 30"]
  c_organizations["organizations<br/>11 files · MI 69.9 · paths 192<br/>● good: 0 fn ≥ 30"]
  c_page_fetch["page-fetch<br/>5 files · MI 49.9 · paths 109<br/>● good: 0 fn ≥ 30"]
  c_search["search<br/>6 files · MI 48.3 · paths 131<br/>● good: 0 fn ≥ 30"]
  c_search_engine["search-engine<br/>2 files · MI 33.0 · paths 56<br/>● good: 0 fn ≥ 30"]
  c_sql["sql<br/>1 file · MI 41.9 · paths 46<br/>● good: 0 fn ≥ 30"]
  c_system_logs["system-logs<br/>3 files · MI 63.1 · paths 39<br/>● good: 0 fn ≥ 30"]
  c_tenants["tenants<br/>4 files · MI 79.0 · paths 38<br/>● good: 0 fn ≥ 30"]
  c_user_portal["user-portal<br/>8 files · MI 51.1 · paths 71<br/>● good: 0 fn ≥ 30"]
  c_web["web<br/>30 files · MI 59.6 ↓0.4 · paths 634 ↑16<br/>● good: 0 fn ≥ 30"]
  c_website_fetcher["website-fetcher<br/>6 files · MI 60.9 · paths 133<br/>● good: 0 fn ≥ 30"]
  c_workos["workos<br/>16 files · MI 55.9 · paths 553<br/>● good: 0 fn ≥ 30"]
  c_app -- "4" --> c_audit_logs
  c_app -- "2" --> c_better_auth
  c_app -- "2" --> c_billing
  c_app -- "1" --> c_cli
  c_app -- "5" --> c_config
  c_app -- "2" --> c_execution
  c_app -- "1" --> c_html_processing
  c_app -- "2" --> c_http
  c_app -- "2" --> c_identity
  c_app -- "3" --> c_mcp
  c_app -- "3" --> c_organizations
  c_app -- "1" --> c_page_fetch
  c_app -- "1" --> c_search
  c_app -- "1" --> c_search_engine
  c_app -- "1" --> c_sql
  c_app -- "5" --> c_system_logs
  c_app -- "1" --> c_tenants
  c_app -- "2" --> c_web
  c_app -- "1" --> c_website_fetcher
  c_app -- "1" --> c_workos
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
  c_mcp -- "1" --> c_http
  c_mcp -- "6" --> c_identity
  c_mcp -- "3" --> c_page_fetch
  c_mcp -- "3" --> c_search
  c_mcp -- "1" --> c_system_logs
  c_organizations -- "1" --> c_billing
  c_organizations -- "6" --> c_identity
  c_page_fetch -- "3" --> c_execution
  c_page_fetch -- "1" --> c_identity
  c_page_fetch -- "2" --> c_website_fetcher
  c_search -- "3" --> c_execution
  c_search -- "1" --> c_identity
  c_search -- "1" --> c_search_engine
  c_search -- "2" --> c_website_fetcher
  c_search_engine -- "2" --> c_website_fetcher
  c_tenants -- "1" --> c_sql
  c_web -- "6" --> c_audit_logs
  c_web -- "1" --> c_billing
  c_web -- "5" --> c_http
  c_web -- "7" --> c_identity
  c_web -- "10" --> c_organizations
  c_web -- "3" --> c_workos
  c_workos -- "1" --> c_billing
  c_workos -- "6" --> c_identity
  c_workos -- "4" --> c_organizations
  classDef touched stroke-width:3px
  classDef gone stroke-dasharray:4 4,color:#999999
  classDef good stroke:#0ca30c
  class c_web touched
  class c_audit_logs,c_better_auth,c_billing,c_cli,c_config,c_execution,c_html_processing,c_http,c_identity,c_mcp,c_organizations,c_page_fetch,c_search,c_search_engine,c_sql,c_system_logs,c_tenants,c_user_portal,c_web,c_website_fetcher,c_workos good
```

Legend: thick border = a component this pull request touched; `· new` and `· gone` = a component or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; border color = the CRAP band of the component (● good: complete assessment, no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse); numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base. Edges count distinct importing files per target component.

## Complexity of the changed files

| File | Maintainability | Decision paths | CRAP ≥ 30 | Risk rank |
| --- | --- | --- | --- | --- |
| src/interfaces/web/account/account-routes.ts | 59.4 → 54.0 ↓5.4 | 47 → 62 ↑15 | 0 → 0 | 4 |
| src/interfaces/web/account/organization-selection-page.ts | 66.9 → 65.7 ↓1.2 | 4 → 5 ↑1 | 0 → 0 | |
| src/interfaces/web/account/organization-selection-style.ts | not measured | not measured | not measured | |

### Functions at CRAP 30 or more, added or worse

None.

Unmatched functions: 0 (anonymous, duplicate, or not in the coverage).

Base functions without an estimated covered share: 78.

Coverage: unit + integration suites at 16c8e174.

## Trend of src/ on main

| Commit | PR | Date | Modularity | Cross share | Cycles | Maintainability | Functions ≥ 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| c9da79e6 | #260 | 2026-10-26 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| 57c99e2b | #261 | 2026-10-26 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| c42aa823 | #262 | 2026-10-26 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| 2b3ad13b | #269 | 2026-10-26 | 0.33 | 0.31 | 1 | 55.3 | 51 (estimate; integration) |
| 9507e751 | #270 | 2026-10-26 | 0.33 | 0.31 | 1 | 55.3 | 51 (estimate; integration) |
| 2282edd4 | #264 | 2026-10-27 | 0.33 | 0.31 | 1 | 55.3 | 51 (estimate; integration) |
| 0377cd12 | #266 | 2026-10-27 | 0.33 | 0.31 | 1 | 55.3 | 51 (estimate; integration) |
| 57d9ce05 | #276 | 2026-10-27 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| a16a40c0 | #278 | 2026-10-27 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| 77477864 | #279 | 2026-10-27 | 0.34 | 0.17 | 1 | 55.5 | 0 (estimate; integration + unit) |
| this pull request | – | | 0.34 | 0.16 | 1 | 55.4 | 0 (measured; integration + unit) |

Historical estimates use head coverage from the first recording pull request. Later estimates for the same base can differ. Counts include known lower-bound violations; other unknown functions are not counted.

### Maintainability trend

Missing values are gaps; lines stop at each gap.

Maintainability (maintainability), c9da79e6 to this pull request.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Maintainability"
    x-axis ["c9da79e6", "57c99e2b", "c42aa823", "2b3ad13b", "9507e751", "2282edd4", "0377cd12", "57d9ce05", "a16a40c0", "77477864", "this pull request"]
    y-axis "Maintainability" 55.2 --> 55.5
    line [55.2, 55.2, 55.2, 55.3, 55.3, 55.3, 55.3, 55.2, 55.2, 55.5, 55.4]
```


### Functions ≥ 30 trend

Missing values are gaps; lines stop at each gap or change of count basis.

Functions ≥ 30 (head-derived estimate), c9da79e6 to c42aa823.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate"
    x-axis ["c9da79e6", "57c99e2b", "c42aa823"]
    y-axis "Functions at CRAP 30 or more" 59 --> 61
    line [60, 60, 60]
```

Functions ≥ 30 (head-derived estimate; integration), 2b3ad13b to 0377cd12.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate; integration"
    x-axis ["2b3ad13b", "9507e751", "2282edd4", "0377cd12"]
    y-axis "Functions at CRAP 30 or more" 50 --> 52
    line [51, 51, 51, 51]
```

Functions ≥ 30 (head-derived estimate), 57d9ce05 to a16a40c0.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate"
    x-axis ["57d9ce05", "a16a40c0"]
    y-axis "Functions at CRAP 30 or more" 59 --> 61
    line [60, 60]
```

77477864: 0 (head-derived estimate; integration + unit). One point; no line.

this pull request: 0 (measured; integration + unit). One point; no line.


### Trend by component

| Component | c9da79e6 | 57c99e2b | c42aa823 | 2b3ad13b | 9507e751 | 2282edd4 | 0377cd12 | 57d9ce05 | a16a40c0 | 77477864 | this pull request |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.2; functions ≥ 30: 0 (estimate; integration) | MI 60.2; functions ≥ 30: 0 (estimate; integration) | MI 60.2; functions ≥ 30: 0 (estimate; integration) | MI 60.2; functions ≥ 30: 0 (estimate; integration) | MI 60.2; functions ≥ 30: 0 (estimate) | MI 60.2; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.0; functions ≥ 30: 0 (measured; integration + unit) |
| audit-logs | MI 53.4; functions ≥ 30: 0 (estimate) | MI 53.4; functions ≥ 30: 0 (estimate) | MI 53.4; functions ≥ 30: 0 (estimate) | MI 53.4; functions ≥ 30: 15 (estimate; integration) | MI 53.4; functions ≥ 30: 15 (estimate; integration) | MI 53.4; functions ≥ 30: 15 (estimate; integration) | MI 53.4; functions ≥ 30: 15 (estimate; integration) | MI 53.4; functions ≥ 30: 0 (estimate) | MI 53.4; functions ≥ 30: 0 (estimate) | MI 54.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 54.9; functions ≥ 30: 0 (measured; integration + unit) |
| better-auth | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 0 (estimate; integration) | MI 58.7; functions ≥ 30: 0 (estimate; integration) | MI 58.7; functions ≥ 30: 0 (estimate; integration) | MI 58.7; functions ≥ 30: 0 (estimate; integration) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.7; functions ≥ 30: 0 (measured; integration + unit) |
| billing | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate; integration) | MI 68.8; functions ≥ 30: 0 (estimate; integration) | MI 68.8; functions ≥ 30: 0 (estimate; integration) | MI 68.8; functions ≥ 30: 0 (estimate; integration) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.8; functions ≥ 30: 0 (measured; integration + unit) |
| cli | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 0 (estimate; integration) | MI 53.7; functions ≥ 30: 0 (estimate; integration) | MI 53.7; functions ≥ 30: 0 (estimate; integration) | MI 53.7; functions ≥ 30: 0 (estimate; integration) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 0 (measured; integration + unit) |
| config | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 59.6; functions ≥ 30: 0 (estimate; integration) | MI 59.6; functions ≥ 30: 0 (estimate; integration) | MI 59.6; functions ≥ 30: 0 (estimate; integration) | MI 59.6; functions ≥ 30: 0 (estimate; integration) | MI 59.6; functions ≥ 30: 0 (estimate) | MI 59.6; functions ≥ 30: 0 (estimate) | MI 61.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 61.4; functions ≥ 30: 0 (measured; integration + unit) |
| execution | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate; integration) | MI 83.4; functions ≥ 30: 0 (estimate; integration) | MI 83.4; functions ≥ 30: 0 (estimate; integration) | MI 83.4; functions ≥ 30: 0 (estimate; integration) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (measured; integration + unit) |
| html-processing | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 17 (estimate; integration) | MI 46.9; functions ≥ 30: 17 (estimate; integration) | MI 46.9; functions ≥ 30: 17 (estimate; integration) | MI 46.9; functions ≥ 30: 17 (estimate; integration) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (measured; integration + unit) |
| http | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate; integration) | MI 64.5; functions ≥ 30: 0 (estimate; integration) | MI 64.5; functions ≥ 30: 0 (estimate; integration) | MI 64.5; functions ≥ 30: 0 (estimate; integration) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.5; functions ≥ 30: 0 (measured; integration + unit) |
| identity | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate; integration) | MI 66.4; functions ≥ 30: 0 (estimate; integration) | MI 66.4; functions ≥ 30: 0 (estimate; integration) | MI 66.4; functions ≥ 30: 0 (estimate; integration) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 66.4; functions ≥ 30: 0 (measured; integration + unit) |
| mcp | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate; integration) | MI 51.2; functions ≥ 30: 0 (estimate; integration) | MI 51.2; functions ≥ 30: 0 (estimate; integration) | MI 51.2; functions ≥ 30: 0 (estimate; integration) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.2; functions ≥ 30: 0 (measured; integration + unit) |
| organizations | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 0 (estimate; integration) | MI 69.9; functions ≥ 30: 0 (estimate; integration) | MI 69.9; functions ≥ 30: 0 (estimate; integration) | MI 69.9; functions ≥ 30: 0 (estimate; integration) | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 69.9; functions ≥ 30: 0 (measured; integration + unit) |
| page-fetch | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 0 (estimate; integration) | MI 49.9; functions ≥ 30: 0 (estimate; integration) | MI 49.9; functions ≥ 30: 0 (estimate; integration) | MI 49.9; functions ≥ 30: 0 (estimate; integration) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 0 (measured; integration + unit) |
| search | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 1 (estimate; integration) | MI 48.3; functions ≥ 30: 1 (estimate; integration) | MI 48.3; functions ≥ 30: 1 (estimate; integration) | MI 48.3; functions ≥ 30: 1 (estimate; integration) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 0 (measured; integration + unit) |
| search-engine | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate; integration) | MI 33.0; functions ≥ 30: 0 (estimate; integration) | MI 33.0; functions ≥ 30: 0 (estimate; integration) | MI 33.0; functions ≥ 30: 0 (estimate; integration) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (measured; integration + unit) |
| sql | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI 41.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 41.9; functions ≥ 30: 0 (measured; integration + unit) |
| system-logs | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate; integration) | MI 63.1; functions ≥ 30: 0 (estimate; integration) | MI 63.1; functions ≥ 30: 0 (estimate; integration) | MI 63.1; functions ≥ 30: 0 (estimate; integration) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 63.1; functions ≥ 30: 0 (measured; integration + unit) |
| tenants | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI 79.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 79.0; functions ≥ 30: 0 (measured; integration + unit) |
| user-portal | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 6 (estimate; integration) | MI 51.2; functions ≥ 30: 6 (estimate; integration) | MI 51.2; functions ≥ 30: 6 (estimate; integration) | MI 51.2; functions ≥ 30: 6 (estimate; integration) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.1; functions ≥ 30: 0 (measured; integration + unit) |
| web | MI 60.2; functions ≥ 30: 22 (estimate) | MI 60.2; functions ≥ 30: 22 (estimate) | MI 60.2; functions ≥ 30: 22 (estimate) | MI 60.2; functions ≥ 30: 9 (estimate; integration) | MI 60.2; functions ≥ 30: 9 (estimate; integration) | MI 60.1; functions ≥ 30: 9 (estimate; integration) | MI 60.1; functions ≥ 30: 9 (estimate; integration) | MI 60.0; functions ≥ 30: 22 (estimate) | MI 60.0; functions ≥ 30: 22 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 59.6; functions ≥ 30: 0 (measured; integration + unit) |
| website-fetcher | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 3 (estimate; integration) | MI 60.9; functions ≥ 30: 3 (estimate; integration) | MI 60.9; functions ≥ 30: 3 (estimate; integration) | MI 60.9; functions ≥ 30: 3 (estimate; integration) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 0 (measured; integration + unit) |
| workos | MI 56.0; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 0 (estimate; integration) | MI 55.9; functions ≥ 30: 0 (estimate; integration) | MI 55.9; functions ≥ 30: 0 (estimate; integration) | MI 55.9; functions ≥ 30: 0 (estimate; integration) | MI 55.9; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 55.9; functions ≥ 30: 0 (measured; integration + unit) |

3 commits of main between c42aa823 and 2b3ad13b have no record.
1 commits of main between 9507e751 and 2282edd4 have no record.
5 commits of main between 0377cd12 and 57d9ce05 have no record.
1 commits of main between a16a40c0 and 77477864 have no record.
