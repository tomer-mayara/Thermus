# Component structure refactor: live Brave verification

Date: 2026-10-21. This records structural refactor verification at source
commit `579f6121ce9c3bc87abb748ccb4edc98f854628d`. The run used the production
search composition, with no provider override or changed search behavior.

The [live Brave gate](test-gate-policy.md#live-brave-search-proof-search-06)
ran `npm run test:mcp:search:live` through the pinned environment wrapper
`/tmp/thermus-refactor-evidence/with-test-environment.cjs`. It built the backend
and ran `dist/test/acceptance/mcp/search-pipeline.live.js` with Lightpanda
**1.0.0** and real public Brave access.

## Result

The command passed with exit status **0**. The recorded result time was
**2026-10-21T19:13:17.997Z**. Counts: **1 test, 1 pass, 0 fail, 0 cancelled,
0 skipped, 0 todo**.

For the query `Lightpanda browser`, the tool returned one text item with
19 numbered result links and descriptions. The first URL was
[github.com/lightpanda-io/browser](https://github.com/lightpanda-io/browser).
Its description included this short excerpt:

> A new browser, written in Zig.

The result had no `isError` flag or `structuredContent` field. Both recorded
stages, `search.outgoing.observe_request` and `search.incoming.process_html`,
were allowed. One correlated `mcp.tool.completed` record had status `success`;
its operation ID matched both stages. `rendererErrors` was empty.

## Evidence identity

The full local log is `/tmp/thermus-refactor-evidence/search-live.log`.
The complete result JSON has SHA-256:

```text
86bc7f1d2a4b1eadb3912bde0af409db99e3ac513a1b220c1c435fcecd0d1bd0
```

Hash input: the diagnostic JSON object's `result` field, serialized with
JavaScript `JSON.stringify(result)` and encoded as UTF-8, without a trailing
newline (6,863 bytes). This includes the complete result and metadata. The
record keeps only the short excerpt above rather than copying all result
snippets. It proves this dated live call; it does not guarantee future Brave
availability or unchanged external results.
