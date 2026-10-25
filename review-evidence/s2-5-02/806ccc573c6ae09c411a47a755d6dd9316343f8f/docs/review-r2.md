# Review revision 2: manual artifact and SQL review

Manager finding: Terms section 2 retained the no-member-removal statement.
Corrected section 2 to allow checked ordinary active User/Admin removal, cross-link
the section 9 safeguards, keep the absence of a role editor, and keep contact for
out-of-scope requests or uncertain results. Searched all five complete proposed
public documents for stale invitation-only/no-member-removal statements: none.
Remaining matches in README/data-flow review describe prior/current frozen runtime
or the correction; changes.patch retains before-text as comparison evidence.

The first unapproved manifest and check record remain in
manifest-review-r1.json and verification-review-r1.json. No approval existed.
The revised bundle is s2502-organization-removal-proposal-2026-10-25-v1-r2.
Terms version: hosted-terms-organization-removal-proposal-2026-10-25-v1-r2.
Terms UTF-8 bytes: 20941.
Terms SHA-256: c040e1c9d87d86f092b81c5badb7322f35412964e3e61d800efdb5613c9d3501.
Manifest SHA-256: 3ce491e23df377a89a0008c8d7d2920d5270112c13fad89e905f09de93cdc9bb.
Current verification.json passes 36 manual artifact checks and 49 relative links.
Patch replay reproduces all five complete public documents. Previous bundle,
approved agreement, frozen modules and runtime selection remain unchanged.

## Independent restore guard syntax review

Compared runbook SQL with sql/migrations/20261025082850_membership_removal_operations.sql
and src/logs/audit/pg-destination-settings-store.ts. The schema-qualified table,
role, organization_id text, operation_id UUID, and nullable outcome text fields
match. The CHECK permits only applied/no-effect (plus NULL while pending).
REVOKE INSERT, UPDATE and matching GRANT use PostgreSQL table-privilege syntax.
The guard leaves SELECT. has_table_privilege checks effective INSERT/UPDATE,
including inherited/PUBLIC privilege routes; prose also requires review of
ownership, attributes and memberships. The snapshot import must exclude ACLs.
NOLOGIN protects setup but does not close sessions; pg_stat_activity predicates
restrict the inspection/termination to the selected database and dedicated role.
The reviewed PID is safely quoted by psql and cast to integer.
The terminal UPDATE compares exact organization/UUID plus pending state and uses
psql quoted variables; lock/statement timeouts are valid transaction settings.
The owner must verify exactly one intended returned row before COMMIT, otherwise
ROLLBACK. It is not an unattended repair. LOGIN must be restored with DML still
revoked for the root drill to prove the privilege hold itself, then both effective
DML checks must remain false before and after data-only scoped restore.

This review found no SQL syntax/schema defect. It executes no database command
and claims no drill or live proof. Root owns the independent disposable drill.
No build, test, subagent, commit, source switch or cloud action was performed.
