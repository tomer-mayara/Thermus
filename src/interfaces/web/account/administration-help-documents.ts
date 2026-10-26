// Preserve the approved help bytes; page rendering changes presentation only.

export const auditHelpDocument = Object.freeze({
  version: 'hosted-audit-help-organization-removal-proposal-2026-10-26-v1',
  sha256: '91c500488861110b50b01aea8cda7ba60cf5a7990e5a398a9124742b77588391',
  text: `# Audit logs

## Audit log destination

Save one destination for your organization's audit logs. Thermus system logs are internal.

### What export includes

Enabled export includes tool inputs and results or errors: search queries, requested URLs, fetched text, and reasons. It also includes administration metadata for supported invitations, membership removal, and destination Save and Test actions. Supported audit events and synthetic Test events can include the actor’s display name when available, alongside stable actor identifiers. Names are trimmed, bounded, and subject to the same pattern-based redaction. Missing or invalid names are omitted.

Thermus redacts recognized credential fields and credential-bearing URL parameters. Event fields exclude sign-in forms, cookies, Authorization headers, and the destination token. Other free text can still contain secrets.

Input and result exports have size limits. Oversized exported results are truncated, with a marker and original and captured sizes in bytes. Your tool results stay complete.

Delivery is best effort. Logs can be lost during overload, outages, or restart, and retries can create duplicates. Thermus provides no audit history or replay. Disabling export cannot recall events already sent.

Send organization data only if you have authority to do so. Check destination access and retention. Read our [Privacy Policy](https://thermus.ai/privacy/).

Settings have no backup. Lost settings may need to be entered again.

### Destination form help

Choose Axiom or Custom and use an HTTPS OTLP/HTTP JSON logs endpoint. Both choices require a Bearer token. For Axiom, enter a dataset name with 1–128 ASCII letters, digits, or hyphens, and use a token scoped to that dataset. For Custom, leave the Axiom dataset empty.

If a Bearer token is saved, leave Token blank to keep it for the same endpoint. A changed endpoint needs a new token. If no token is saved, enter one before Save or Test. The form has no option to remove a token or select unauthenticated delivery. A masked preview can show the first four characters of a saved token longer than four characters; it does not show the full token.

### Save and Test

Save stores the submitted destination, dataset, token, and Enable export switch state. Test first saves those settings, then attempts to send one synthetic event to that saved destination. Test can run with export disabled. Check the switch before Save or Test: either action can enable or disable export by saving its state. Check your destination for receipt.

If Save fails or is not confirmed, no Test is sent. Read saved settings before another change. A pending Save can finish after that read. A Test failure or uncertain result does not roll back settings already saved. A Test event may have reached the destination even when its result cannot be confirmed.

Test proves neither continued delivery nor durable storage. Test is not required to enable export.
`,
});

export const membersRemovalHelpDocument = Object.freeze({
  version: 'hosted-members-help-organization-removal-proposal-2026-10-26-v1',
  sha256: '853d344d0f861fd3a53ed05b846909108d56d39d6105a7fa4fcc626e0d1aa9ca',
  text: `# Members removal help

An Admin can remove a supported ordinary active User or Admin membership from
Members. Open Remove, check the person and workspace, and confirm once. Cancel
returns to Members without starting removal. Removal deletes only that workspace
membership. The account, other workspace memberships, and existing personal
factors remain. Removal does not delete retained records or recall exported data.

Keep another usable active Admin before removing an Admin, including yourself.
A pending invitation does not count. Invite an Admin and wait for them to join.
The service checks current authority, target details, and Admin membership again.
Directory-managed or unknown-management memberships and unsupported grants cannot
use this action. Contact your authorized administrator for those cases.

If removal is confirmed, read current Members or choose another workspace. If
you removed yourself and the session ended, sign in again, then choose another
workspace where you have active access. Existing MCP connections retain their
workspace; reconnect for another eligible workspace. The removed membership has
no access on the next checked portal or MCP request.

If removal is not confirmed, it may have taken effect. Do not submit another
removal. If a removal remains pending, no further removal starts for that
organization. Contact Thermus support at legal@thermus.ai without sending a
password, token, or invitation link. Read current Members to check current
access. Refresh, sign-in, or a changed member list does not confirm the pending
operation or make a retry safe.

To rejoin, obtain and accept a new authorized invitation. An old invitation or
removed membership does not restore old grants. Password-only access remains
supported; removal requires no new factor enrollment or paid feature.

Enabled audit export can include removal metadata: actor, organization, target
membership identifier, action, outcome, and time. It can also include the actor’s
display name when available, alongside stable actor identifiers. Names are
trimmed, bounded, and subject to the same pattern-based redaction. Missing or
invalid names are omitted. It excludes the form token and
membership revision. Delivery is best effort. Export failure does not undo a
confirmed removal, clear a pending operation, or cause removal to be replayed.
Read our [Privacy Policy](https://thermus.ai/privacy/).
`,
});
