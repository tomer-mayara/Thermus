# S2.5-02 ordinary membership removal runbook

Status: prepared procedure, 25 October 2026. This document grants no production
write, release, legal approval, or recovery authority. The [S2.5-02 record](admin-s2-5-02.md)
tracks actual evidence and holds. Release requires the actual [S2-04 release](admin-s2-04.md),
complete-candidate gates, required human review, and owner approval, publication,
and readback of the exact new [notice and help bundle](../legal/organization-removal-2026-10-25-proposal-v1/README.md).
The current runtime still selects the earlier frozen audit bundle. Preparing this
successor does not change the text shown to a user.

## For an organization Admin

1. Sign in with your existing password and select the intended workspace. Open
   Members. Check the target email and workspace before you open Remove. Only
   ordinary active User/Admin memberships with supported current grants are
   eligible. An absent control does not authorize a provider-side workaround.
2. Open Remove, read the scope, then select Cancel or confirm once. Cancel
   returns to current Members without starting removal. Removal deletes only
   that exact organization membership. It preserves the person's account,
   memberships in other organizations, and existing personal factors. It does
   not delete their retained records or recall exported data.
3. Keep another active, usable Admin before you remove an Admin, including
   yourself. Invite an Admin if needed and wait for acceptance and active Admin
   access. A pending invitation, pending/inactive membership, default role, or
   unknown grant does not count. The service checks current facts again.
4. Read the result. After confirmed removal, read current Members and counts.
   The removed membership has no portal or MCP access on the next checked
   request. Existing MCP tokens keep their organization; browser selection
   does not move them. Reconnect the client for another eligible workspace.
5. After self-removal, use Choose a workspace or check access. If the session
   ended, sign in again and choose another active eligible membership. If none
   remains, the no-access page is expected. A saved session or workspace choice
   does not restore access.
6. To return later, obtain and accept a new authorized invitation. Do not reuse
   an old link or ask an operator to reactivate the deleted membership. Rejoin
   grants only the new invitation's role; it does not recover old grants.

Password-only access remains supported. This action has no factor-enrollment or
paid-feature requirement. Removal does not change an existing member's role.
Directory-managed membership needs its authorized identity-provider process.

## Read the result without replay

| Result | Meaning and next action |
| --- | --- |
| Member removed | Deletion and its durable terminal receipt are confirmed. Read Members or choose another workspace. Export failure cannot undo this result. |
| Keep an Admin | No deletion. Another usable active Admin must join first. A pending invitation does not count. |
| Change refused / Page out of date / Change not available | No deletion by this request. Recheck current access and target facts. Do not bypass the refusal with provider writes. |
| Removal unavailable | No removal was started safely. Storage can be unavailable while authorized product and MCP access still work. Ask the operator to repair the dependency before a new deliberate request. |
| Removal pending | A prior unresolved operation holds this organization. No further removal started. Contact support. |
| Removal not confirmed | The effect is unknown and may have occurred. Do not submit another removal. Contact support and use safe navigation. |

Read current Members to learn current access. Refresh, sign-in, counts, an absent
target, or an unchanged target cannot settle an unknown operation. Do not reload
or resubmit its POST, copy the request, use another process, or retry by email.
The result page supplies no retry form. Contact `legal@thermus.ai` for access or
privacy help without sending passwords, tokens, or invitation links.

## Operator and identity-provider restrictions

The application serializes customer removals per organization in the existing
private SQL store. It does not serialize independent WorkOS dashboard, API,
operator, or identity-provider changes. During a removal or unresolved hold:

- Stop parallel membership deletions and Admin reductions in that organization.
  Do not race a customer removal with a role-catalog edit, bulk role replacement,
  deactivation, reactivation, directory synchronization, or operator script.
  Agree a scoped maintenance window with the authorized provider administrator.
- Never use a global-user delete, factor removal, account reset, membership
  recreation, or broad role replacement to repair a membership removal. Keep
  replacement memberships and later authorized grants unchanged.
- A directory-managed or unknown-management target is unsupported here. Do not
  set a management flag to ordinary or disable an identity provider to pass the
  check. Follow the provider's authorized process separately. Unknown roles and
  extra roles must not be stripped merely to expose Remove.
- Do not clear a hold by deleting its SQL row, setting a lease, changing its age,
  or marking it terminal from a membership read. There is no status endpoint,
  background replay worker, or automatic expiration. Keep the restricted evidence
  and escalate an unresolved effect.

The historical [Super Admin procedure](hosted-organization-setup.md#historical-super-admin-procedure)
uses a different operation. Its read-after-write guidance cannot settle a
customer removal. Audit delivery and operator log records are best effort; a
missing event proves neither no send nor no effect.

## Contain an unknown operation

1. Name the environment, organization, exact membership and operation IDs, actor,
   start time, revision, observed outcome, and affected instances. Preserve the
   exact operation row and safe provider request/response references in restricted
   incident evidence. Do not put credentials or full personal records in a PR.
2. Stop every old write-capable application process and operator job that can
   send membership reductions. Confirm each process exited; normal rolling
   replacement overlap is insufficient. Application close prevents later local
   steps, but cannot cancel or undo a provider request already sent. A client
   timeout, process exit, network block, or key rotation alone does not prove
   that a remote request had no effect.
3. Hold independent WorkOS/operator/IdP reductions for the affected organization.
   If needed, revoke the old deployment's provider API credential through the
   authorized secure process and keep a separately scoped investigation reader.
   This contains new sends; it does not cancel a request the provider accepted.
4. Keep the SQL pending row. Obtain independent evidence for this exact operation
   and exact membership ID: a confirmed deletion receipt, a proved no-send phase,
   or authoritative provider evidence that the sent request can no longer act.
   A current list or 404 alone is insufficient; another writer or a late request
   can explain that state. A new membership for the same person is a different
   target and must survive.
5. Only after the evidence proves applied or no-effect may the authorized owner
   record that terminal result for the same organization and operation ID.
   Compare-and-set the exact ID and pending state in one bounded transaction;
   require one affected row and retain the before/after evidence. Stop on a
   mismatch. After the owner sets protected session variables to the independently
   proved organization ID, operation UUID, and `applied` or `no-effect` outcome,
   the exact pending-row update is:

   ```sql
   BEGIN;
   SET LOCAL lock_timeout = '5s';
   SET LOCAL statement_timeout = '30s';
   UPDATE thermus_admin.membership_removal_operations
     SET outcome = :'proven_outcome'
     WHERE organization_id = :'organization_id'
       AND operation_id = :'operation_id'::uuid AND outcome IS NULL
     RETURNING organization_id, operation_id, outcome;
   ```

   Check that exactly one intended row returned before `COMMIT`; otherwise use
   `ROLLBACK` and stop. Never run this interactive decision unattended or infer
   `proven_outcome` from a read. If the proof is unavailable, keep the hold and
   escalate; do not retry.

## Hold reductions outside restored rows

A snapshot can predate an intent that later sent a deletion. Restoring that
snapshot can erase the only hold. Before any restore that can replace, omit, or
roll back `membership_removal_operations`, establish an independent SQL privilege
hold. The hold belongs to the live role/table access configuration, not a row in
the restored data. It needs no application flag or new store.

These are owner-session examples for the already selected database, not release
commands. Use a protected connection alias and `psql -X -v ON_ERROR_STOP=1`.
Confirm actual ownership, role attributes/memberships, API grants, and schema
before any write. Do not use the application's credential for recovery.

1. Stop old senders as above. In the administrative owner session, prevent new
   dedicated-runtime logins, then remove both admission and completion rights:

   ```sql
   ALTER ROLE thermus_logging NOLOGIN;
   REVOKE INSERT, UPDATE ON TABLE thermus_admin.membership_removal_operations
     FROM thermus_logging;
   SELECT has_table_privilege('thermus_logging',
     'thermus_admin.membership_removal_operations', 'INSERT') AS can_insert,
     has_table_privilege('thermus_logging',
     'thermus_admin.membership_removal_operations', 'UPDATE') AS can_update;
   ```

   Both values must be false. A direct REVOKE is insufficient if ownership,
   elevated attributes, inherited roles, PUBLIC, or other grants still permit
   writes. Stop and resolve that reviewed scope before restore. Retain SELECT
   for inspection. Do not revoke or change unrelated table privileges.
2. Inventory sessions of this exact dedicated role in this database, including
   pooler sessions. Terminate only those verified sessions if they remain.
   NOLOGIN does not close existing sessions. Inspect only the selected role and
   database, then terminate each separately reviewed PID through the owner:

   ```sql
   SELECT pid, application_name, backend_start, state
     FROM pg_stat_activity
     WHERE datname = current_database() AND usename = 'thermus_logging';
   SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE pid = :'reviewed_pid'::integer
       AND datname = current_database() AND usename = 'thermus_logging';
   ```

   Recheck that no old dedicated-role session remains. Record process/session containment
   and the effective privilege check outside the backup and restored rows.
3. Restore offline into a disposable isolated database first. Verify the object
   list and scope. For live transfer, use reviewed data-only, explicit-column,
   tenant-scoped replacement. Do not replay schema/ACL/role SQL from an old dump;
   it could silently restore admission rights. Do not use a shared-project,
   shared-schema, or `--clean` restore. Preserve the live hold and unrelated data.
4. Recheck both effective privileges after restore and before any restart.
   Exercise a controlled removal attempt with the contained fresh runtime: SQL
   admission must fail before provider deletion. If a connection is needed for
   that check, enable LOGIN only after all old processes/sessions are gone and
   keep INSERT/UPDATE revoked. Authorized product/MCP requests can continue when
   only these removal-table privileges are held; a full maintenance stop is also
   permitted. Do not infer this check from an absent operation row.
5. Reconcile the missing time window with independent evidence. Include every
   possible send after the snapshot, pending/terminal receipts, exact target IDs,
   replacement memberships, and later grants. Keep the privilege hold if any
   effect remains unresolved. A restored empty table is not a clean ledger.
6. Before release of the hold, the owner approves the reconciled scope and all
   uncertain operations have safe retained pending records or proved terminal
   outcomes. Recheck effective privileges, RLS, schema, and unrelated inventory.
   Restore only the reviewed migration grants, using the owner session:

   ```sql
   GRANT INSERT, UPDATE ON TABLE thermus_admin.membership_removal_operations
     TO thermus_logging;
   ```

   Restore LOGIN only if this runtime should run, and start fresh instances.
   The global privilege hold must remain if the ledger cannot safely represent
   all unresolved operations. A retained pending row continues to block its
   organization. Do not admit a new deletion until these checks pass.

A data restore cannot undo a WorkOS effect. No restore step recreates a deleted
membership or removes a replacement membership/later grant. The [Slice 4 settings
procedure](admin-s4-recovery.md) remains future work. This containment procedure and
a disposable drill add no production backup, backup cadence, or recovery-service
promise to Slice 2.5.

## Evidence and release boundary

Keep controlled SQL commit/admission fault, restart/overlap/deadline, late-answer,
export/safe-sink, and snapshot-window drill evidence separate from scoped live
provider evidence. Record the source and migration SHAs, exact scope, environment,
UTC times, sender shutdown, privileges before/after, intended and affected counts,
independent reconciliation references, and unresolved limits. Synthetic factors
show adapter scope only. Live existing-factor observation is permitted only when
already available in confirmed free scope; no enrollment or new entitlement is
required. Live account and other-membership preservation still need proof.

The manager selects gates and records the complete candidate. This runbook is
not evidence that a procedure ran. Do not mark S2.5-02 complete until actual
provider/store/UI, controlled uncertainty, restore hold, $0/capacity, exact notice
publication/presentation, and all earlier release prerequisites are satisfied.
