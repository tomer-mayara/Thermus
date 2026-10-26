# Audit logs

## Audit log destination

Save one destination for your organization's audit logs. Thermus system logs are internal.

### What export includes

Enabled export includes tool inputs and results or errors: search queries, requested URLs, fetched text, and reasons. It also includes administration metadata for supported invitations, membership removal, and destination Save and Test actions.

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
