import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProtocolError, type CallToolResult } from '@modelcontextprotocol/client';
import type { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import type { WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';
import { fetchToolInputSchema } from '../../../src/mcp/fetch-tool-schema.ts';
import { exactMarkdown, fetchProtocolEras, openFetchSite, validFetchArguments } from '../../support/mcp-fetch-site.ts';

for (const era of fetchProtocolEras) {
  test(`Given test-injected auth in ${era}, when an MCP HTTP client discovers and calls the fetch tool, then it gets exact Markdown and one completion record`, async (t) => {
    const site = await openFetchSite(t, era, { headers: { 'X-Subject': 'forged-subject', 'X-Tenant-Id': 'forged-tenant', 'X-Authority': 'forged-authority' } });
    const listed = await site.client.listTools();
    assert.deepEqual(listed.tools.map(({ name }) => name), ['getURLAsMarkdown']);
    assert.deepEqual(listed.tools[0]?.inputSchema, fetchToolInputSchema);
    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });
    assertTextResult(result, exactMarkdown);
    assert.equal(site.fetchCalls.length, 1);
    assert.equal(site.fetchCalls[0]?.url, validFetchArguments.url);
    assert.equal(site.pipelineCalls[0]?.page.requestedUrl, validFetchArguments.url);
    assert.equal(site.pipelineCalls[0]?.page.finalUrl, 'https://example.net/final');
    assert.equal(site.fetchCalls[0]?.signal, site.pipelineCalls[0]?.signal);
    assert.equal(site.records.length, 1);
    const entry = JSON.parse(site.records[0]);
    assert.equal(entry.authority, 'https://synthetic-auth.thermus.invalid');
    assert.equal(entry.subject, 'synthetic-user');
    assert.equal(entry.tenantId, 'synthetic-workspace');
    assert.equal(entry.reason, validFetchArguments.reason);
    assert.equal(entry.status, 'success');
    assert.doesNotMatch(site.records[0], /forged-|private-query|private-fragment|Source|Exact Markdown|arbitrary-test-token/);
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
    assert.equal(site.records.length, 10);
    assert.equal(JSON.parse(site.records[9]).tool, 'unknown');
    assert.doesNotMatch(site.records.join('\n'), /private-user|private-pass|private-page|private-extra|private-unknown-tool/);
    assert.deepEqual(site.fetchCalls, []);
    assert.deepEqual(site.pipelineCalls, []);
  });

  test(`Given valid maximum Unicode URL and reason in ${era}, when called over HTTP, then no accepted input is truncated`, async (t) => {
    const site = await openFetchSite(t, era);
    const prefix = 'https://example.com/';
    const url = prefix + '😀'.repeat(8_192 - prefix.length);
    const reason = '😀'.repeat(2_000);
    assertTextResult(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason } }), exactMarkdown);
    assert.equal(site.fetchCalls[0]?.url, url);
    assert.equal(JSON.parse(site.records[0]).reason, reason);
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
      assert.equal(site.records.length, 1);
      assert.doesNotMatch(site.records[0], /private-fetch-cause|private-pipeline-cause|private-source/);
    });
  }

  for (const warning of [undefined, 'All content removed', 'Sanitizer withheld content after an internal failure', 'Sanitizer scan limit reached']) {
    test(`Given completed empty output with warning ${warning ?? 'none'} in ${era}, when the HTTP tool returns, then it preserves exact empty success`, async (t) => {
      const site = await openFetchSite(t, era, {
        fetcher: { fetchURL: async (url) => ({ requestedUrl: url, finalUrl: url, html: '' }) },
        pipeline: { process: async (page) => ({ ...page, removed: 0, skipped: 0, markdown: '', warnings: warning === undefined ? [] : [warning] }) },
      });
      assertTextResult(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }), '');
      assert.equal(site.records.length, 1);
      assert.equal(JSON.parse(site.records[0]).status, 'success');
    });
  }
}

function assertTextResult(result: CallToolResult, text: string, isError = false): void {
  assert.deepEqual(result.content, [{ type: 'text', text }]);
  assert.equal(result.isError === true, isError);
  assert.equal(result.structuredContent, undefined);
}
