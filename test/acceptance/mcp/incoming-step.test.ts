import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { stepRecordsIn } from '../../support/drivers/operator-log.ts';
import { openFetchSite, validFetchArguments } from '../../support/in-process/mcp-fetch-site.ts';

for (const era of mcpProtocolEras) {
  for (const code of [undefined, 'scan_failed', 'scan_limit'] as const) {
    test(`Given ${code ?? 'ordinary empty content'} in ${era}, when incoming processing finishes, then exact empty success has a joined ${code ? 'blocked' : 'allowed'} incoming record`, async (t) => {
      const site = await openFetchSite(t, era, {
        pipeline: { process: async (page) => ({ ...page, removed: 0, skipped: 0, markdown: '', scanWithholding: code,
          warnings: ['private-warning wording is independent'] }) },
      });

      const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

      assert.deepEqual(result.content, [{ type: 'text', text: '' }]);
      assert.equal(result.isError, undefined);
      assert.equal(result.structuredContent, undefined);
      const completions = site.completionLines().map((line) => JSON.parse(line));
      assert.equal(completions.length, 1);
      assert.equal(completions[0].status, 'success');
      const steps = stepRecordsIn(site.records.join('\n'));
      assert.equal(steps.length, 2);
      assert.deepEqual(steps, stepRecordsIn(site.records.join('\n'), completions[0].operationId));
      assert.deepEqual(steps.map(({ durationMs, ...record }) => {
        assert.ok(Number.isSafeInteger(durationMs) && (durationMs as number) >= 0);
        return record;
      }), [
        { event: 'pipeline.step.completed', operationId: completions[0].operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' },
        { event: 'pipeline.step.completed', operationId: completions[0].operationId, stepId: 'incoming.process_html',
          outcome: code ? 'blocked' : 'allowed', ...(code ? { code } : {}) },
      ]);
      assert.equal(site.pipelineCalls.length, 1);
      assert.doesNotMatch(JSON.stringify(steps), /private-|example|arbitrary-test-token/);
    });
  }
}

for (const era of mcpProtocolEras) {
  for (const [name, value] of [
    ['generic block', { decision: 'block', code: 'blocked' }],
    ['unknown code', { decision: 'block', code: 'private-code' }],
    ['unknown decision', { decision: 'private-decision' }],
    ['nonstring output', { decision: 'allow', output: 42 }],
    ['missing output', { decision: 'allow' }],
    ['block with payload', { decision: 'block', code: 'scan_failed', output: 'private-payload' }],
    ['allow with code', { decision: 'allow', output: 'private-payload', code: undefined }],
  ]) {
    test(`Given incoming ${name} in ${era}, when the result is checked, then a fixed processing error and joined safe records replace every payload`, async (t) => {
      const execute = t.mock.fn(async () => value as never);
      const site = await openFetchSite(t, era, { incoming: { execute } });

      const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

      assert.deepEqual(result.content, [{ type: 'text', text: 'Page processing failed' }]);
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent, undefined);
      assert.equal(execute.mock.callCount(), 1);
      assert.equal(site.fetchCalls.length, 1);
      assert.equal(site.pipelineCalls.length, 0);
      assertIncomingRecords(site, 'processing_failed', name === 'generic block'
        ? { outcome: 'blocked', code: 'blocked' } : { outcome: 'failed', code: 'invalid_step_result' });
    });
  }

  for (const cancelled of [false, true]) {
    test(`Given an incoming ${cancelled ? 'collaborator AbortError' : 'exception'} in ${era}, when it settles, then the outgoing record stays allowed and one safe incoming failure follows`, async (t) => {
      const site = await openFetchSite(t, era, { incoming: { execute: async () => {
        if (cancelled) throw new DOMException('private-abort-cause', 'AbortError');
        throw new Error('private-step-cause Bearer private-token');
      } } });

      const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

      assert.deepEqual(result.content, [{ type: 'text', text: cancelled ? 'Request cancelled' : 'Page processing failed' }]);
      assert.equal(result.isError, true);
      assertIncomingRecords(site, cancelled ? 'cancelled' : 'processing_failed', cancelled
        ? { outcome: 'cancelled', code: 'cancelled' } : { outcome: 'failed', code: 'step_failed' });
    });
  }

  test(`Given oversized fetched HTML in ${era}, when the incoming step enters, then the failed record and fixed processing error occur with zero pipeline work`, async (t) => {
    const site = await openFetchSite(t, era, { fetcher: { fetchURL: async (url) => ({ requestedUrl: url, finalUrl: url,
      html: 'x'.repeat(10 * 1024 * 1024 + 1) }) } });

    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

    assert.deepEqual(result.content, [{ type: 'text', text: 'Page processing failed' }]);
    assert.equal(result.isError, true);
    assert.equal(site.fetchCalls.length, 1);
    assert.equal(site.pipelineCalls.length, 0);
    assertIncomingRecords(site, 'processing_failed', { outcome: 'failed', code: 'step_failed' });
  });

  test(`Given unknown typed scan data and valid partial Markdown in ${era}, when the real incoming adapter checks it, then the fixed error replaces the payload`, async (t) => {
    const site = await openFetchSite(t, era, { pipeline: { process: async (page) => ({ ...page, removed: 0, skipped: 0,
      markdown: 'private-partial-payload', scanWithholding: 'private-scan-code' as never }) } });

    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

    assert.deepEqual(result.content, [{ type: 'text', text: 'Page processing failed' }]);
    assert.equal(result.isError, true);
    assert.equal(site.pipelineCalls.length, 1);
    assertIncomingRecords(site, 'processing_failed', { outcome: 'failed', code: 'step_failed' });
  });

  for (const outcome of ['allow', 'block', 'throw'] as const) {
    test(`Given incoming ${outcome} with a broken sink in ${era}, when it finishes, then each entered step gets one write attempt and one MCP completion keeps the decision`, async (t) => {
      const execute = t.mock.fn(async () => {
        if (outcome === 'throw') throw new Error('private-step-error');
        return outcome === 'allow' ? { decision: 'allow' as const, output: 'Exact Markdown' }
          : { decision: 'block' as const, code: 'scan_failed' as const };
      });
      const record = t.mock.fn(() => { throw new Error('private-sink-error'); });
      const site = await openFetchSite(t, era, { incoming: { execute }, stepSink: { record } });

      const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

      assert.deepEqual(result.content, [{ type: 'text', text: outcome === 'throw' ? 'Page processing failed' : outcome === 'allow' ? 'Exact Markdown' : '' }]);
      assert.equal(result.isError === true, outcome === 'throw');
      assert.equal(execute.mock.callCount(), 1);
      assert.equal(record.mock.callCount(), 2);
      assert.equal(site.fetchCalls.length, 1);
      assert.equal(site.pipelineCalls.length, 0);
      assert.equal(site.completionLines().length, 1);
      assert.equal(JSON.parse(site.completionLines()[0]).status, outcome === 'throw' ? 'processing_failed' : 'success');
      assert.deepEqual(stepRecordsIn(site.records.join('\n')), []);
      assert.doesNotMatch(site.records.join('\n'), /private-step-error|private-sink-error/);
    });
  }
}

function assertIncomingRecords(site: Awaited<ReturnType<typeof openFetchSite>>, status: string, expected: { outcome: string; code?: string }): void {
  const completions = site.completionLines().map((line) => JSON.parse(line));
  assert.equal(completions.length, 1);
  assert.equal(completions[0].status, status);
  const steps = stepRecordsIn(site.records.join('\n'));
  assert.equal(steps.length, 2);
  assert.deepEqual(steps, stepRecordsIn(site.records.join('\n'), completions[0].operationId));
  assert.deepEqual(steps.map(({ durationMs, ...record }) => {
    assert.ok(Number.isSafeInteger(durationMs) && (durationMs as number) >= 0);
    return record;
  }), [
    { event: 'pipeline.step.completed', operationId: completions[0].operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' },
    { event: 'pipeline.step.completed', operationId: completions[0].operationId, stepId: 'incoming.process_html', ...expected },
  ]);
  assert.doesNotMatch(JSON.stringify(steps), /private-|Source|example|Bearer|arbitrary-test-token/);
}
