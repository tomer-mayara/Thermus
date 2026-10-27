## Architecture comparison — reviewed candidate

**T2 Need architect** applies because the picker adds an optional runtime
use of the supplied AccessResolver (`internalInterface=true`) and changes the
browser/server default return destination (`contract=true`). Base:
`77477864d8238b9141e9619b6bcbb6b0aa7fb11b`; head `2907d105f85c9596401312d7082af86a5711df06`.

Supplementary C4 Level 3 comparison: the hosted Node server keeps the same owners.
Arrows show runtime calls through supplied contracts. Amber marks changed web
behavior; green marks the added picker GET use. Neutral calls remain.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "Arial, sans-serif", "fontSize": "16px", "edgeLabelBackground": "#ffffff", "clusterBkg": "#f8fafc", "clusterBorder": "#64748b"}, "flowchart": {"htmlLabels": true, "nodeSpacing": 35, "rankSpacing": 40, "wrappingWidth": 210}}}%%
flowchart TB
  browser["L2: user portal / browser<br/>Read pages; submit native forms"]
  subgraph server["L2: hosted Node server"]
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

- **Return:** bare picker forms now return to Connect at the normalized public
  base path. Explicit validated destinations keep their existing behavior.
- **Display:** the picker gains one compact native menu. Only current allowed
  grants for the selected workspace can show Members and Audit Log.
- **Recovery:** an optional role lookup denial or outage hides privileged links
  while the picker remains usable. Cancellation propagates; list failures retain
  the existing safe failure page and cookie effects.
- **Authority:** selection POST still checks Origin, CSRF, return path and current
  eligible membership before one session switch. Cookie order, refusal outcomes,
  other browser sessions and MCP-token workspace bindings remain unchanged.

The neutral Auth/switch arrow condenses session authentication and the POST-only
switch. App composition, identity-owned contracts, unrelated account routes and
MCP are omitted. The existing external API and HTTPS edge remain; its new caller
context is on the green arrow. The strongest changed callable behavior is the omitted-return_to default and
resulting selection 303. L3 plus these notes answer redirect compatibility and
optional lookup ordering/recovery; L4 would repeat private branches without adding
boundary detail, so it is omitted. All 16 registry blocks remain unchanged;
prose names the new behavior. The pinned head is `2907d105f85c9596401312d7082af86a5711df06`; base is `77477864d8238b9141e9619b6bcbb6b0aa7fb11b`.

Final head adds only the immutable base metric record to reviewed source head
`16c8e174f503f79c5011fe9ac7e157578ff49d74`; final-head-input-bridge.json proves every other tracked Git
object and mode identical. v2 preserves original source review and render provenance.
