# Audit first event review evidence

Base: 9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546. Implementation candidate: abaebf0c282e4bdc48627ee75f555da238ac2b50. Refresh if later commits alter source or review scope.

## Architecture inventory

The base registry has 13 Mermaid blocks: context; hosted and local containers; tool processing; hosted authentication; hosted Audit settings and delivery; System and Audit logs; local authentication; collaboration overview; MCP page fetch; hosted sign-in landing; hosted member read; deployment. Recount at final comparison.

Check the Audit settings and delivery, System and Audit logs, collaboration, lifetime and deployment prose. Existing component boundaries, source edges, construction, store ownership and external destinations stay. The private AuditSnapshots behavior changes inside audit-logs. Registry Mermaid is expected to remain byte-identical; the main PR diagram is a supplementary L3 comparison reconstructed from code and prose, not a changed registry drawing.

## Contract and behavior

Before: missing or expired settings metadata drops the current event and starts a read for future activity.
After: a bounded detached event batch can wait during that one read. A current enabled result observes the revision at Collector, then offers that batch once with the same revision. Fresh disabled settings and rejected loads drop payload permanently. Caller success does not promise delivery.

The initial read result decides admission. A concurrent Enable that the read observes can admit in-flight events. A later Enable after disabled, absent, failed or expired resolution cannot resurrect discarded content. Collector still reads current enabled settings and exact revision before each attempt; changed settings can discard accepted work.

Default extra staging bounds: 16 events / 1 MiB per load, 128 KiB per event, at most two loads, 2.5 seconds per batch from its first event. These add to Collector's separate 128 events / 8 MiB and 30-second age. Payload can live across both owners for up to 32.5 seconds. Hung native reservations may live longer without payload. No new storage, background service, polling or durable replay.

## L4 decision

Strongest changed callable behavior: AuditSnapshots.writeAuditEvent returns true for bounded provisional admission while settings load. The review question is whether first content can survive asynchronous settings discovery without blocking product work, retaining rejected content, or bypassing revision authorization. The owner-level L3 plus before/after and failure/lifetime notes answer it. A separate method diagram would repeat the state transition and is omitted.

## Drawing v1

Rendered with existing local Mermaid 12.2.0 and Playwright Chromium at 800px. Manager inspected the PNG at normal width: title clears the boundary; all labels readable; arrows terminate at intended owners; no crossed labels; neutral stable links and amber changed Audit owner. app composition, System logging and unrelated provider work are omitted because they are unchanged. SQL read/write and OTLP send remain labeled retained. No new runtime dependency is shown.

Manager reviewed both source files and changed tests. Independent design reviewer found no production defect; test precision fixes described below are included in the implementation candidate. Final complete-candidate gates remain pending.

## Independent review of v1

The design reviewer found no core correctness blocker and confirmed the L3 owners/neutral relationships. Reviewer requested clearer nonblocking wording. v2 replaces “bounded wait” with “bounded staging during settings read”. No other diagram semantics change. Rerender and manager inspection required for v2.

## Final design review

The read-only reviewer checked the whole source/test delta, including new pending tests. Three old assertions initially targeted the newly retained startup event instead of the intended later event, and the revision-observation case needed distinct old-active/old-queued/refresh-trigger records. The implementation agent fixed these and reran 57 focused cases successfully. Manager reviewed the corrected diff and accepted it. No remaining source or test finding was reported. v2 was parsed, rendered and inspected at 800px by reviewer and manager; all labels and relationships are legible. This agent review is not human architect approval.

The added bound fields belong to composition-only modules. None of the 48 listed public declaration snapshots references AuditSnapshotBounds or AuditSnapshotsOptions. The canonical declaration check must still pass. The contract impact flag requires architect review for the changed customer capture guarantee. No new architectural decision record is needed for this scoped correction of the approved Audit capture flow.

## Manager review of the complete source and test candidate

Reviewed 35f25c7b9a13f46e9e4cd60bb329aa1f552a43a9 against 9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546. Read both source files, the pending-event regressions and the acceptance outcomes. The code keeps payload ownership on the existing settings load, preserves its absolute deadline and physical read reservation, and flushes only after revision observation. The corrected dispatch fixtures retain the startup send and inject later failures only after it settles. No remaining correctness or simplification finding. All 13 registry Mermaid blocks are byte-identical to the base. v2 remains the authoritative comparison.

## Final provenance

Final candidate `f0d4efe3d48ea19bfe86457d923605325e0beae1`, trusted base `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`. The only addition after the manager's source/test review is the generated base metric record. Rechecked the final diff: both production files, all tests and the registry are byte-identical to the reviewed candidate. The v2 diagram and semantic comparison remain current. No callable declaration snapshot, component, edge, registry drawing, container or deployment changes. The observable customer Audit capture promise changes and remains declared as contract impact.
