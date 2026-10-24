# S2-03c bounded audit delivery

This candidate is stacked over S2-03b in PR #243. It implements the S2-03c
specification in the organization admin plan. Implementation and verification
are in progress; this record does not claim delivery or a gate pass.

## Scope

Use the existing activity snapshots and revision-bound handoff to admit audit
events into bounded memory. Before each attempt, read one current saved settings
version and recover its credential through the destination owner. Drop stale or
disabled work without retargeting it. Share one-shot sender limits with saved Test.

Bound retained content, tenant/global admission, attempts, backoff, total age and
shutdown. Keep product responses independent of SQL and Collector availability.
Use no event SQL writes, durable queue, worker service, idle polling, or new
infrastructure. System diagnostics and customer audit events remain separate.

## Verification

Start with failing acceptance specifications for delivery, stale revisions,
overload and shutdown. Implement the required pieces through focused red/green
steps, then run the complete candidate checks and architecture review before
Ready. The final record will state fixed limits, evidence and remaining limits.
