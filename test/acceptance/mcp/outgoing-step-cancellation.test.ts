import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { ObserveRequestStep } from '../../../src/pipelines/execution/observe-request-step.ts';
import type { StepResult } from '../../../src/pipelines/execution/pipeline-step.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { stepRecordsIn } from '../../support/drivers/operator-log.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { openHostedFetchSite } from '../../support/in-process/hosted-fetch-site.ts';
import { openFetchSite, validFetchArguments } from '../../support/in-process/mcp-fetch-site.ts';

for (const era of mcpProtocolEras) {
  for (const outcome of ['allow', 'block', 'throw'] as const) {
    test(`Given an entered outgoing step in ${era} with late ${outcome}, when the client cancels, then no terminal record or fetch occurs until owned cleanup settles and cancellation wins`, { timeout: 5_000 }, async (t) => {
      const started = Promise.withResolvers<AbortSignal>();
      const observedAbort = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      t.after(() => release.resolve());
      const controller = new AbortController();
      const site = await openFetchSite(t, era, {
        httpSignal: era === '2025-11-25' ? controller.signal : undefined,
        outgoing: { execute: async (input, signal): Promise<StepResult<string, 'blocked'>> => {
          const onAbort = () => observedAbort.resolve();
          signal.addEventListener('abort', onAbort, { once: true });
          started.resolve(signal);
          try {
            await release.promise;
            if (outcome === 'throw') throw new Error('private-late-error');
            return outcome === 'block' ? { decision: 'block', code: 'blocked' } : { decision: 'allow', output: input };
          } finally {
            signal.removeEventListener('abort', onAbort);
          }
        } },
      });
      const pending = site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }, { signal: controller.signal });
      const rejected = assert.rejects(pending);
      const signal = await started.promise;

      controller.abort(new Error('private-client-cancellation'));
      await rejected;
      await observedAbort.promise;
      assert.equal(signal.aborted, true);
      assert.deepEqual(stepRecordsIn(site.records.join('\n')), []);
      assert.deepEqual(site.completionLines(), []);
      assert.deepEqual(site.fetchCalls, []);
      release.resolve();
      const completion = JSON.parse(await site.firstCompletion);

      assert.equal(completion.status, 'cancelled');
      assert.equal(site.completionLines().length, 1);
      const steps = stepRecordsIn(site.records.join('\n'), completion.operationId);
      assert.equal(steps.length, 1);
      const { durationMs, ...record } = steps[0];
      assert.ok(Number.isSafeInteger(durationMs) && (durationMs as number) >= 0);
      assert.deepEqual(record, { event: 'pipeline.step.completed', operationId: completion.operationId,
        stepId: 'outgoing.observe_request', outcome: 'cancelled', code: 'cancelled' });
      assert.deepEqual(site.fetchCalls, []);
      assert.deepEqual(site.pipelineCalls, []);
      assert.doesNotMatch(site.records.join('\n'), /private-late-error|private-client-cancellation/);
    });
  }
}

test('Given production hosted composition with an outgoing step that owns pending cleanup, when its request aborts, then the hosted slot stays busy until settlement and a later call can fetch', { timeout: 10_000 }, async (t) => {
  const started = Promise.withResolvers<AbortSignal>();
  const release = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  let stepCalls = 0;
  t.mock.method(ObserveRequestStep.prototype, 'execute', async (input: string, signal: AbortSignal): Promise<StepResult<string, 'blocked'>> => {
    stepCalls += 1;
    if (stepCalls === 1) { started.resolve(signal); await release.promise; }
    return { decision: 'allow', output: input };
  });
  const site = await openHostedFetchSite(t);
  const renderer = RendererProcessDouble.install(t);
  const url = 'https://source.example/story';
  const markdown = 'The rendered article has enough words to keep this first paragraph.';
  renderer.serve(url, { finalUrl: url, html: `<html><body><main><p>${markdown}</p></main></body></html>` });
  const params = { name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the page' } };
  const call = (signal?: AbortSignal) => site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params, signal }));
  const controller = new AbortController();
  const first = call(controller.signal).then((response) => response.text(), () => 'disconnected');
  const signal = await started.promise;
  controller.abort();
  await setImmediate();

  const busy = await rpcResult(await call());

  assert.equal(signal.aborted, true);
  assert.equal(busy.isError, true);
  assert.deepEqual(busy.content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
  assert.equal(stepCalls, 1);
  assert.deepEqual(renderer.launches, []);
  assert.deepEqual(stepRecordsIn(site.lines.join('\n')), []);
  assert.deepEqual(site.completions().map(({ status }) => status), ['busy']);
  release.resolve();
  await first;
  while (site.completions().length < 2) {
    t.signal.throwIfAborted();
    await setImmediate();
  }
  assert.deepEqual(site.completions().map(({ status }) => status), ['busy', 'cancelled']);
  const next = await rpcResult(await call());

  assert.deepEqual(next.content, [{ type: 'text', text: markdown }]);
  assert.notEqual(next.isError, true);
  assert.equal(stepCalls, 2);
  assert.equal(renderer.launches.length, 1);
  const completions = site.completions();
  assert.deepEqual(completions.map(({ status }) => status), ['busy', 'cancelled', 'success']);
  const steps = stepRecordsIn(site.lines.join('\n'));
  assert.deepEqual(steps.map(({ outcome, operationId }) => ({ outcome, operationId })), [
    { outcome: 'cancelled', operationId: completions[1].operationId },
    { outcome: 'allowed', operationId: completions[2].operationId },
    { outcome: 'allowed', operationId: completions[2].operationId },
  ]);
  assert.deepEqual(stepRecordsIn(site.lines.join('\n'), completions[0].operationId as string), []);
});
