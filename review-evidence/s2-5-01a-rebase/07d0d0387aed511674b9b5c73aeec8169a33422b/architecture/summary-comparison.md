### Architecture comparison — hosted Node server

Compare candidate `07d0d0387aed511674b9b5c73aeec8169a33422b` with trusted main merge base `581f30cfaa32b01399422b087b0f0bdc3b800f70`. This is not a stack. This supplementary L3 view derives from code and registry prose; all 13 registry Mermaid views remain unchanged.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 400, "nodeSpacing": 25, "rankSpacing": 25}}}%%
flowchart TB
  subgraph server["L2 container: Thermus Node server · hosted"]
    app["app · TypeScript<br/>Shared client and directory construction<br/>CHANGED: raw-reader binding"]
    adapter["workos · TypeScript / SDK<br/>Provider reads and directory changes<br/>CHANGED: raw GET before SDK default<br/><span style='color:#15803d'>ADDED: exact-ID deletion boundary</span>"]
    org["organizations · TypeScript<br/>Directory contract and administration<br/><span style='color:#15803d'>ADDED: management and deletion contract</span>"]
    app ==>|"CHANGED composition:<br/>raw membership reader"| adapter
    adapter -.->|"Source: implements<br/>directory contract"| org
    org -->|"Existing runtime:<br/>members / invitations"| adapter
  end
  provider["External system: WorkOS / AuthKit<br/>Memberships, users, roles, invitations"]
  adapter -->|"Existing SDK HTTPS"| provider
  style app fill:#fff7ed,stroke:#b45309,color:#222222
  style org fill:#fff7ed,stroke:#b45309,color:#222222
  style adapter fill:#fff7ed,stroke:#b45309,color:#222222
  style server fill:#fafafa,stroke:#777777,color:#222222
  linkStyle 0 stroke:#b45309,color:#222222,stroke-width:3px
```

- Before, SDK normalization could turn missing/null management into ordinary. The shared-client raw reader now retains unknown; member revisions include management, and all current grant slugs remain available. It keeps filters, cursors and one request per membership read.
- Before, the directory had no deletion callable. It now sends one exact membership ID. Normal void completion reports applied; only `422 / organization_membership_directory_managed` proves unsupported without effect. Other errors throw unchanged with unknown effect; retries remain zero and the request timeout remains five seconds.
- Existing administration reads, authorization and display filtering stay at their owners. The upstream actor-name `userManagement` binding stays present; raw membership reads and optional profile reads share the same existing client. Browser routes and administration methods do not call deletion.
- This boundary adds no admission, current-authority, last-Admin, serialization, storage or recovery rule. Later slices own those rules. Controlled-wire specifications do not supply live deletion proof; S2.5-02 remains the release hold.
