import assert from 'node:assert/strict';
import childProcess, { type ExecFileException, type ExecFileOptions } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { test, type TestContext } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';

function stubLightpanda(t: TestContext, stdout: string, error: ExecFileException | null = null) {
  const stub = t.mock.method(childProcess, 'execFile', ((
    ...[, , , callback]: [
      string,
      readonly string[],
      ExecFileOptions,
      (error: ExecFileException | null, stdout: string, stderr: string) => void,
    ]
  ) => {
    callback(error, stdout, '');
    return new childProcess.ChildProcess();
  }) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  t.after(() => {
    stub.mock.restore();
    syncBuiltinESMExports();
  });
  return stub;
}

const html = '<html><body><a href="child">Child</a></body></html>';

test('returns HTML and both URLs for a direct response', async (t) => {
  const url = 'https://example.com/directory/page';
  stubLightpanda(t, JSON.stringify({ url, content: html, error: null }));

  assert.deepEqual(await new WebsiteFetcherLightpanda().fetchURL(url), {
    html,
    requestedUrl: url,
    finalUrl: url,
  });
});

test('keeps the exact requested URL and the final URL after a redirect', async (t) => {
  const requestedUrl = 'https://EXAMPLE.com:443/redirect?source=original#part';
  const finalUrl = 'https://destination.example/directory/page?key=value';
  const stub = stubLightpanda(t, JSON.stringify({ url: finalUrl, content: html, error: null }));

  assert.deepEqual(await new WebsiteFetcherLightpanda().fetchURL(requestedUrl), {
    html,
    requestedUrl,
    finalUrl,
  });
  assert.equal(stub.mock.callCount(), 1);
  assert.equal(stub.mock.calls[0].arguments[0], 'lightpanda');
  assert.deepEqual(stub.mock.calls[0].arguments[1], [
    'fetch', '--json', '--dump', 'html', new URL(requestedUrl).href,
  ]);
});

test('keeps an empty HTML result', async (t) => {
  const url = 'https://example.com/';
  stubLightpanda(t, JSON.stringify({ url, content: '', error: null }));

  assert.deepEqual(await new WebsiteFetcherLightpanda().fetchURL(url), {
    html: '', requestedUrl: url, finalUrl: url,
  });
});

for (const payload of [
  'not JSON',
  'null',
  JSON.stringify({ content: html, error: null }),
  JSON.stringify({ url: 'https://example.com/', error: null }),
  JSON.stringify({ url: '/relative', content: html, error: null }),
  JSON.stringify({ url: 'file:///tmp/page', content: html, error: null }),
  JSON.stringify({ url: 'https://example.com/', content: html, error: 'NavigationFailed' }),
]) {
  test(`rejects an invalid fetch result: ${payload}`, async (t) => {
    stubLightpanda(t, payload);

    await assert.rejects(() => new WebsiteFetcherLightpanda().fetchURL('https://example.com/'));
  });
}

test('reports a missing Lightpanda executable', async (t) => {
  stubLightpanda(t, '', Object.assign(new Error('missing'), { code: 'ENOENT' }));

  await assert.rejects(
    () => new WebsiteFetcherLightpanda().fetchURL('https://example.com/'),
    /lightpanda is not available on PATH/,
  );
});

test('preserves a process failure', async (t) => {
  const error = Object.assign(new Error('process failed'), { code: 1 });
  stubLightpanda(t, '', error);

  await assert.rejects(() => new WebsiteFetcherLightpanda().fetchURL('https://example.com/'), error);
});

test('rejects non-HTTP input before starting Lightpanda', async (t) => {
  const stub = stubLightpanda(t, '');

  await assert.rejects(() => new WebsiteFetcherLightpanda().fetchURL('file:///tmp/page'));
  assert.equal(stub.mock.callCount(), 0);
});
