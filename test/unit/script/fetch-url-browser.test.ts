import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { chmod, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { fetchUrlScript } from '../../support/processes/module-paths.ts';

const { callbackResult, browserAuthorization, launchBrowser } = await import(new URL('helper/browser.mjs', pathToFileURL(fetchUrlScript)).href);
const expected = { state: 'expected-state', metadata: { issuer: 'https://issuer.example' } };

test('Given current metadata without issuer response support, when the callback has code and matching state, then it accepts an absent iss', () => {
  assert.deepEqual(callbackResult(new URLSearchParams('state=expected-state&code=authorization-code'), expected), { code: 'authorization-code', iss: undefined });
});

test('Given a matching issuer and a denied authorization, when the callback is checked, then only the denial result is returned', () => {
  assert.deepEqual(callbackResult(new URLSearchParams('state=expected-state&error=access_denied&error_description=private-secret&iss=https%3A%2F%2Fissuer.example'), expected), { denied: true });
});

for (const callback of [
  'state=wrong-state&code=a', 'state=expected-state&state=expected-state&code=a',
  'state=expected-state&code=a&code=b', 'state=expected-state&code=a&error=denied',
  'state=expected-state&code=', 'code=a', 'state=expected-state&error=',
  'state=expected-state&code=a&iss=https%3A%2F%2Fevil.example',
  'state=expected-state&error=denied&iss=https%3A%2F%2Fevil.example&error_description=private-secret',
]) {
  test(`Given an invalid callback ${callback.split('&')[0]}, when it is checked, then it fails without remote details`, () => {
    assert.throws(() => callbackResult(new URLSearchParams(callback), expected), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /private-secret|evil.example|wrong-state/);
      return true;
    });
  });
}

test('Given metadata that requires iss, when it is absent, then the callback is rejected', () => {
  assert.throws(() => callbackResult(new URLSearchParams('state=expected-state&code=a'), { ...expected, metadata: { ...expected.metadata, authorization_response_iss_parameter_supported: true } }));
});


test('Given malformed HTTP input before the valid callback, when the listener receives it, then the process stays alive and accepts the valid authorization', async () => {
  const listener = createServer();
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const redirectUrl = `http://127.0.0.1:${address.port}/callback`;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const result = await browserAuthorization({
    ...expected, redirectUrl, authorizationUrl: new URL('https://issuer.example/authorize'),
    openBrowser: async () => {
      const malformedStatus = await new Promise<number | undefined>((resolve, reject) => {
        const input = request({ host: '127.0.0.1', port: address.port, path: 'http://[' }, (response) => { response.resume(); resolve(response.statusCode); });
        input.once('error', reject); input.end();
      });
      assert.equal(malformedStatus, 400);
      await fetch(`${redirectUrl}?state=expected-state&code=valid-code`);
    },
  }, AbortSignal.timeout(1_000));
  assert.equal(result.code, 'valid-code');
});

test('Given an OS opener that exits unsuccessfully, when the browser is launched, then launch failure is observable for manual URL fallback', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-opener-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = join(directory, process.platform === 'darwin' ? 'open' : 'xdg-open');
  await writeFile(executable, '#!/bin/sh\nexit 1\n');
  await chmod(executable, 0o700);
  const previous = process.env.PATH;
  process.env.PATH = directory;
  t.after(() => { process.env.PATH = previous; });
  await assert.rejects(() => launchBrowser(new URL('https://issuer.example/authorize'), AbortSignal.timeout(1_000)));
});
