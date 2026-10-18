import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StepResult } from '../../../src/page-fetch/pipeline-step.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { stepRecordsIn } from '../../support/drivers/operator-log.ts';
import { exactMarkdown, openFetchSite, validFetchArguments } from '../../support/in-process/mcp-fetch-site.ts';

type FetchSite = Awaited<ReturnType<typeof openFetchSite>>;

function assertStep(site: FetchSite, expected: { outcome: string; code?: string }): Record<string, unknown> {
  const completions = site.completionLines().map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(completions.length, 1);
  const steps = stepRecordsIn(site.records.join('\n'));
  assert.equal(steps.length, site.pipelineCalls.length === 0 ? 1 : 2);
  assert.deepEqual(stepRecordsIn(site.records.join('\n'), completions[0].operationId as string), steps);
  const { durationMs, ...record } = steps[0];
  assert.ok(Number.isSafeInteger(durationMs) && (durationMs as number) >= 0);
  assert.deepEqual(record, { event: 'pipeline.step.completed', operationId: completions[0].operationId,
    stepId: 'outgoing.observe_request', ...expected });
  if (steps.length === 2) {
    const { durationMs: incomingDuration, ...incoming } = steps[1];
    assert.ok(Number.isSafeInteger(incomingDuration) && (incomingDuration as number) >= 0);
    assert.deepEqual(incoming, { event: 'pipeline.step.completed', operationId: completions[0].operationId,
      stepId: 'incoming.process_html', outcome: 'allowed' });
  }
  return completions[0];
}

for (const era of mcpProtocolEras) {
  test(`Given private request and page data in ${era}, when observation allows the exact URL, then one fixed outgoing record joins the completion and contains none of that data`, async (t) => {
    const url = 'HTTPS://Example.COM/private-path?private-query#private-fragment';
    const reason = 'private-reason';
    const site = await openFetchSite(t, era, {
      fetcher: { fetchURL: async (input) => ({ requestedUrl: input, finalUrl: input, html: '<p>private-html</p>' }) },
      pipeline: { process: async (page) => ({ ...page, removed: 0, skipped: 0, markdown: 'private-markdown' }) },
    });

    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason } });

    assert.deepEqual(result.content, [{ type: 'text', text: 'private-markdown' }]);
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent, undefined);
    assert.equal(site.fetchCalls.length, 1);
    assert.equal(site.fetchCalls[0].url, url);
    assert.equal(site.pipelineCalls.length, 1);
    assert.equal(assertStep(site, { outcome: 'allowed' }).status, 'success');
    assert.doesNotMatch(JSON.stringify(stepRecordsIn(site.records.join('\n'))), /private-|Example|arbitrary-test-token/);
  });

  for (const [name, value] of [
    ['block', { decision: 'block', code: 'blocked' }],
    ['scan failure code', { decision: 'block', code: 'scan_failed' }],
    ['scan limit code', { decision: 'block', code: 'scan_limit' }],
    ['unknown code', { decision: 'block', code: 'private-code' }],
    ['step-up decision', { decision: 'step_up' }],
    ['missing output', { decision: 'allow' }],
    ['changed URL', { decision: 'allow', output: 'https://private-exfiltration.example/' }],
    ['nonstring output', { decision: 'allow', output: 42 }],
    ['block with payload', { decision: 'block', code: 'blocked', output: 'private-payload' }],
  ]) {
    test(`Given an outgoing ${name} in ${era}, when the MCP call runs, then it returns the fixed fetch error without fetch or processing and records the exact terminal outcome`, async (t) => {
      const site = await openFetchSite(t, era, { outgoing: { id: 'outgoing.observe_request', execute: async () => value as StepResult<string> } });

      const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

      assert.deepEqual(result.content, [{ type: 'text', text: 'Page fetch failed' }]);
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent, undefined);
      assert.deepEqual(site.fetchCalls, []);
      assert.deepEqual(site.pipelineCalls, []);
      assert.equal(assertStep(site, name === 'block' ? { outcome: 'blocked', code: 'blocked' } : { outcome: 'failed', code: 'invalid_step_result' }).status, 'fetch_failed');
      assert.doesNotMatch(site.records.join('\n'), /private-exfiltration|private-payload|private-code/);
    });
  }

  for (const cancelled of [false, true]) {
    test(`Given an outgoing ${cancelled ? 'AbortError before signal abort' : 'exception'} in ${era}, when handled, then only the fixed error and one safe step record escape`, async (t) => {
      const site = await openFetchSite(t, era, { outgoing: { id: 'outgoing.observe_request', execute: async () => {
        if (cancelled) throw new DOMException('private-abort-cause', 'AbortError');
        throw new Error('private-step-error Bearer private-token');
      } } });

      const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

      assert.deepEqual(result.content, [{ type: 'text', text: cancelled ? 'Request cancelled' : 'Page fetch failed' }]);
      assert.equal(result.isError, true);
      assert.deepEqual(site.fetchCalls, []);
      assert.deepEqual(site.pipelineCalls, []);
      assert.equal(assertStep(site, cancelled ? { outcome: 'cancelled', code: 'cancelled' } : { outcome: 'failed', code: 'step_failed' }).status, cancelled ? 'cancelled' : 'fetch_failed');
      assert.doesNotMatch(site.records.join('\n'), /private-step-error|private-token|private-abort-cause/);
    });
  }

  for (const blocked of [false, true]) {
    test(`Given a broken step sink and ${blocked ? 'block' : 'allow'} in ${era}, when the MCP call finishes, then the decision and completion hold with one write attempt and no repeated work`, async (t) => {
      const execute = t.mock.fn(async (input: string): Promise<StepResult<string>> => blocked ? { decision: 'block', code: 'blocked' } : { decision: 'allow', output: input });
      const record = t.mock.fn(() => { throw new Error('private-sink-error'); });
      const site = await openFetchSite(t, era, { outgoing: { id: 'outgoing.observe_request', execute }, stepSink: { record } });

      const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

      assert.deepEqual(result.content, [{ type: 'text', text: blocked ? 'Page fetch failed' : exactMarkdown }]);
      assert.equal(result.isError === true, blocked);
      assert.equal(execute.mock.callCount(), 1);
      assert.equal(record.mock.callCount(), blocked ? 1 : 2);
      assert.equal(site.fetchCalls.length, blocked ? 0 : 1);
      assert.equal(site.pipelineCalls.length, blocked ? 0 : 1);
      assert.equal(site.completionLines().length, 1);
      assert.equal(JSON.parse(site.completionLines()[0]).status, blocked ? 'fetch_failed' : 'success');
      assert.deepEqual(stepRecordsIn(site.records.join('\n')), []);
      assert.doesNotMatch(site.records.join('\n'), /private-sink-error/);
    });
  }
}
