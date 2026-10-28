# First production build attempt

Merge commit: 7e9cc19a2f4d82620e745273660e35a8f1a151f3.
Deploy dep-dbh4dbei0phs73cq4agg ended build_failed before traffic switched.
The hosted acceptance group passed 188 of 189 cases. The failure was the final
audit-relay receipt assertion in hosted-tenant-capacity.test.ts.

All five held MCP calls had already returned successful results, and the sixth
call had returned the expected Server busy result. The initial local completion
and relay checks had found one busy event. The final receipt array contained two
busy and four success entries when its raw receipt count reached six.

Source review: AuditRelayRouteSpy records each HTTP attempt before the sender
receives acknowledgement. The production relay retries transient timeout or
transport failure. untilReceived(6) counts attempts, not distinct operation IDs.
The observed result is consistent with a repeated busy delivery reaching that
raw count before the fifth unique success delivery. This does not demonstrate a
second capacity refusal: the operation results were already checked.

The manager approved one unchanged retry of the same merged commit. No source,
test, deadline, assertion, build configuration, or gate was changed or bypassed.
If the failure repeats, investigate the distinct-operation wait/assertion in the
test before another retry. A future correction should retain exactly one busy
and five successful distinct operations, with the early local completion check.

Independent read-only review: prepare_validation. The manager inspected the test
and production composition and confirmed the failed assertion location.
