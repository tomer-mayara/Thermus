# Quality review notes

## Scope and review

The source delta stays in two existing Audit files. No new component, import edge, dependency, datastore or deployment. The customer capture guarantee changes: bounded events can wait for the first settings read, rather than being lost at startup/expiry. The contract and sensitiveBehavior flags require architect review; a contract-reference document also changes. User authorization covers implementation and PR creation, not merge/deployment. No human approval is claimed.

The independent design reviewer signed off on source/test behavior and v2 L3 diagram. The manager read the changed source and relevant tests, examined failure and closure paths, and applied the requested test precision corrections. A later test-only follow-up 35f25c7b was independently reviewed with no remaining findings. The correction preserves the real roles and keeps buffering within the load lifetime; a new cache service or queue framework is not needed.

## habit-hooks

Ran all 15 supported changed candidate files serially with unchanged repository config and --no-snooze. Thirteen files returned 0; two returned 1 for eight reported findings. No invocation failed or was incomplete; snooze remains []. Retained dispositions:

- audit-snapshots.ts read complexity at 103: the existing read boundary keeps pre-read deadline, result identity/deadline, metadata validation, downstream observation failure isolation and unconditional cleanup together. This repair adds one flush call, not new decision branches in read. Splitting the guarded asynchronous frame would scatter its cleanup rule; focused deadline/failure and Collector tests cover it.
- audit-snapshots.ts comment 15: retains the nonblocking capture/no remote authorization contract so callers do not treat a snapshot as send permission.
- comment 43: explains why a capture exception cannot propagate or disclose its cause through another log.
- comment 67: explains fixed metadata accounting; actual field length is not a safe bound on reserved revision state.
- comment 92: explains why an expired resident can still consume metadata until native settlement.
- comment 96: explains exclusive pending-content ownership, required to clear payload while a database promise is unresolved.
- comment 128: records the non-obvious initial-read admission decision and no-replay rule; this is not an event-time enabled guarantee.
- audit-snapshots.test.ts exceeds 200 lines: one cohesive owner test file retains its existing lifetime/admission coverage. New pending-buffer cases already live in a separate focused file. Splitting established cases solely at a line threshold would add navigation without changing responsibilities.

No exception, baseline change, or suppressed finding is introduced by these dispositions. Final function goals and checker notes are recorded after the complete analysis.

## Measured review findings

The first completed review report has four findings on the complete source/test candidate:

- High, `audit-snapshot-state.ts` MI 67.59 → 61.66: the two added functions reserve and release pending payload on the existing `SnapshotLoad` state. They are small, have one responsibility each, and use the same bounds and detached event projection already owned by this file. Moving them to a new module would split one state's invariants and add an import without simplifying either function. Retain this existing-file goal miss and the drop over five points; the reason is cohesion and explicit accounting, not simply that the file was already low.
- High, `activity-snapshots.test.ts` MI 43.10 → 38.00: test files have no production MI goal. Each Given/When/Then scenario keeps its setup, observable first-event outcome and no-revival assertion together. The added expiry scenario and input/result assertions increase the file measure; extracting away those assertions would hide the acceptance specification. Retain the finding.
- Medium, `audit-snapshots.ts` 156 lines against the 150-line warning: the existing owner gains a focused flush method and payload cleanup on its existing terminal paths. Keep this single lifecycle owner and its explanatory comments. A new class or mechanically compressed code would make the lifetime rule harder to review.
- Low, `audit-snapshots.ts` efferent coupling 13 against 10: the additional symbols come from its existing state helper module. No new source edge or runtime dependency is introduced. Retain the imports that name reservation and release rather than duplicate their accounting.

No rule, threshold, baseline, or suppression was changed. These findings do not require an exception entry for an existing file under the trusted policy. Added and changed function CRAP goals are assessed separately.

## Final candidate, function goals and policy answers

Candidate: `f0d4efe3d48ea19bfe86457d923605325e0beae1`. Base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`. The final commit only adds the generated immutable base metric record. Source and tests are byte-identical to the fully tested `35f25c7b` candidate.

Final process: Delta and Review completed with the retained findings above; CRAP and Architecture passed. There was no failed or unavailable analysis stage. `audit-snapshots.ts` MI is 51.64 → 48.56. Keep this existing-file goal miss because the class owns one coordinated load/cache lifecycle: read admission, deadlines, nonblocking capture and terminal cleanup. The new flush is only nine lines and has CRAP 6.0; extracting another lifecycle owner would distribute cleanup without reducing a decision. Both low-file detail commands completed and their reports are included.

Every added or changed function meets its CRAP goal: read 10.0 (99.5% coverage), writeAuditEvent 9.0 (100%), loadLater 7.0 (100%), new flushPending 6.0 (99%), new retainPendingEvent 4.0 (100%), close 4.0 (100%), expire 3.0 (100%), finish 2.0 (100%), new clearPendingEvents 1.0 (100%), and the new load callback 1.0 (100%). No required function has unknown identity or coverage. No metric exception is used. Base CRAP values in architecture trends use head coverage and are estimates; unchanged repository-wide findings and incomplete coverage outside the selected change are not claimed as fixed. The same one existing cycle remains; no source edge or cycle grows.

The committed-candidate checker completed: **T2 Need architect**, local eligibility **eligible**, no technical blockers. Generated architecture line: `T0: no architecture fact`. The tier comes from `impact.contract`; the additional T1 reasons are the contract document `docs/reference/mcp-fetch-tool.md` and `impact.sensitiveBehavior`. The checker lists no structural fact. Its three informational notes are all retained: 48 public modules have unchanged snapshots; the state helper MI dropped over five points; that same MI finding is high. The unchanged declaration note follows from private behavior only; the two MI notes share the cohesive-state reason above.

Policy question: Does a client, user or operator see a different input, output, error or default? Yes: the customer Audit destination can now receive the first event after startup or expiry if the initial settings read returns enabled before the deadline. MCP input, result, error and response latency contracts do not change. The initial settings observation controls admission, including a concurrent Enable it sees. A later Enable cannot revive discarded data. Each delivery attempt still requires enabled settings with the admitted revision. Existing sanitization, truncation, tenant scope, SSRF protection, System/Audit isolation and bounded best-effort delivery remain.

The manager signs off the implementation, regression coverage, evidence and supplementary v2 L3 comparison. Independent agent review found no remaining defect. Required independent human architect approval for this exact candidate remains pending, so overall **merge status is blocked**. There is no de-escalation or earlier human approval for this change.
