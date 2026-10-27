# Code quality process

## Delta

Status: goal miss.

```text
  59.2  src/interfaces/web/account/administration-pages.ts  below 85
  72.8  src/interfaces/web/account/account-pages.ts  below 85
  6.4  test/acceptance/auth/hosted-member-removal-browser.runtime.ts  no goal
  16.1  test/integration/hosted-admin/account-routes-administration-pages.test.ts  no goal
  23.0  test/acceptance/logging/audit/hosted-storage-failure.runtime.ts  no goal
  23.9  test/acceptance/auth/hosted-members.test.ts  no goal
  30.1  test/acceptance/auth/hosted-invitations.test.ts  no goal
  30.1  test/support/drivers/browser/invitation-browser.ts  no goal
  30.9  test/acceptance/auth/hosted-live/administration-server.ts  no goal
  31.4  test/support/container/audit-sender-site.ts  no goal
  33.2  test/acceptance/auth/hosted-member-removal-scope.test.ts  no goal
  33.5  test/support/drivers/browser/admin-shell-browser.ts  no goal
  34.8  test/integration/auth/hosted-administration.test.ts  no goal
  35.8  test/acceptance/auth/hosted-workos-administration.test.ts  no goal
  38.0  test/acceptance/logging/audit/administration-capture.test.ts  no goal
  38.1  test/integration/hosted-admin/account-routes-removal.test.ts  no goal
  38.6  test/acceptance/auth/hosted-admin-journey.test.ts  no goal
  39.5  test/acceptance/auth/hosted-workos-role-access.test.ts  no goal
  42.0  test/support/in-process/hosted-audit-journey-site.ts  no goal
  47.0  test/acceptance/auth/hosted-membership-access.test.ts  no goal
  48.2  test/support/in-process/hosted-audit-snapshot-site.ts  no goal
  51.4  test/acceptance/auth/hosted-invitation-refusals.test.ts  no goal
  53.5  test/support/drivers/browser/member-removal-browser.ts  no goal
  55.1  test/support/in-process/browser-transport-site.ts  no goal
  not measured  src/interfaces/web/account/members-style.ts
Result: 2 of 2 production files below 85. Goal: 85 or more for each production file. 22 other files without a goal. 1 file not measured.
Comparison with 8278873552601ed156a9aaeeb31c41cdb84ad77a: ast-report/compare.html
```

## Review

Status: goal miss.

## AST Metrics review

Thermus review policy: new-function warnings require >10 paths; high starts at 25. Approved layer rules use CR-13 resolved imports.

Regressions: 1 high, 0 medium, 1 low. Improvements: 1. Gate: failed.

### Regressions

- **high**: Maintainability index: 11 -&gt; 6 (below 85 is hard to maintain) (`test/acceptance/auth/hosted-member-removal-browser.runtime.ts`, rule `maintainability-regression`)
  Refactor long or deeply nested functions and reduce responsibilities in this file
- **low**: Estimated bugs (Halstead): 3.35 -&gt; 4.09 (`test/integration/hosted-admin/account-routes-administration-pages.test.ts`, rule `bugs-regression`)
  This estimate grows with code volume and complexity; consider simplifying or splitting this file

### Improvements

- **low**: Estimated bugs (Halstead): 0.48 -&gt; 0.32 (`test/acceptance/auth/hosted-member-removal-browser.runtime.ts`, rule `bugs-improvement`)

## CRAP

Status: passed.

Reused verified compatible integration coverage.

## CRAP goals

Goals: CRAP < 30; new functions also CRAP ≤ 15.

| File | Function | Change | Paths | Coverage | CRAP | To do |
| --- | --- | --- | --- | --- | --- | --- |
| src/interfaces/web/account/administration-pages.ts | removalForm | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | noOrganizationPage | unchanged | 2 | 24.3% | 3.7 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | membersPage | changed | 3 | 97.5% | 3.0 | ok |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | removalResultPage | changed | 2 | 100% | 2.0 | ok |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | identityPolicyText | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | rolesText | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | sendForm | changed | 2 | 100% | 2.0 | ok |
| src/interfaces/web/account/account-pages.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/account-pages.ts | accessDeniedPage | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | noticePage | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | noticeResponse | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | seeOther | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | unconfirmedInvitationPage | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | invitationRow | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | roleLabel | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |

Known limit violations: 0. Measured target misses: 0. Unmeasured functions: 0. Required functions with unknown assessment or identity: 0.

## Architecture

Status: passed.

## Architecture of src/: base 82788735 → head

Modularity 0.33 → 0.33 · cross share 0.31 → 0.31 · cycles 1 → 1 · communities 4 → 4 · functions ≥ 30: 51 → 51

```mermaid
flowchart LR
  c_accounts["accounts<br/>28 files · MI 56.9 · paths 794<br/>● good: 0 fn ≥ 30"]
  c_app["app<br/>75 files · MI 59.3 · paths 1644<br/>▲ warning: 24 fn ≥ 30; assessment incomplete: 21 unknown"]
  c_pipelines["pipelines<br/>71 files · MI 49.5 · paths 1590<br/>▲ warning: 21 fn ≥ 30; assessment incomplete: 30 unknown"]
  c_shared_kernel["shared kernel<br/>4 files · MI 59.6 · paths 84<br/>● good: 0 fn ≥ 30"]
  c_accounts -. "48 · cycle" .-> c_app
  c_accounts -- "1" --> c_shared_kernel
  c_app -. "52 · cycle" .-> c_accounts
  c_app -. "5 · cycle" .-> c_pipelines
  c_app -- "3" --> c_shared_kernel
  c_pipelines -. "22 · cycle" .-> c_accounts
  c_pipelines -. "7 · cycle" .-> c_app
  c_pipelines -- "3" --> c_shared_kernel
  linkStyle 0 stroke:#d03b3b,stroke-width:2px
  linkStyle 2 stroke:#d03b3b,stroke-width:2px
  linkStyle 3 stroke:#d03b3b,stroke-width:2px
  linkStyle 5 stroke:#d03b3b,stroke-width:2px
  linkStyle 6 stroke:#d03b3b,stroke-width:2px
  classDef touched stroke-width:3px
  classDef gone stroke-dasharray:4 4,color:#999999
  classDef good stroke:#0ca30c
  classDef warning stroke:#fab219
  class c_app touched
  class c_accounts,c_shared_kernel good
  class c_app,c_pipelines warning
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
  c_app["app<br/>9 files · MI 60.2 · paths 177<br/>assessment incomplete: 6 unknown; 0 known fn ≥ 30"]
  c_audit_logs["audit-logs<br/>21 files · MI 53.4 · paths 610<br/>▲ warning: 15 fn ≥ 30; assessment incomplete: 14 unknown"]
  c_better_auth["better-auth<br/>5 files · MI 58.7 · paths 166<br/>● good: 0 fn ≥ 30"]
  c_billing["billing<br/>2 files · MI 68.8 · paths 6<br/>● good: 0 fn ≥ 30"]
  c_cli["cli<br/>2 files · MI 53.7 · paths 56<br/>● good: 0 fn ≥ 30"]
  c_config["config<br/>4 files · MI 59.6 · paths 84<br/>● good: 0 fn ≥ 30"]
  c_execution["execution<br/>4 files · MI 83.4 · paths 10<br/>● good: 0 fn ≥ 30"]
  c_html_processing["html-processing<br/>37 files · MI 46.9 · paths 946<br/>▲ warning: 17 fn ≥ 30; assessment incomplete: 27 unknown"]
  c_http["http<br/>4 files · MI 64.5 · paths 66<br/>assessment incomplete: 3 unknown; 0 known fn ≥ 30"]
  c_identity["identity<br/>5 files · MI 66.4 · paths 19<br/>● good: 0 fn ≥ 30"]
  c_mcp["mcp<br/>9 files · MI 51.2 · paths 186<br/>assessment incomplete: 3 unknown; 0 known fn ≥ 30"]
  c_organizations["organizations<br/>11 files · MI 69.9 · paths 192<br/>● good: 0 fn ≥ 30"]
  c_page_fetch["page-fetch<br/>5 files · MI 49.9 · paths 109<br/>● good: 0 fn ≥ 30"]
  c_search["search<br/>6 files · MI 48.3 · paths 131<br/>▲ warning: 1 fn ≥ 30"]
  c_search_engine["search-engine<br/>2 files · MI 33.0 · paths 56<br/>● good: 0 fn ≥ 30"]
  c_system_logs["system-logs<br/>3 files · MI 63.1 · paths 39<br/>● good: 0 fn ≥ 30"]
  c_user_portal["user-portal<br/>8 files · MI 51.2 · paths 71<br/>▲ warning: 6 fn ≥ 30"]
  c_web["web<br/>30 files · MI 60.1 · paths 617<br/>▲ warning: 9 fn ≥ 30; assessment incomplete: 4 unknown"]
  c_website_fetcher["website-fetcher<br/>6 files · MI 60.9 · paths 133<br/>▲ warning: 3 fn ≥ 30"]
  c_workos["workos<br/>16 files · MI 55.9 · paths 553<br/>● good: 0 fn ≥ 30"]
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
  c_app -- "3" --> c_organizations
  c_app -- "1" --> c_page_fetch
  c_app -- "1" --> c_search
  c_app -- "1" --> c_search_engine
  c_app -- "5" --> c_system_logs
  c_app -- "2" --> c_web
  c_app -- "1" --> c_website_fetcher
  c_app -- "1" --> c_workos
  c_audit_logs -- "2" --> c_organizations
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
  classDef warning stroke:#fab219
  class c_web touched
  class c_better_auth,c_billing,c_cli,c_config,c_execution,c_identity,c_organizations,c_page_fetch,c_search_engine,c_system_logs,c_workos good
  class c_audit_logs,c_html_processing,c_search,c_user_portal,c_web,c_website_fetcher warning
```

Legend: thick border = a component this pull request touched; `· new` and `· gone` = a component or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; border color = the CRAP band of the component (● good: complete assessment, no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse); numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base. Edges count distinct importing files per target component.

## Complexity of the changed files

| File | Maintainability | Decision paths | CRAP ≥ 30 | Risk rank |
| --- | --- | --- | --- | --- |
| src/interfaces/web/account/account-pages.ts | 72.8 → 72.8 | 10 → 10 | 0 → 0 | |
| src/interfaces/web/account/administration-pages.ts | 59.5 → 59.2 ↓0.3 | 27 → 27 | 0 → 0 | |
| src/interfaces/web/account/members-style.ts | not measured | not measured | not measured | |

### Functions at CRAP 30 or more, added or worse

None.

Unmatched functions: 0 (anonymous, duplicate, or not in the coverage).

Base functions without an estimated covered share: 123.

Coverage: integration suites at 6ced8db3.

## Trend of src/ on main

| Commit | PR | Date | Modularity | Cross share | Cycles | Maintainability | Functions ≥ 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 74f75656 | – | 2026-10-24 | 0.34 | 0.31 | 1 | 55.8 | 58 (estimate) |
| 9d0546b9 | #250 | 2026-10-25 | 0.34 | 0.31 | 1 | 55.8 | 58 (estimate) |
| 4d7f845b | – | 2026-10-25 | 0.34 | 0.31 | 1 | 55.7 | 0 (estimate; integration + unit) |
| 581f30cf | #256 | 2026-10-25 | 0.34 | 0.31 | 1 | 55.7 | 59 (estimate) |
| 8c6d204e | #258 | 2026-10-25 | 0.34 | 0.31 | 1 | 55.7 | 59 (estimate) |
| 9f07c04b | – | 2026-10-26 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| c9da79e6 | #260 | 2026-10-26 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| 57c99e2b | #261 | 2026-10-26 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| c42aa823 | #262 | 2026-10-26 | 0.33 | 0.31 | 1 | 55.2 | 60 (estimate) |
| 2b3ad13b | #269 | 2026-10-26 | 0.33 | 0.31 | 1 | 55.3 | 51 (estimate; integration) |
| this pull request | – | | 0.33 | 0.31 | 1 | 55.3 | 51 (measured; integration) |

Historical estimates use head coverage from the first recording pull request. Later estimates for the same base can differ. Counts include known lower-bound violations; other unknown functions are not counted.

### Maintainability trend

Missing values are gaps; lines stop at each gap.

Maintainability (maintainability), 74f75656 to this pull request.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Maintainability"
    x-axis ["74f75656", "9d0546b9", "4d7f845b", "581f30cf", "8c6d204e", "9f07c04b", "c9da79e6", "57c99e2b", "c42aa823", "2b3ad13b", "this pull request"]
    y-axis "Maintainability" 55.2 --> 55.8
    line [55.8, 55.8, 55.7, 55.7, 55.7, 55.2, 55.2, 55.2, 55.2, 55.3, 55.3]
```


### Functions ≥ 30 trend

Missing values are gaps; lines stop at each gap or change of count basis.

Functions ≥ 30 (head-derived estimate), 74f75656 to 9d0546b9.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate"
    x-axis ["74f75656", "9d0546b9"]
    y-axis "Functions at CRAP 30 or more" 57 --> 59
    line [58, 58]
```

4d7f845b: 0 (head-derived estimate; integration + unit). One point; no line.

Functions ≥ 30 (head-derived estimate), 581f30cf to c42aa823.

```mermaid
---
config:
  xyChart:
    xAxis:
      labelRotation: 45
---
xychart-beta
    title "Functions at CRAP 30 or more - head-derived estimate"
    x-axis ["581f30cf", "8c6d204e", "9f07c04b", "c9da79e6", "57c99e2b", "c42aa823"]
    y-axis "Functions at CRAP 30 or more" 59 --> 60
    line [59, 59, 60, 60, 60, 60]
```

2b3ad13b: 51 (head-derived estimate; integration). One point; no line.

this pull request: 51 (measured; integration). One point; no line.


### Trend by component

| Component | 74f75656 | 9d0546b9 | 4d7f845b | 581f30cf | 8c6d204e | 9f07c04b | c9da79e6 | 57c99e2b | c42aa823 | 2b3ad13b | this pull request |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.0; functions ≥ 30: 0 (estimate) | MI 60.2; functions ≥ 30: 0 (estimate; integration) | MI 60.2; functions ≥ 30: 0 (measured; integration) |
| audit-logs | MI 54.8; functions ≥ 30: 0 (estimate) | MI 54.7; functions ≥ 30: 0 (estimate) | MI 54.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 54.2; functions ≥ 30: 0 (estimate) | MI 54.1; functions ≥ 30: 0 (estimate) | MI 53.4; functions ≥ 30: 0 (estimate) | MI 53.4; functions ≥ 30: 0 (estimate) | MI 53.4; functions ≥ 30: 0 (estimate) | MI 53.4; functions ≥ 30: 0 (estimate) | MI 53.4; functions ≥ 30: 15 (estimate; integration) | MI 53.4; functions ≥ 30: 15 (measured; integration) |
| better-auth | MI 58.8; functions ≥ 30: 2 (estimate) | MI 58.8; functions ≥ 30: 2 (estimate) | MI 58.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 2 (estimate) | MI 58.7; functions ≥ 30: 0 (estimate; integration) | MI 58.7; functions ≥ 30: 0 (measured; integration) |
| billing | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate; integration + unit) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate) | MI 68.8; functions ≥ 30: 0 (estimate; integration) | MI 68.8; functions ≥ 30: 0 (measured; integration) |
| cli | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 0 (estimate; integration + unit) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 3 (estimate) | MI 53.7; functions ≥ 30: 0 (estimate; integration) | MI 53.7; functions ≥ 30: 0 (measured; integration) |
| config | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate; integration + unit) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 57.6; functions ≥ 30: 0 (estimate) | MI 59.6; functions ≥ 30: 0 (estimate; integration) | MI 59.6; functions ≥ 30: 0 (measured; integration) |
| execution | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate) | MI 83.4; functions ≥ 30: 0 (estimate; integration) | MI 83.4; functions ≥ 30: 0 (measured; integration) |
| html-processing | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 0 (estimate) | MI 46.9; functions ≥ 30: 17 (estimate; integration) | MI 46.9; functions ≥ 30: 17 (measured; integration) |
| http | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate; integration + unit) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate) | MI 64.5; functions ≥ 30: 0 (estimate; integration) | MI 64.5; functions ≥ 30: 0 (measured; integration) |
| identity | MI 62.0; functions ≥ 30: 0 (estimate) | MI 62.0; functions ≥ 30: 0 (estimate) | MI 62.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate) | MI 66.4; functions ≥ 30: 0 (estimate; integration) | MI 66.4; functions ≥ 30: 0 (measured; integration) |
| mcp | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 3 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate; integration) | MI 51.2; functions ≥ 30: 0 (measured; integration) |
| organizations | MI 76.4; functions ≥ 30: 1 (estimate) | MI 76.4; functions ≥ 30: 1 (estimate) | MI 76.4; functions ≥ 30: 0 (estimate; integration + unit) | MI 76.4; functions ≥ 30: 1 (estimate) | MI 76.4; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 1 (estimate) | MI 69.9; functions ≥ 30: 0 (estimate; integration) | MI 69.9; functions ≥ 30: 0 (measured; integration) |
| page-fetch | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 5 (estimate) | MI 49.9; functions ≥ 30: 0 (estimate; integration) | MI 49.9; functions ≥ 30: 0 (measured; integration) |
| search | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 0 (estimate; integration + unit) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 7 (estimate) | MI 48.3; functions ≥ 30: 1 (estimate; integration) | MI 48.3; functions ≥ 30: 1 (measured; integration) |
| search-engine | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate; integration + unit) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate) | MI 33.0; functions ≥ 30: 0 (estimate; integration) | MI 33.0; functions ≥ 30: 0 (measured; integration) |
| system-logs | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate; integration + unit) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate) | MI 63.1; functions ≥ 30: 0 (estimate; integration) | MI 63.1; functions ≥ 30: 0 (measured; integration) |
| user-portal | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate; integration + unit) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 0 (estimate) | MI 51.2; functions ≥ 30: 6 (estimate; integration) | MI 51.2; functions ≥ 30: 6 (measured; integration) |
| web | MI 60.9; functions ≥ 30: 21 (estimate) | MI 60.9; functions ≥ 30: 21 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 21 (estimate) | MI 60.9; functions ≥ 30: 21 (estimate) | MI 60.2; functions ≥ 30: 22 (estimate) | MI 60.2; functions ≥ 30: 22 (estimate) | MI 60.2; functions ≥ 30: 22 (estimate) | MI 60.2; functions ≥ 30: 22 (estimate) | MI 60.2; functions ≥ 30: 9 (estimate; integration) | MI 60.1; functions ≥ 30: 9 (measured; integration) |
| website-fetcher | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 1 (estimate) | MI 60.9; functions ≥ 30: 3 (estimate; integration) | MI 60.9; functions ≥ 30: 3 (measured; integration) |
| workos | MI 58.9; functions ≥ 30: 15 (estimate) | MI 58.9; functions ≥ 30: 15 (estimate) | MI 58.9; functions ≥ 30: 0 (estimate; integration + unit) | MI 58.4; functions ≥ 30: 16 (estimate) | MI 58.4; functions ≥ 30: 16 (estimate) | MI 56.0; functions ≥ 30: 16 (estimate) | MI 56.0; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 16 (estimate) | MI 55.9; functions ≥ 30: 0 (estimate; integration) | MI 55.9; functions ≥ 30: 0 (measured; integration) |

4 commits of main between 8c6d204e and 9f07c04b have no record.
3 commits of main between c42aa823 and 2b3ad13b have no record.
