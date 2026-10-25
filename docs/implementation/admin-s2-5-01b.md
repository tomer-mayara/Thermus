# S2.5-01b implementation record

Date: 25 October 2026. Status: implementation in progress.

This ticket adds one owner for membership removal. It builds on
[S2.5-01a](https://github.com/tomer-mayara/Thermus/pull/251) and follows the
[approved ticket](../design/organization-admin-plan.md#s25-01b--one-removal-owner-with-durable-per-org-serialization).
The pull request targets the S2.5-01a branch. It adds no browser removal route
or UI, role change, MFA policy, new provider, or production database change.

## Required behavior

Authorize the actor before durable admission. Admit at most one unresolved
removal per organization through the existing private SQL store. Recheck current
authority, target facts, revision, and the full active Admin count after admission.
Release SQL clients before calling the provider. Bound admission and all remaining
work; a competing request returns busy rather than waiting for the first removal.

Keep uncertain effects held across restart. Settle only the same organization
and operation ID with proof of a terminal result. Never replay an uncertain
deletion or clear a hold because time passed. A late continuation that cannot
send must stop before dispatch. Recording failures cannot change the removal
result or release its hold. S2.5-01c adds the checked browser action; S2.5-02
retains live deletion, restore controls, and release proof.

## Verification sequence

Acceptance specifications will be written and observed red before source changes.
Focused unit and integration tests will then drive each step to green. Real
disposable PostgreSQL will prove contention across connections, durable intent
before dispatch, restart, and conditional completion. The final record will name
the observed failures, fixes, bounds, checks, and evidence limits.
