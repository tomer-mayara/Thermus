import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { ProtocolError, type CallToolResult } from '@modelcontextprotocol/client';
import type { HtmlToMarkdownPipeline } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import type { WebsiteFetchResult } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';
import { fetchToolInputSchema } from '../../../src/interfaces/mcp/fetch-tool-schema.ts';
import { searchToolInputSchema } from '../../../src/interfaces/mcp/search-tool-schema.ts';
import { exactMarkdown, openFetchSite, validFetchArguments } from '../../support/in-process/mcp-fetch-site.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { generatedOperationIdPattern } from '../../support/fixtures/execution-context.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { stepRecordsIn } from '../../support/drivers/operator-log.ts';

for (const era of mcpProtocolEras) {
  test(`Given test-injected auth in ${era}, when an MCP HTTP client discovers and calls the fetch tool, then it gets exact Markdown and one completion record with an operation UUID`, async (t) => {
    const site = await openFetchSite(t, era, { headers: { 'X-Subject': 'forged-subject', 'X-Tenant-Id': 'forged-tenant', 'X-Authority': 'forged-authority' } });
    const listed = await site.client.listTools();
    assert.deepEqual(listed.tools.map(({ name }) => name), ['getURLAsMarkdown', 'search']);
    assert.deepEqual(listed.tools[0]?.inputSchema, fetchToolInputSchema);
    assert.deepEqual(listed.tools[1]?.inputSchema, searchToolInputSchema);
    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });
    assertTextResult(result, exactMarkdown);
    assert.equal(site.fetchCalls.length, 1);
    assert.equal(site.fetchCalls[0]?.url, validFetchArguments.url);
    assert.equal(site.pipelineCalls[0]?.page.requestedUrl, validFetchArguments.url);
    assert.equal(site.pipelineCalls[0]?.page.finalUrl, 'https://example.net/final');
    assert.equal(site.fetchCalls[0]?.signal, site.pipelineCalls[0]?.signal);
    assert.equal(site.completionLines().length, 1);
    const entry = JSON.parse(site.completionLines()[0]);
    assert.match(entry.operationId, generatedOperationIdPattern);
    assert.equal(entry.authority, 'https://synthetic-auth.thermus.invalid');
    assert.equal(entry.subject, 'synthetic-user');
    assert.equal(entry.tenantId, 'synthetic-workspace');
    assert.equal(Object.hasOwn(entry, 'reason'), false);
    assert.equal(entry.status, 'success');
    assert.doesNotMatch(site.records.join('\n'), /forged-|private-query|private-fragment|Source|Exact Markdown|arbitrary-test-token/);
  });

  test(`Given a non-completion event fixture in ${era}, when the log receives it before a real call, then only the actual completion resolves the wait`, async (t) => {
    const site = await openFetchSite(t, era);
    let completed = false;
    void site.firstCompletion.then(() => { completed = true; });
    site.record(JSON.stringify({ event: 'pipeline.step.completed', operationId: 'd35803fb-2c25-4273-8967-99eed265721b' }));
    await setImmediate();
    assert.equal(completed, false);

    assertTextResult(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }), exactMarkdown);

    assert.equal(JSON.parse(await site.firstCompletion).event, 'mcp.tool.completed');
    assert.equal(site.completionLines().length, 1);
    assert.equal(stepRecordsIn(site.records.join('\n')).length, 3);
  });

  test(`Given invalid named calls and an unknown tool in ${era}, when dispatched over HTTP, then each gets one safe record and no fetch runs`, async (t) => {
    const site = await openFetchSite(t, era);
    for (const args of [{ url: validFetchArguments.url }, { ...validFetchArguments, reason: '' }, { ...validFetchArguments, reason: ' \n\t' }, { ...validFetchArguments, reason: '😀'.repeat(2_001) }, { ...validFetchArguments, url: 'not-a-url' }, { ...validFetchArguments, url: 'file:///private-page' }, { ...validFetchArguments, url: 'https://private-user:private-pass@example.com' }, { ...validFetchArguments, url: 'https://example.com/' + 'x'.repeat(8_192) }, { ...validFetchArguments, unexpected: 'private-extra' }]) {
      assertTextResult(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: args }), 'Invalid tool arguments', true);
    }
    await assert.rejects(site.client.callTool({ name: 'private-unknown-tool', arguments: validFetchArguments }), (error) => {
      assert.ok(error instanceof ProtocolError);
      assert.equal(error.code, -32602);
      assert.doesNotMatch(error.message, /private-unknown-tool/);
      return true;
    });
    const completions = site.completionLines().map((line) => JSON.parse(line));
    assert.equal(completions.length, 10);
    assert.equal(completions[9].tool, 'unknown');
    for (const entry of completions) assert.match(entry.operationId, generatedOperationIdPattern);
    assert.equal(new Set(completions.map(({ operationId }) => operationId)).size, 10);
    assert.doesNotMatch(site.records.join('\n'), /private-user|private-pass|private-page|private-extra|private-unknown-tool/);
    assert.deepEqual(site.fetchCalls, []);
    assert.deepEqual(site.pipelineCalls, []);
    assert.deepEqual(stepRecordsIn(site.records.join('\n')), []);
  });

  test(`Given valid maximum Unicode URL and reason in ${era}, when called over HTTP, then no accepted input is truncated`, async (t) => {
    const site = await openFetchSite(t, era);
    const prefix = 'https://example.com/';
    const url = prefix + '😀'.repeat(8_192 - prefix.length);
    const reason = '😀'.repeat(2_000);
    assertTextResult(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason } }), exactMarkdown);
    assert.equal(site.fetchCalls[0]?.url, url);
    assert.equal(Object.hasOwn(JSON.parse(site.completionLines()[0]), 'reason'), false);
  });

  for (const failure of ['fetch', 'pipeline', 'oversized', 'absent-markdown', 'nonstring-markdown'] as const) {
    test(`Given ${failure} failure in ${era}, when the HTTP fetch tool runs, then it returns a fixed error and no partial Markdown`, async (t) => {
      const site = await openFetchSite(t, era, {
        fetcher: { fetchURL: async (url) => {
          if (failure === 'fetch') throw new Error('private-fetch-cause');
          return { requestedUrl: url, finalUrl: 'https://example.net/final', html: failure === 'oversized' ? '😀'.repeat(10 * 1024 * 1024 / 4 + 1) : '<p>private-source</p>' };
        } },
        pipeline: { process: async (page: WebsiteFetchResult) => {
          if (failure === 'pipeline') throw new Error('private-pipeline-cause');
          return { ...page, removed: 0, skipped: 0, ...(failure === 'absent-markdown' ? {} : { markdown: 7 }) };
        } } as unknown as Pick<HtmlToMarkdownPipeline, 'process'>,
      });
      const message = failure === 'fetch' ? 'Page fetch failed' : 'Page processing failed';
      assertTextResult(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }), message, true);
      assert.equal(site.fetchCalls.length, 1);
      assert.equal(site.pipelineCalls.length, failure === 'fetch' || failure === 'oversized' ? 0 : 1);
      assert.equal(site.completionLines().length, 1);
      assert.doesNotMatch(site.records.join('\n'), /private-fetch-cause|private-pipeline-cause|private-source/);
    });
  }

  for (const warning of [undefined, 'All content removed', 'Sanitizer withheld content after an internal failure', 'Sanitizer scan limit reached']) {
    test(`Given completed empty output with warning ${warning ?? 'none'} in ${era}, when the HTTP tool returns, then it preserves exact empty success`, async (t) => {
      const site = await openFetchSite(t, era, {
        fetcher: { fetchURL: async (url) => ({ requestedUrl: url, finalUrl: url, html: '' }) },
        pipeline: { process: async (page) => ({ ...page, removed: 0, skipped: 0, markdown: '', warnings: warning === undefined ? [] : [warning] }) },
      });
      assertTextResult(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }), '');
      assert.equal(site.completionLines().length, 1);
      assert.equal(JSON.parse(site.completionLines()[0]).status, 'success');
    });
  }
}

test('Given private client request IDs, metadata, and extra arguments, when calls are dispatched, then operation IDs are fresh UUIDs and copy no client ID text', async (t) => {
  const site = await openFetchSite(t, '2026-07-28');
  for (const extraArgument of [false, true]) {
    const request = mcpRequest({ url: site.url.href, method: 'tools/call', token: 'arbitrary-test-token', params: {
      name: 'getURLAsMarkdown', arguments: { ...validFetchArguments, ...(extraArgument ? { operationId: 'private-argument-id' } : {}) },
    } });
    const body = await request.json() as { id: string | number; params: { _meta: Record<string, unknown> } };
    body.id = 'private-json-rpc-id';
    body.params._meta.operationId = 'private-metadata-id';
    const result = await rpcResult(await fetch(new Request(request, { body: JSON.stringify(body) })));
    assert.deepEqual(result.content, [{ type: 'text', text: extraArgument ? 'Invalid tool arguments' : exactMarkdown }]);
    assert.equal(result.isError === true, extraArgument);
  }
  const records = site.completionLines().map((line) => JSON.parse(line));
  assert.equal(records.length, 2);
  for (const record of records) assert.match(record.operationId, generatedOperationIdPattern);
  assert.notEqual(records[0].operationId, records[1].operationId);
  assert.equal(site.fetchCalls.length, 1);
  assert.doesNotMatch(site.records.join('\n'), /private-json-rpc-id|private-metadata-id|private-argument-id/);
});

function assertTextResult(result: CallToolResult, text: string, isError = false): void {
  assert.deepEqual(result.content, [{ type: 'text', text }]);
  assert.equal(result.isError === true, isError);
  assert.equal(result.structuredContent, undefined);
}
