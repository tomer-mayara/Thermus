# S2.5-R1 — Membership safety facts

Status: repair started; no passing implementation claim yet. This increment is
stacked on S2.5-02 at `0530dd634fe8302b55d4a0669463ef733199cc40`.

The removal safety scan currently uses display pages. Their WorkOS adapter reads
every member's email, which the safety decision does not use. The confirmed
100-member case with simulated 300 ms user lookups reaches the 30-second limit
before deletion and leaves a pending operation. The
[repair ticket](../design/organization-admin-plan.md#s25-r1--read-safety-facts-without-display-hydration)
requires acceptance-first development and focused TDD.

Add one membership-facts page to the existing directory boundary. Preserve the
direct target read, display pages, full grants and management evidence, revisions,
complete pagination, current Admin checks, last-Admin safety, lifetime, durable
admission and exact receipts. No new cache, timeout, retry, state store, provider
setting, schema or release is planned.

Record actual red/green steps and final verification here before review. The
[S2.5-02 ledger](admin-s2-5-02.md) still owns separate release and owner gates.
