import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExecFileException } from 'node:child_process';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { controlledRenderer } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

for (const [stdout, process, expected] of [
  [JSON.stringify({ url: 'https://source.example/private-query', http_status: 429, headers: { authorization: 'PRIVATESECRET' }, dump: 'html', content: 'PRIVATESECRET', error: null }), { code: 22 }, { category: 'http', phase: 'renderer_result', httpStatus: 429, exitCode: 22 }],
  [JSON.stringify({ http_status: 503, error: 'OperationTimedout' }), { code: 1 }, { category: 'http', phase: 'renderer_result', httpStatus: 503, rendererErrorCode: 'OperationTimedout', exitCode: 1 }],
  [JSON.stringify({ http_status: 0, error: 'OperationTimedout' }), { code: 1 }, { category: 'renderer', phase: 'renderer_result', rendererErrorCode: 'OperationTimedout', exitCode: 1 }],
  ['', { code: 1, signal: 'SIGTERM', killed: true }, { category: 'unknown', phase: 'renderer_process', exitCode: 1, signal: 'SIGTERM', killed: true, metadata: 'absent' }],
  ['{private-invalid-json', { code: 'PRIVATESECRET', signal: 'PRIVATESECRET', killed: false }, { category: 'unknown', phase: 'renderer_process', processErrorCode: 'unknown', killed: false, metadata: 'invalid' }],
  [JSON.stringify({ http_status: 999, error: 'PRIVATESECRET' }), { code: 1 }, { category: 'unknown', phase: 'renderer_result', rendererErrorCode: 'unknown', exitCode: 1 }],
  ['', { code: 22, signal: 'SIGTERM', killed: true }, { category: 'unknown', phase: 'renderer_process', exitCode: 22, signal: 'SIGTERM', killed: true, metadata: 'absent' }],
  ['{invalid', { code: 22, signal: 'SIGTERM', killed: true }, { category: 'unknown', phase: 'renderer_process', exitCode: 22, signal: 'SIGTERM', killed: true, metadata: 'invalid' }],
  ['{}', null, { category: 'validation', phase: 'renderer_result', reason: 'invalid_http_status' }],
  [JSON.stringify({ http_status: 200, url: 'https://source.example/', error: null }), null, { category: 'validation', phase: 'renderer_result', httpStatus: 200, reason: 'invalid_result' }],
  [JSON.stringify({ http_status: 200, url: 'file:///private', content: '', error: null }), null, { category: 'validation', phase: 'renderer_result', httpStatus: 200, reason: 'invalid_final_url' }],
  ['[]', null, { category: 'validation', phase: 'renderer_result', metadata: 'invalid' }],
  ['', null, { category: 'validation', phase: 'renderer_result', metadata: 'absent' }],
] as const) {
  test(`Given renderer output and process outcome ${JSON.stringify(expected)}, when fetching fails, then diagnostics retain only bounded concrete facts`, async (t) => {
    const renderer = controlledRenderer(t);
    const result = new WebsiteFetcherLightpanda().fetchURL('https://source.example/private-query');
    await renderer.launched;
    const cause = process === null ? null : Object.assign(new Error('PRIVATESECRET stdout stderr command path'), process);
    renderer.finish(cause as ExecFileException | null, stdout, 'PRIVATESECRET stderr');
    await assert.rejects(result, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepEqual((error as Error & { diagnostic?: unknown }).diagnostic, expected);
      if (cause !== null) assert.equal(error.cause, cause);
      return true;
    });
  });
}

for (const [url, expected] of [
  ['http://127.0.0.1/private', { category: 'validation', phase: 'destination_policy', reason: 'blocked_destination' }],
  ['file:///private', { category: 'validation', phase: 'url_validation', reason: 'unsupported_protocol' }],
  ['invalid-url', { category: 'validation', phase: 'url_validation', reason: 'invalid_url' }],
] as const) {
  test(`Given rejected destination ${url}, when fetching fails before rendering, then the boundary identifies validation`, async () => {
    await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepEqual((error as Error & { diagnostic?: unknown }).diagnostic, expected);
      return true;
    });
  });
}

for (const code of ['CouldntResolveHost', 'CouldntConnect', 'SslConnectError', 'PeerFailedVerification', 'TooManyRedirects', 'RecvError']) {
  test(`Given the pinned renderer reports ${code}, when fetching fails, then its exact allowlisted code is retained`, async (t) => {
    const renderer = controlledRenderer(t);
    const result = new WebsiteFetcherLightpanda().fetchURL('https://source.example/');
    await renderer.launched;
    renderer.finish(Object.assign(new Error('private-message'), { code: 1 }), JSON.stringify({ http_status: 0, error: code }), 'private-stderr');
    await assert.rejects(result, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepEqual((error as Error & { diagnostic?: unknown }).diagnostic, { category: 'renderer', phase: 'renderer_result', rendererErrorCode: code, exitCode: 1 });
      return true;
    });
  });
}

test('Given DNS rejects with ENOTFOUND and private host text, when fetching fails, then diagnostics identify the destination phase and safe system code', async (t) => {
  const renderer = controlledRenderer(t);
  const cause = Object.assign(new Error('getaddrinfo PRIVATESECRET'), { code: 'ENOTFOUND' });
  renderer.lookup.mock.mockImplementation(async () => { throw cause; });
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL('https://source.example/'), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.cause, cause);
    assert.deepEqual((error as Error & { diagnostic?: unknown }).diagnostic, { category: 'unknown', phase: 'destination_policy', processErrorCode: 'ENOTFOUND' });
    return true;
  });
  assert.equal(renderer.execute.mock.callCount(), 0);
});

test('Given DNS stays pending, when its budget expires, then diagnostics identify the DNS timeout without host data', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  renderer.lookup.mock.mockImplementation(() => new Promise<never>(() => {}));
  const result = new WebsiteFetcherLightpanda().fetchURL('https://source.example/');
  const rejected = assert.rejects(result, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.deepEqual((error as Error & { diagnostic?: unknown }).diagnostic, { category: 'dns_timeout', phase: 'destination_policy', budgetMs: 5_000 });
    return true;
  });
  t.mock.timers.tick(5_000);
  await rejected;
  assert.equal(renderer.execute.mock.callCount(), 0);
});
