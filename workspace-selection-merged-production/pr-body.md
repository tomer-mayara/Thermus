## Description

Selecting an organization changed the session but returned to the picker, which had no menu. Selection now opens Connect by default. The picker uses the compact Connect, Switch Workspace, Members, Audit Log menu; non-admin users see only the first two links.

Merged commit [89e79754](https://github.com/tomer-mayara/Thermus/commit/89e79754482704534530936c1cef7850394abb6f) is **live and verified for both production roles**. [Deployment and actual button journeys](https://github.com/tomer-mayara/Thermus/blob/e807842788001763d8f335e837db45581f0cd012/workspace-selection-merged-production/README.md); [complete tree matches the reviewed candidate](https://github.com/tomer-mayara/Thermus/blob/e807842788001763d8f335e837db45581f0cd012/workspace-selection-merged-production/source-equivalence.json).

## Review

**T2 Need architect** — Architecture: **T0: no architecture fact**. The declared `contract` and `internalInterface` changes require T2 under the [review policy](https://github.com/tomer-mayara/Thermus/blob/a421afc056ce3e400f2779c75683ea45270b96cb/AGENTS.md#review-tier-and-merge-eligibility).

**Architecture facts**:

- None. All 51 public declaration snapshots and 17 registry diagrams are unchanged.

[`.pr-impact.json`](https://github.com/tomer-mayara/Thermus/blob/44753a72a7c1cecbf076e1448c26a4ae4b93a9f2/.pr-impact.json) declares the default-return change and optional current-access lookup. Registry prose records that use; owners, selection authority, contracts, containers and deployment relationships remain unchanged.

**Merged and deployed.** GitHub confirms the owner-reported merge at 23:06:59 UTC; the user then explicitly requested deployment. Render deploy `dep-dbgiufou01pc73c7irl0` is live at the merged commit since 23:12:56 UTC. Both production accounts pass selection/menu checks, health/assets return 200, and the bounded new-instance error query is empty. The earlier staging email-quota failure remains in Validation; it is not relabelled as passing.

### Architecture comparison

Supplementary C4 Level 3 view, control-plane Node server; actual base `a421afc0` → head `44753a72`.

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

- Bare picker forms return to normalized Connect; explicit safe destinations keep their value.
- Only identity-bound, selected-workspace Admin access with product permission shows privileged links.
- Denial, mismatch or optional lookup failure preserves the basic picker; cancellation propagates. Provider timeout/retry rules remain.
- POST keeps Origin, CSRF, return-path and current-membership checks before one switch. Cookie order and MCP bindings remain.

L3 plus these notes answers the changed return contract and recovery; L4 would repeat private branches. Inherited SO-02 delivery and SO-03 tenant work are outside this increment. Full provenance and limits are in Quality review.

---
Reviewed candidate: [44753a72](https://github.com/tomer-mayara/Thermus/commit/44753a72a7c1cecbf076e1448c26a4ae4b93a9f2) · [Merge 89e79754](https://github.com/tomer-mayara/Thermus/commit/89e79754482704534530936c1cef7850394abb6f) · [Validation](https://github.com/tomer-mayara/Thermus/pull/281#issuecomment-6453601476) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/281#issuecomment-6453601866)

