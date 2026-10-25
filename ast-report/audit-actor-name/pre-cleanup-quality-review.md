## Quality review

Candidate: [19e60e2b14a36bb1a1527309dd31e78b7ef28e5d](https://github.com/tomer-mayara/Thermus/commit/19e60e2b14a36bb1a1527309dd31e78b7ef28e5d)  
Trusted base: [4d7f845b8925389ec734645bd9b7cdde11cdea18](https://github.com/tomer-mayara/Thermus/commit/4d7f845b8925389ec734645bd9b7cdde11cdea18)

**T2 Need architect — overall blocked.** The mechanical checker reports local eligibility with no mechanical blocker, but required container gates and current-candidate human architect approval remain outstanding. No merge or deployment occurred. [Full checker](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/tier.json).

Tier reasons, all retained:

- **T2:** declaration snapshots change for `AuthenticatedUser`, `AuditContext`, and `DestinationSettingsService.test`. The main description is the authoritative architecture comparison.
- **T2:** `impact.contract` and `impact.internalInterface`: optional trusted display data is resolved, copied and exported through these contracts.
- **T1:** `impact.sensitiveBehavior`: a profile display name reaches customer Audit export. It cannot grant access, select a tenant or replace the stable identity.
- **T1:** read/policy path `docs/implementation/ast-metrics-review.md`; the guide explains strict JSDoc-boundary matching. No metric threshold or evidence guard changes.
- **T1:** client contract document `docs/reference/mcp-fetch-tool.md`; it records the new optional attribution field and unchanged stable ID.

**Policy answer — does a client, user or operator see a different input, output, error or default?** Customer OTLP records gain optional `actor.name`; `actor.authority` and `actor.subject` retain the stable identity, including the WorkOS user ID. WorkOS reads only the matching provider profile after current grants allow access. Caller-supplied names are ignored. Native nonempty name takes precedence; absent/null/blank permits first/last fallback. Invalid nonempty native names are omitted. Empty, wrong-type, control-bearing, malformed UTF-16 or over-1,024-byte names are omitted; record capture still succeeds. Audit uses its existing redaction and byte limits. Profile errors preserve allowed access/ID-only events. The existing SDK bounds the extra read to five seconds with zero retries; it occurs for each allowed resolution, even with export off. BetterAuth reuses its account read. Product result/authorization rules and System record fields stay unchanged.

### Metrics and retained findings

[Complete process](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/process.md) · [machine report](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/process.json) · [review](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/review.md) · [CRAP](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/crap.json) · [base snapshot](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/snapshot-base.json) · [head snapshot](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/snapshot.json)

All 22 added/changed production function rows have measured coverage and meet their goals. Largest new function is `profileNameOf`: CRAP 12 at 100%; `auditActorName` 7 at 100%, `displayNameOf` 6 at 100%, `encodeAuditEvent` 5 at 100%. Largest changed row is `callTool` 16.000006912 at 99.7%; `testSaved` 15.002737575 at 97.7%. No numeric exception is added or used.

Nine existing production files remain below MI 85; no production file is new. `AuditLog` passes at 88.1. Each retained file's measured score and specific ownership reason is in the [retained-finding review](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/quality-retained-findings.md); existing low scores alone are not the justification. The process exits 1 for these valid retained goal misses, not a tool failure. In particular:

- WorkOS MI 67.8821 → 61.5815 (high), file complexity 56 (medium), and new `profileNameOf` complexity 12 (medium): one small provider adapter owns matching-profile checks and native/split precedence after authorization. Further extraction would scatter that policy; required branches are fully measured.
- Test-only WorkOS connection MI 49.0302 → 41.2021 (high): the physical stalled-body proof keeps fetch signal, body entry, predeadline state, timeout rejection and single attempt together. Test files have no production MI goal.
- `callTool` complexity 15 → 16 (medium): explicit optional-name copying stays beside the final public outcome; applicable CRAP passes.
- Audit projection and destination service efferent coupling 11 (two low findings): the Audit-owned normalizer is shared by three entry points; the service reuses the Audit actor contract. No component edge or cycle is added.

The one-line tooling correction skips JSDoc trivia when locating V8's executable function start. Exact source, unique identity, start/end and source-map checks remain. Actual functions/Inspector fixtures map 11/11 after versus 1/11 before; all 33 negative guards remain. Original evidence is preserved, fresh coverage was captured after the fingerprint changed, and no coverage report was edited. [Manual proof](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/source-bindings-after.json), [old reports](https://github.com/tomer-mayara/Thermus/tree/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/metrics-v1). The first complete process generated the base metric history; its hash is [recorded and verified unchanged](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/history-record.json).

### Habit-hooks and informational notes

Final habit-hooks exit 1: 101 retained findings (11 complexity, one function size, two parameter count, 83 comments, four test-file sizes). Two inaccurate inherited test comments were removed; snooze remains `[]`. [Raw report](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/habit-hooks.log) and [every grouped disposition](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/quality-retained-findings.md) give concrete reasons for retained lifecycle owners, input contracts, security comments and cohesive test stories. This is reviewed retention, not a clean lint pass.

Every checker note is accounted for:

- 48 public modules, three changed snapshots: all regenerated and checked; exact diffs are folded in the main description.
- Audit sender's dependencies on the log and encoder, and send's dependency on the log, change transitively without changing their own declarations. Transport signatures remain stable while carrying the optional field.
- Browser session, session controls and identity verifier depend on the updated identity type but keep their own declarations; no name-based authorization is introduced.
- WorkOS MI-drop and retained-high-finding notes have the specific dispositions above.
- Local mechanical eligibility does not establish local gate completion or human approval. The two overall blockers remain in the main description and Validation.

### Review and architecture provenance

Independent source, contract, transport-timeout, architecture/render and tooling reviews were performed by the `audit_name_design` agent and accepted by the root manager. These are agent reviews, not independent human approval. No de-escalation or exception is requested. Prior approval for PR #252 does not cover this candidate. [Pinned review and failure history](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/review-history.md).

<details><summary>Architecture provenance, evidence and L4 decision</summary>

Base 4d7f845b8925389ec734645bd9b7cdde11cdea18; final candidate 19e60e2b14a36bb1a1527309dd31e78b7ef28e5d. Initial v1 review was at 5a11cdace053954d6b1f434adc26be5ef2605cd9. Subsequent exact-self-profile test correction, comment cleanup, coverage-tool repair, impact and metric-history updates do not change production source/contracts. Final candidate comparison and manager review confirm that v1 remains current.

All 13 registry Mermaid blocks were inventoried and are byte-identical. Relevant hosted/local, identity, Audit, System, runtime and deployment prose/code were read at both revisions. Registry prose changes; no container, deployment, component, public module or component dependency is added. [Before registry](https://github.com/tomer-mayara/Thermus/blob/4d7f845b8925389ec734645bd9b7cdde11cdea18/architecture/components.md), [after registry](https://github.com/tomer-mayara/Thermus/blob/19e60e2b14a36bb1a1527309dd31e78b7ef28e5d/architecture/components.md), [view inventory](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/architecture/v1/inventory.json).

The supplementary L3 runtime comparison is scoped to the hosted Node server; WorkOS/customer OTLP are external peers. Neutral calls survive; amber marks changed payload/responsibility. Existing app composition, WorkOSOrganizations grant/catalog work, session operations, export/storage lifetime and System diagnostics are omitted with no change claimed. Local BetterAuth is outside the hosted view and reuses its existing account read.

Code evidence: [WorkOS before](https://github.com/tomer-mayara/Thermus/blob/4d7f845b8925389ec734645bd9b7cdde11cdea18/src/accounts/providers/workos/workos-auth-provider.ts) / [after](https://github.com/tomer-mayara/Thermus/blob/19e60e2b14a36bb1a1527309dd31e78b7ef28e5d/src/accounts/providers/workos/workos-auth-provider.ts#L78); [identity before](https://github.com/tomer-mayara/Thermus/blob/4d7f845b8925389ec734645bd9b7cdde11cdea18/src/accounts/identity/access-context.ts) / [after](https://github.com/tomer-mayara/Thermus/blob/19e60e2b14a36bb1a1527309dd31e78b7ef28e5d/src/accounts/identity/access-context.ts#L77); [MCP before](https://github.com/tomer-mayara/Thermus/blob/4d7f845b8925389ec734645bd9b7cdde11cdea18/src/interfaces/mcp/fetch-tool-server.ts) / [after](https://github.com/tomer-mayara/Thermus/blob/19e60e2b14a36bb1a1527309dd31e78b7ef28e5d/src/interfaces/mcp/fetch-tool-server.ts#L72); [Audit projection](https://github.com/tomer-mayara/Thermus/blob/19e60e2b14a36bb1a1527309dd31e78b7ef28e5d/src/logs/audit/audit-event-projection.ts#L10), [synthetic Test copy](https://github.com/tomer-mayara/Thermus/blob/19e60e2b14a36bb1a1527309dd31e78b7ef28e5d/src/logs/audit/destination-settings-service.ts#L63), [OTLP field](https://github.com/tomer-mayara/Thermus/blob/19e60e2b14a36bb1a1527309dd31e78b7ef28e5d/src/logs/audit/otlp-audit-encoding.ts#L45), [local profile reuse](https://github.com/tomer-mayara/Thermus/blob/19e60e2b14a36bb1a1527309dd31e78b7ef28e5d/src/accounts/providers/better-auth/better-auth-provider.ts#L80).

Strongest public change: `AuditContext.actor.name`, also in resolved identity and Test actor input; WorkOS gains an optional profile-read constructor collaborator. Review question: can optional profile data change authorization, stable identity or delivery after profile failure? L3 plus explicit ordering/failure/caller notes answers it, so L4 is omitted. This does not claim public callable contracts are unchanged.

[Mermaid source](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/architecture/v1/comparison.mmd), [SVG](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/architecture/v1/comparison.svg), [800-pixel render](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/architecture/v1/comparison-800.png), [review notes](https://github.com/tomer-mayara/Thermus/blob/cf52f2c0e059a91f3af6b512af4cfc848e42a2e5/ast-report/audit-actor-name/architecture/v1/review-notes.md). Mermaid 12.2.0/Playwright parsed and rendered the source; root manager and independent agent inspected it at normal PR width, including title, labels, arrow targets and crossings. Main-description Mermaid is the same source byte-for-byte. All comparison history remains in these artifacts.

</details>

Overall status remains **blocked/Draft** until the selected container gates finish and a qualified architect approves the resulting current candidate.

