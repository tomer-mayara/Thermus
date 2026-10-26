# PR255 FIFO fixture correction for manager review

This is an uncommitted patch over adf3369a, identified by patch-inputs.json.
Only the integrated runtime test, its dated implementation note and impact
summary change. Production source, Collector, timeouts and ports do not change.

The original PostgreSQL group is retained as red evidence: 25/26, first event
audit.destination.changed rather than organization.changed. The test now
verifies the save event's tenant, action and outcome and completes it accepted.
It then awaits and inspects the separate removal attempt and keeps every prior
removal/receipt/count/single-DELETE assertion. Neither attempt is cleared.

Green working-patch results: focused integrated file 4/4; full PostgreSQL group
26/26; backend build/typecheck pass. Habit has 464 individually reasoned findings
on 54 files and empty snooze. Patch whitespace check passes. The full increment
still has the unchanged reviewed frozen-proposal formatting diagnostics, exit2.

No commit or live group ran. Production metrics/coverage remain N/A. Final
checker is deferred until a clean committed SHA: --allow-dirty checks committed
HEAD alone and cannot certify this working patch. Manager owns commit/pins,
resumed gates, approval mapping and later257restack.
