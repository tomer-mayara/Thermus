## Description

Choosing an organization changed the session but returned to the same picker, which had no workspace menu. Selection now opens Connect by default, including the current organization. The picker keeps the compact Connect, Switch Workspace, Members, Audit Log menu; non-admin users see only the first two links.

## Review

**T2 Need architect** — Architecture: **T0: no architecture fact**. Declared `contract` and `internalInterface` changes require T2 under the [review policy](https://github.com/tomer-mayara/Thermus/blob/f6b523967223da5ebddafdef1a508d3936cee01c/AGENTS.md#review-tier-and-merge-eligibility).

**Architecture facts** (complete candidate checker):

- None. All 51 public declarations and 17 registry diagrams are unchanged.

[`.pr-impact.json`](https://github.com/tomer-mayara/Thermus/blob/feaddbdec5f9e2cc7bf8e07050a4d5e7aa5e5769/.pr-impact.json) declares the browser return-default change and optional picker access lookup. Registry prose records that runtime use. Owners, imports, public signatures, selection authority, containers, and deployment relationships remain unchanged.

**Merge status: blocked only by current-candidate human architect/owner approval.** All selected local release gates pass; retained metric and habit findings have reviewed reasons. The fix is not yet deployed.

### Architecture comparison

Supplementary C4 Level 3 view, control-plane Node server; base `f6b52396` → head `feaddbde`. Amber marks changed behavior, green added runtime use, and neutral relationships remain.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "Arial, sans-serif", "fontSize": "16px", "edgeLabelBackground": "#ffffff", "clusterBkg": "#f8fafc", "clusterBorder": "#64748b"}, "flowchart": {"htmlLabels": true, "nodeSpacing": 35, "rankSpacing": 40, "wrappingWidth": 210}}}%%
flowchart TB
  browser["L2: user portal / browser<br/>Read pages; submit native forms"]
  subgraph server["L2: control-plane Node server"]
    web["web · TypeScript<br/>Account routes and page rendering<br/>CHANGED: picker menu and default return"]
    organizations["organizations · TypeScript<br/>List eligible workspaces;<br/>authorize current selection"]
    workos["workos · TypeScript / SDK<br/>Authenticate and switch sessions;<br/>read current memberships and grants"]
    web -->|"Existing: listOrganizations;<br/>POST authorizeSelection"| organizations
    organizations -->|"Existing: current directory reads"| workos
    web -->|"ADDED GET picker use:<br/>optional selected-workspace access"| workos
    web -->|"Auth<br/>switch"| workos
  end
  remote["External system: WorkOS<br/>Identity, memberships and roles"]
  browser -->|"Existing HTTP: GET picker;<br/>POST workspace selection"| web
  workos -->|"Existing HTTPS / SDK"| remote
  classDef stable fill:#f8fafc,stroke:#64748b,color:#0f172a
  classDef changed fill:#fef3c7,stroke:#b45309,color:#0f172a
  class browser,organizations,workos,remote stable
  class web changed
  linkStyle 2 stroke:#15803d,stroke-width:3px,color:#166534
```

- Bare picker forms return to the normalized Connect path. Explicit safe destinations retain their exact value.
- The menu requires selected-workspace, identity-bound Admin access and product permission. Denial, mismatch or lookup failure preserves the basic picker; cancellation propagates.
- The optional lookup reads current membership/roles and may read the existing display profile. It grants no selection authority; provider timeouts and retries remain unchanged.
- POST retains Origin, CSRF, return-path and current-membership checks before one session switch. Cookie order, other sessions, and MCP bindings remain unchanged.

L3 plus these notes answers the changed default and recovery; L4 would repeat private branches. The inherited tenant container is outside this picker flow. Full provenance and limits are in Quality review.

---
Candidate: [feaddbde](https://github.com/tomer-mayara/Thermus/commit/feaddbdec5f9e2cc7bf8e07050a4d5e7aa5e5769) · [Validation](https://github.com/tomer-mayara/Thermus/pull/281#issuecomment-6453601476) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/281#issuecomment-6453601866)
