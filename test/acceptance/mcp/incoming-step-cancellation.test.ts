import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { ProcessHtmlStep } from '../../../src/pipelines/html-processing/process-html-step.ts';
import type { StepResult } from '../../../src/pipelines/execution/pipeline-step.ts';
import type { WebsiteFetchResult } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { stepRecordsIn } from '../../support/drivers/operator-log.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { openHostedFetchSite } from '../../support/in-process/hosted-fetch-site.ts';
import { openFetchSite, validFetchArguments } from '../../support/in-process/mcp-fetch-site.ts';

for (const era of mcpProtocolEras) {
  for (const outcome of ['allow', 'block', 'throw'] as const) {
    test(`Given incoming work with late ${outcome} in ${era}, when the client cancels before cleanup, then the earlier outgoing record stays allowed and incoming records cancellation only after settlement`, { timeout: 5_000 }, async (t) => {
      const started = Promise.withResolvers<AbortSignal>();
      const observedAbort = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      t.after(() => release.resolve());
      const controller = new AbortController();
      const site = await openFetchSite(t, era, {
        httpSignal: era === '2025-11-25' ? controller.signal : undefined,
        incoming: { execute: async (_page, signal): Promise<StepResult<string>> => {
          const onAbort = () => observedAbort.resolve();
          signal.addEventListener('abort', onAbort, { once: true });
          started.resolve(signal);
          try {
            await release.promise;
            if (outcome === 'throw') throw new Error('private-late-error');
            return outcome === 'block' ? { decision: 'block', code: 'scan_limit' } : { decision: 'allow', output: 'private-late-markdown' };
          } finally {
            signal.removeEventListener('abort', onAbort);
          }
        } },
      });
      const pending = site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }, { signal: controller.signal });
      const rejected = assert.rejects(pending);
      const signal = await started.promise;
      const earlier = structuredClone(stepRecordsIn(site.records.join('\n')));
      assert.equal(earlier.length, 1);
      assert.equal(earlier[0].outcome, 'allowed');

      controller.abort(new Error('private-client-cancellation'));
      await rejected;
      await observedAbort.promise;
      assert.equal(signal.aborted, true);
      assert.deepEqual(stepRecordsIn(site.records.join('\n')), earlier);
      assert.equal(site.completionLines().length, 0);
      release.resolve();
      const completion = JSON.parse(await site.firstCompletion);

      assert.equal(completion.status, 'cancelled');
      assert.equal(site.completionLines().length, 1);
      const steps = stepRecordsIn(site.records.join('\n'));
      assert.equal(steps.length, 2);
      assert.deepEqual(steps.slice(0, 1), earlier);
      assert.deepEqual(steps, stepRecordsIn(site.records.join('\n'), completion.operationId));
      const { durationMs, ...record } = steps[1];
      assert.ok(Number.isSafeInteger(durationMs) && (durationMs as number) >= 0);
      assert.deepEqual(record, { event: 'pipeline.step.completed', operationId: completion.operationId,
        stepId: 'incoming.process_html', outcome: 'cancelled', code: 'cancelled' });
      assert.equal(site.fetchCalls.length, 1);
      assert.equal(site.pipelineCalls.length, 0);
      assert.doesNotMatch(site.records.join('\n'), /private-late-error|private-client-cancellation|private-late-markdown/);
    });
  }
}

for (const cancelled of [false, true]) {
  test(`Given production hosted incoming work that owns pending cleanup${cancelled ? ' and cancellation' : ''}, when another request arrives, then the slot stays busy until settlement and a later fetch can run`, { timeout: 10_000 }, async (t) => {
    const started = Promise.withResolvers<AbortSignal>();
    const release = Promise.withResolvers<void>();
    t.after(() => release.resolve());
    const execute = ProcessHtmlStep.prototype.execute;
    let calls = 0;
    t.mock.method(ProcessHtmlStep.prototype, 'execute', async function (this: ProcessHtmlStep, page: WebsiteFetchResult, signal: AbortSignal): Promise<StepResult<string>> {
      if (++calls === 1) {
        started.resolve(signal);
        await release.promise;
        throw new Error('private-late-failure');
      }
      return execute.call(this, page, signal);
    });
    const site = await openHostedFetchSite(t);
    const renderer = RendererProcessDouble.install(t);
    const url = 'https://source.example/story';
    const markdown = 'The rendered article has enough words to keep this first paragraph.';
    renderer.serve(url, { finalUrl: url, html: `<html><body><main><p>${markdown}</p></main></body></html>` });
    const params = { name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the page' } };
    const call = (signal?: AbortSignal) => site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params, signal }));
    const controller = new AbortController();
    const first = call(controller.signal);
    const settled = first.then((response) => response.text(), () => 'disconnected');
    const signal = await started.promise;
    const earlier = structuredClone(stepRecordsIn(site.lines.join('\n')));
    assert.equal(earlier.length, 1);
    assert.equal(earlier[0].stepId, 'outgoing.observe_request');
    if (cancelled) controller.abort();
    await setImmediate();

    const busy = await rpcResult(await call());

    assert.equal(signal.aborted, cancelled);
    assert.equal(busy.isError, true);
    assert.deepEqual(busy.content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
    assert.equal(calls, 1);
    assert.equal(renderer.launches.length, 1);
    assert.deepEqual(stepRecordsIn(site.lines.join('\n')), earlier);
    assert.deepEqual(site.completions().map(({ status }) => status), ['busy']);
    release.resolve();
    await settled;
    while (site.completions().length < 2) { t.signal.throwIfAborted(); await setImmediate(); }
    const next = await rpcResult(await call());

    assert.deepEqual(next.content, [{ type: 'text', text: markdown }]);
    assert.notEqual(next.isError, true);
    assert.equal(calls, 2);
    assert.equal(renderer.launches.length, 2);
    const completions = site.completions();
    assert.deepEqual(completions.map(({ status }) => status), ['busy', cancelled ? 'cancelled' : 'processing_failed', 'success']);
    const steps = stepRecordsIn(site.lines.join('\n'));
    assert.equal(steps.length, 4);
    assert.deepEqual(steps.slice(0, 1), earlier);
    assert.deepEqual(steps.map(({ stepId, outcome, operationId, code }) => ({ stepId, outcome, operationId, code })), [
      { stepId: 'outgoing.observe_request', outcome: 'allowed', operationId: completions[1].operationId, code: undefined },
      { stepId: 'incoming.process_html', outcome: cancelled ? 'cancelled' : 'failed', operationId: completions[1].operationId, code: cancelled ? 'cancelled' : 'step_failed' },
      { stepId: 'outgoing.observe_request', outcome: 'allowed', operationId: completions[2].operationId, code: undefined },
      { stepId: 'incoming.process_html', outcome: 'allowed', operationId: completions[2].operationId, code: undefined },
    ]);
    assert.deepEqual(stepRecordsIn(site.lines.join('\n'), completions[0].operationId as string), []);
    assert.doesNotMatch(site.lines.join('\n'), /private-late-failure/);
  });
}
