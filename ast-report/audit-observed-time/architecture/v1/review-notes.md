# Architecture comparison review

Base: `581f30cfaa32b01399422b087b0f0bdc3b800f70` (main).
Candidate: `8a13ba7b3f6b49c6f02377fd51f12fc18b8dc2ae`.

The supplementary L3 comparison comes from the registry and code at both revisions. It covers the Audit-logs component in the Thermus Node server and the existing MCP, web, and external destination neighbors. All 13 Mermaid blocks in the production registry are byte-identical. Registry prose now records the two timestamp fields. The diagram marks the changed Audit output in amber and retains existing runtime calls in neutral colors. It adds no component or relationship.

Before, the encoder sent the captured event time only in `timeUnixNano`; receivers could show the absent observation time as epoch zero. After, one validated decimal-string nanosecond value populates both fields. MCP and administration capture after the action outcome; the synthetic Test captures when it creates the event. Queue delay and retries preserve the event, and the encoder does not read a clock. Invalid timestamps still fail before network I/O with the same typed failure. The extra field is counted in the existing bounded request size.

The diagram omits unchanged app composition, snapshot/settings authorization, PostgreSQL, bounded dispatch, and System diagnostics. The Audit component still owns these existing export responsibilities. MCP and web still supply trusted event context; neither the identity nor destination routing changes. No Level 2 container, deployment, or external integration endpoint changes.

L4 omitted: no TypeScript callable signature changes. The strongest changed contract is the outbound OTLP record. The review question is whether observation time represents capture instead of transport time, with correct units and retry lifetime. L3 plus these behavior notes and the wire regression tests answer it without an internal function diagram. No ADR is needed for this existing field-population repair.

Renderer: Mermaid 12.2.0 with Playwright Chromium, strict mode and the neutral theme. It parsed and rendered comparison.mmd. The root manager inspected comparison-800.png at 800 px: readable title/labels, neutral label backgrounds, correct arrow targets, no overlapping boundaries or unrelated crossings. Source and SVG are retained. The final PR body must use the same Mermaid source byte-for-byte.

Evidence: src/logs/audit/otlp-audit-encoding.ts; src/logs/audit/audit-event-projection.ts; src/logs/audit/audit-collector.ts; src/logs/audit/otlp-audit-sender.ts; src/interfaces/mcp/fetch-tool-server.ts; src/interfaces/web/account/administration-routes.ts; src/interfaces/web/account/logging-routes.ts; src/logs/audit/destination-settings-service.ts; the three changed tests. Paths and statements checked at both pinned revisions.

Final candidate d292e549b724b506758696cdcb2d2960de874578 adds only docs/metrics/2026-10-25-581f30cf.json. The root manager rechecked the diff: all source, tests, contract prose, impact declaration, and diagram bytes match reviewed 8a13ba7b. No rerender is needed. The pinned comparison remains valid against main 581f30cf.
