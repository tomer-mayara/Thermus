# Public declaration semantic review

Base `7d01d2fb61c1ee0faebd1a1b78819902f832f5f4`; reviewed merge `1e6077ceae7435aed924d5f35051e081980a74de`; final a3aef3f2633145c685feccd136f8638ce08d58d7. Read all9exact committed declaration diffs and the underlying source/callers already reconstructed in V4. This does not fabricate final checker facts or snapshot-verification results.

### src/app/fetch-tool.ts

SystemLog structurally replaces ApplicationLogger; fetchToolServers gains optional supplied toolCompleted capture. App/local/hosted/test composition callers migrate; ordinary tool operation/result contracts remain. Capture now takes final validated public data under trusted context.

### src/index.ts

ServeOptions.logger and serve use SystemLog in place of ApplicationLogger. Existing info/error plain objects still satisfy structural role; composition owns concrete formatter/sink. Production console remains selected; no OTel activation follows.

### src/interfaces/mcp/fetch-tool-schema.ts

Removed exported fieldStatus helper, formerly used for URL/reason diagnostic fields. MCP public input schema and parseFetchToolArguments contract remain; tool clients do not gain/lose URL input fields. Source callers of the removed helper were removed with content diagnostics.

### src/interfaces/web/account/account-form.ts

Exports existing exact-field/CSRF formFields helper so logging forms can reuse it. The callable source surface is added, while existing form validation and request protection remain; sharing within web does not create another C4 component.

### src/logs/audit/audit-log.ts

New named Audit event and synchronous admission contracts. MCP/web use typed completion/action methods. Projection filters fields, bounds/redacts copies and isolates failure; public product results and writes do not await remote export.

### src/logs/audit/audit-send.ts

New caller-supplied destination/auth, typed safe outcomes and tracked start result with outcome versus physical settled promises. Native admission and cancellation-clearing rules are material; fresh export authority is provided by service/collector, not this type alone.

### src/logs/audit/destination-settings-service.ts

New protected settings Read/Save/Test/export-authorization service with required injected sender. Trusted tenant/actor and atomic revisions are caller requirements; disabled saved Test remains separate from Enable. Readback and current-revision export authority are runtime guarantees, not guaranteed by the type alone.

### src/logs/audit/otlp-audit-sender.ts

New concrete one-shot sender exposes send outcome and tracked start settlement. App supplies one instance to saved Test and export; public address/TLS policy, native accounting and no automatic one-shot retry remain with the audit owner.

### src/logs/system/system-logger.ts

New public formatter/record/sink contracts replace the former internal logging inheritance arrangement. Narrow SystemLog info/error role migrates callers; sync sink failures and caller source remain. Console/OTel implementations remain within this owner; SDK export lifecycle is composition-owned.

Strongest changed callable remains tracked send with separate public outcome and physical settlement. Accepted L3 plus four notes answers authority/admission/clearing/lifetime question; no extra L4 is required solely for a generated .d.ts file. Final metadata and source links await the final candidate.
