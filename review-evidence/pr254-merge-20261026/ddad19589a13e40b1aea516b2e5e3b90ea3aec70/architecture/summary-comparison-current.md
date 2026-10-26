### Architecture comparison — hosted Thermus Node server

Candidate `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`; actual parent and merge base `b630a76275d5809a498ae63e1cbc322086f4194f` (PR #253). Complete-stack main base: `8c6d204e8588a664438ba8934ab36670b802525f`. This supplementary C4 L3 comparison derives from the pinned code and registry; it compares this increment only.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 180, "nodeSpacing": 25, "rankSpacing": 35, "subGraphTitleMargin": {"top": 10, "bottom": 25}}}}%%
flowchart TB
  subgraph server["C4 L3 · Thermus Node server · hosted"]
    web["web · CHANGED<br/>Before: invitation writes<br/>After: adds removal POST<br/>Trusted tenant; browser gates"]
    org["organizations · CHANGED overview<br/>Read-time removable hint<br/>Current Admin / target rules<br/>Durable removal and last Admin"]
    audit["audit-logs · CHANGED contract<br/>Before: invitation metadata<br/>After: removal metadata too<br/>Existing capture and SQL adapter"]
    workos["workos · unchanged<br/>Current access and directory<br/>One exact membership deletion"]
    web -->|existing session / access reads| workos
    web -->|ADDED runtime use: removeMember| org
    org -->|existing removal store| audit
    web -->|ADDED: trusted-tenant removal capture| audit
    org -->|existing directory calls| workos
  end
  db[("L2: PostgreSQL<br/>Existing removal intent / receipts")]
  remote["External: WorkOS<br/>Membership authority"]
  audit -->|existing SQL / TLS| db
  workos -->|existing SDK / HTTPS| remote
  classDef changed fill:#fff1ce,stroke:#a56b00,color:#222
  class web,org,audit changed
  linkStyle 1,3 stroke:#16803b,stroke-width:3px,color:#11652f
  style server fill:#fafafa,stroke:#777,color:#222
```

- Before, Members offered invitation writes and the existing coordinator had no browser caller. After, web requires current selected-organization access, trusted tenant, POST, configured Origin, CSRF and exact organization/membership/revision fields before one removeMember call. The overview removable field is a display hint; organizations still owns current Admin, target support, revision and last-Admin authority.
- The existing durable per-organization hold, operation-bound receipts, 30-second server lifetime and single exact WorkOS deletion keep their rules. Busy and unknown do not replay. Native confirmation names the target and revision; Cancel follows a GET and starts no intent.
- The POST returns a fixed result without another Members GET. A later read failure cannot replace that result. Self-removal retains identity-only workspace selection and sign-in guidance, and current portal/MCP access is checked again. No new session mutation or recovery store is added; a current read cannot settle an uncertain operation.
- AdministrationChange now accepts remove-member, membership ID and safe removal outcomes. Web selects the trusted tenant and captures after the coordinator outcome, before its HTTP response. Capture remains best effort; it cannot change the result, release a hold or replay deletion. Inherited safe actor names, bounded pending first-event capture, revision-gated export and captured time in both OTLP timestamp fields remain unchanged.

Three existing public declarations change: administration-overviews (removable hint), account-form (checked memberRemovalIn parser), and audit-log (removal action/target). Existing actor-name and timestamp fields are neutral inherited context. App composition, browser HTTP, current-revision customer export, billing and MCP are omitted from the drawing; their retained rules remain in the registry.

Current test results, classification, human approval scope and merge eligibility belong to the maintained PR records. This architecture comparison makes no new pass, approval, merge, rollout or release claim.
