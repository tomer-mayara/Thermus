# Audit logs

## Audit log destination

Save one destination for your organization's audit logs. Thermus system logs are internal.

### What export includes

Enabled export includes tool inputs and results or errors: search queries, requested URLs, fetched text, and reasons. It also includes administration metadata for supported actions.

Thermus redacts recognized credential fields and credential-bearing URL parameters. Event fields exclude sign-in forms, cookies, Authorization headers, and the destination token. Other free text can still contain secrets.

Input and result exports have size limits. Oversized exported results are truncated, with a marker and original and captured sizes in bytes. Your tool results stay complete.

Delivery is best effort. Logs can be lost during overload, outages, or restart, and retries can create duplicates. Thermus provides no audit history or replay. Disabling export cannot recall events already sent.

Send organization data only if you have authority to do so. Check destination access and retention. Read our [Privacy Policy](https://thermus.ai/privacy/).

Settings have no backup. Lost settings may need to be entered again.

### Destination form help

Connection: HTTPS · OTLP/HTTP JSON

For direct Axiom export, use a Bearer token scoped to this dataset. Dataset names use 1–128 ASCII letters, digits, or hyphens. Leave this field blank otherwise.

Leave Token blank to keep a saved Bearer token only when the endpoint and authentication stay the same. A changed endpoint with Bearer needs a new token. None removes the saved token.

### Test saved destination

Test is optional and sends one synthetic event to the saved destination, even when export is disabled. Save edits before Test. Test does not save settings or enable export. Check your destination for receipt.

Test proves neither continued delivery nor durable storage. Test is not required to enable export.
