import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchToolInputSchema } from '../../../src/mcp/fetch-tool-schema.ts';
import { RendererProcessDouble, controlledRenderer } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { openHostedFetchSite } from '../../support/in-process/hosted-fetch-site.ts';

const url = 'https://source.example/story?private-query=yes#private-fragment';
const reason = 'Read the page for this task';
const html = '<html><body><main><h1>Hosted story</h1><p>The rendered article has enough words to keep this first paragraph.</p><div hidden>private-hidden-text</div></main></body></html>';
const markdown = 'The rendered article has enough words to keep this first paragraph.';
const renderedOutput = JSON.stringify({ url, http_status: 200, content: html, error: null });
const params = { name: 'getURLAsMarkdown', arguments: { url, reason } };

test('Given production hosted composition with trusted rules and a valid Connect User, when the user lists and calls the tool, then cleaned Markdown and safe completion records are returned, and missing or revoked access is refused before rendering', { timeout: 30_000 }, async (t) => {
  const site = await openHostedFetchSite(t);
  const renderer = RendererProcessDouble.install(t);
  renderer.serve(url, { finalUrl: url, html });
  const listed = await rpcResult(await site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/list', token: site.token })));
  assert.deepEqual((listed.tools as Array<{ name: string; inputSchema: unknown }>).map(({ name, inputSchema }) => ({ name, inputSchema })), [{ name: params.name, inputSchema: fetchToolInputSchema }]);

  const result = await rpcResult(await site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params })));
  assert.deepEqual(result.content, [{ type: 'text', text: markdown }]);
  assert.notEqual(result.isError, true);
  const unauthenticated = await site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', params }));
  site.world.memberships = [];
  const revoked = await site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params }));
  assert.deepEqual([unauthenticated.status, revoked.status], [401, 403]);
  assert.equal(renderer.launches.length, 1);
  assert.deepEqual(site.completions().map(({ durationMs: _duration, ...record }) => record), [{
    event: 'mcp.tool.completed', authority: 'workos:client_placeholder', subject: 'user_fetch', tenantId: 'workos:client_placeholder:org_fetch',
    tool: params.name, url: 'https://source.example/story', urlStatus: 'valid', reason, reasonStatus: 'valid', status: 'success',
  }]);
  assert.ok(site.world.fake.takeRequests().every(({ method }) => method === 'GET'), 'Hosted fetch changed WorkOS data.');
  assert.doesNotMatch(site.lines.join('\n'), /private-query|private-fragment|private-hidden|Hosted story/);
  assert.ok(!site.lines.join('\n').includes(site.token));
});

test('Given one renderer active in production hosted composition, when another authorized request calls the tool, then it promptly gets a safe busy error and a busy completion, and a call after settlement can run', { timeout: 5_000 }, async (t) => {
  const site = await openHostedFetchSite(t);
  const renderer = controlledRenderer(t);
  t.after(() => renderer.finish(null, renderedOutput, ''));
  const call = () => site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params }));
  const first = call();
  await renderer.launched;
  const excess = await Promise.race([call().then(rpcResult), new Promise<never>((_resolve, reject) => { const timer = setTimeout(() => reject(new Error('The busy response did not arrive promptly')), 1_000); timer.unref(); })]);
  assert.deepEqual(excess.content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
  assert.equal(excess.isError, true);
  assert.equal(renderer.execute.mock.callCount(), 1);
  renderer.finish(null, renderedOutput, '');
  assert.deepEqual((await rpcResult(await first)).content, [{ type: 'text', text: markdown }]);
  const next = call();
  while (renderer.execute.mock.callCount() < 2) await new Promise<void>((resolve) => setImmediate(resolve));
  renderer.finish(null, renderedOutput, '');
  assert.deepEqual((await rpcResult(await next)).content, [{ type: 'text', text: markdown }]);
  assert.deepEqual(site.completions().map(({ status }) => status), ['busy', 'success', 'success']);
});

for (const outcome of ['failure', 'cancelled'] as const) {
  test(`Given a production hosted fetch with ${outcome}, when another call arrives before the renderer settles, then busy is returned until cleanup completes and the next call can render`, { timeout: 5_000 }, async (t) => {
    const site = await openHostedFetchSite(t);
    const renderer = controlledRenderer(t);
    t.after(() => renderer.finish(null, renderedOutput, ''));
    const controller = new AbortController();
    const call = (signal?: AbortSignal) => site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params, signal }));
    const first = call(controller.signal);
    const settled = first.then((response) => response.text(), () => 'disconnected');
    await renderer.launched;
    if (outcome === 'cancelled') {
      controller.abort();
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(renderer.child.signals, ['SIGKILL']);
    }
    const busy = await rpcResult(await call());
    assert.equal(busy.isError, true);
    assert.deepEqual(busy.content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
    assert.equal(renderer.execute.mock.callCount(), 1);
    renderer.finish(Object.assign(new Error('private-renderer-failure'), { code: 22 }), JSON.stringify({ url, http_status: 404, content: '', error: 'HttpError' }), '');
    await settled;
    const next = call();
    while (renderer.execute.mock.callCount() < 2) await new Promise<void>((resolve) => setImmediate(resolve));
    renderer.finish(null, renderedOutput, '');
    assert.deepEqual((await rpcResult(await next)).content, [{ type: 'text', text: markdown }]);
    assert.deepEqual(site.completions().map(({ status }) => status), ['busy', outcome === 'failure' ? 'fetch_failed' : 'cancelled', 'success']);
    assert.doesNotMatch(site.lines.join('\n'), /private-query|private-fragment|private-renderer-failure/);
  });
}
