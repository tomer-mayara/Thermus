# Current search behavior reviewed for proposal v2

Status: source review and manager production readback, 23 October 2026.
This is factual evidence for the proposed legal text, not legal approval.

| Fact | Source evidence |
| --- | --- |
| MCP exposes page fetch and search. Search requires a query and reason. | [Tool server](../../../src/interfaces/mcp/fetch-tool-server.ts), [search schema](../../../src/interfaces/mcp/search-tool-schema.ts). |
| The server validates both fields but passes only the query to search processing. | [Tool server](../../../src/interfaces/mcp/fetch-tool-server.ts), search branch. |
| Hosted composition uses the Brave HTTP engine and Lightpanda renderer. It cleans ads and potential prompt injection, extracts search results, and converts to Markdown. | [Composition](../../../src/app/fetch-tool.ts), [result cleanup](../../../src/pipelines/html-processing/search-results/brave-http-result-cleanup.ts). |
| Query goes to the public Brave Search page in the `q` URL parameter. The renderer can request page dependencies. No separate reason field is passed to the renderer. | [Brave engine](../../../src/pipelines/providers/search-engine/search-engine-brave-http.ts), [renderer](../../../src/pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts). |
| Search returns processed Markdown, a no-results message, a withheld result, or a safe failure. It does not itself fetch each listed result page. | [Search pipeline](../../../src/pipelines/search/search-pipeline.ts), [result projection](../../../src/interfaces/mcp/search.ts). |
| Search completion records contain operation ID, authority, subject, tenant, tool, status, and duration. They omit query, reason, and result content. Fetch completion records can include URL origin/path and full valid reason. | [Completion formatter](../../../src/interfaces/mcp/tool-completion-record.ts). |
| Pipeline-step records contain operation ID, step ID, outcome, fixed code when applicable, and duration. They omit request/result content. | [Step record](../../../src/pipelines/execution/step-record.ts), [outgoing step](../../../src/pipelines/search/execute-outgoing-step.ts), [incoming step](../../../src/pipelines/search/execute-incoming-step.ts). |
| Composition sends those records to the internal system logger. Renderer failures use selected fixed diagnostic fields. The console sink writes to stderr; the system logger does not independently redact arbitrary messages. | [Composition](../../../src/app/fetch-tool.ts), [failure reporting](../../../src/pipelines/providers/website-fetcher/renderer-failure-reports.ts), [diagnostic fields](../../../src/pipelines/providers/website-fetcher/fetch-diagnostic.ts), [console system sink](../../../src/logs/system/console-system-log-sink.ts), [system logger](../../../src/logs/system/system-logger.ts). |

System output is internal engineering output, with no customer access. The
separate metadata-only audit API foundation is unwired. Planned customer audit
capture, redaction, and truncation remain S2-03a; this change adds no customer
stream or export delivery.

The proposed v2 text therefore limits the content-omission statement to the
defined completion and pipeline records. It makes no promise that all provider,
network, operational, or error logs omit search data. Brave receives the query
and network information and applies its own policies. The proposal does not
state a new Brave retention period or assert a separate provider contract.

The factual review also corrects input restrictions, processing permission,
provider disclosure, and the earlier page-only service description. Existing
liability, jurisdiction, fees, other retention periods, and historical acceptance
facts are preserved. Source review alone cannot establish provider settings or
retention configuration; the dated production readbacks below supply that evidence.

The current marketing Privacy Policy at commit
`1c025d8a51707a0b5130cdb72f796f51ef22ec64`, `src/pages/privacy.astro`, adds contact
form facts absent from the frozen hosted bundle. Proposal v2 preserves the exact
contact collection, draft, and two-copy retention paragraphs, and the current
Netlify description, in the complete privacy notice. The manifest records the
source hash. No marketing source or live policy was changed by this review.

## Production readback — 23 October 2026

The manager retained the readback in ignored
`ast-report/invitation-fixes-2026-10-23/production-readback.json`, with observation
time `2026-10-23T19:43:54.308Z`.

| Item | Observed value |
| --- | --- |
| Live production source and deployment | `9de610e8b75dfa041dcf18c5380ccf80feb9f797`; `dep-dbdq0hnavr4c73908k4g`. `/signup` shows “Activation is closed.” |
| WorkOS AuthKit session and tokens | Maximum session `31536000` seconds (365 days); inactivity `172800` seconds (48 hours); access token `300` seconds (5 minutes). These are not MCP Connect token lifetimes. |
| WorkOS invitations | `invitationExpiry: 604800` seconds (7 days). |
| WorkOS sign-in and signup profile | Password enabled; provider MFA `Off`; Google and SSO disabled; `allowSignUp: false`. |
| Render accessible application-log history | Thermus AI workspace shows `HOBBY`. The [logging documentation](https://render.com/docs/logging) states 7 days of accessible application logs. This does not prove physical deletion after 7 days. |
| Render log streams | Observability shows “Default destination: Set default,” with no destination configured. Hobby has no per-service custom override under the [log-stream documentation](https://render.com/docs/log-streams). |
| Application logging path | [Production entry](../../../src/index.ts) composes SystemLogger with ConsoleSystemLogSink (`ConsoleLogger` in the observed revision); this path configures no application OTLP logger. |

These observations establish the listed current settings. They cannot prove
whether a person made an ad hoc log export. Avoiding routine exports or extra
log stores is an operating commitment for owner approval, not another provider
setting or a new release gate. None of these readbacks approves the legal bundle
or opens signup.
