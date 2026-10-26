# Current Habit review

Candidate `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`; actual parent `b630a76275d5809a498ae63e1cbc322086f4194f`; complete-candidate Habit base `8c6d204e8588a664438ba8934ab36670b802525f`.

Fresh run exit 1: 437 findings on 49 reported files. Counts: 6 complexity, 5 parameter, 410 comment and 16 size findings. Every current location, exact text, hash and retained reason is in JSON. Snooze is empty; no finding is suppressed.

All findings match prior #254 category/path/text. Forty-four files match whole-file bytes. Five files have upstream changes and were reviewed in their current context:

- src/app/hosted-workos-application.ts: Current upstream capture wiring is present on both sides. The composition still owns override precedence, optional AuditSnapshots, one directory/client and ordered cleanup; this increment does not change those responsibilities.
- src/logs/audit/audit-event-projection.ts: Current upstream context projection bounds an optional actor name before copying it. The reported input validator and the three named administration targets retain their exact accepted-input roles. Current source was reviewed; whole-file identity with old #254 is not claimed.
- src/logs/audit/audit-log.ts: The upstream AuditContext has an optional actor name. Removal still adds only a named action/target to the finite union. Synchronous best-effort capture and no replay after a failed sink remain the comment contracts.
- src/logs/audit/otlp-audit-encoding.ts: Current upstream encoding validates the optional actor name and emits one named attribute. The reported event-union encoder still validates finite targets, byte/numeric bounds and named fields; no generic serialization was added.
- test/acceptance/auth/hosted-workos-administration.test.ts: The current inherited actor-name behavior adds an own-profile GET for each request. The test counts those exact own-profile reads separately, then still proves no administration read/write occurs for denied access. The shared hosted/fake journey and scope reasons remain valid.

Keep operation arguments off shared mutable services; keep authority, bounded-input and uncertainty comments; keep finite projection/encoding and cohesive route/test owners. This review does not replace metrics or independent runtime/browser evidence.
