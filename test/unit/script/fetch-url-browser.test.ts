import assert from 'node:assert/strict';
import { request } from 'node:http';
import { chmod, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { fetchUrlScript } from '../../support/processes/module-paths.ts';
import { callbackUrl, observeCallback } from './fixtures/browser-callback-harness.ts';

const { browserAuthorization } = await import(new URL('helper/browser.ts', pathToFileURL(fetchUrlScript)).href);

const expected = { state: 'expected-state', metadata: { issuer: 'https://issuer.example' } };

test('Given current metadata without issuer response support, when the callback has code and matching state, then it accepts an absent iss', async () => {
  const observed = await observeCallback('state=expected-state&code=authorization-code');
  assert.equal(observed.status, 200);
  assert.deepEqual(observed.result, { code: 'authorization-code', iss: undefined });
});

test('Given a matching issuer and a denied authorization, when the callback is checked, then only the denial result is returned', async () => {
  const observed = await observeCallback('state=expected-state&error=access_denied&error_description=private-secret&iss=https%3A%2F%2Fissuer.example');
  assert.equal(observed.status, 200);
  assert.deepEqual(observed.result, { denied: true });
  assert.doesNotMatch(observed.body, /private-secret/);
});

for (const callback of [
  'state=wrong-state&code=a', 'state=expected-state&state=expected-state&code=a',
  'state=expected-state&code=a&code=b', 'state=expected-state&code=a&error=denied',
  'state=expected-state&code=', 'code=a', 'state=expected-state&error=',
  'state=expected-state&code=a&iss=https%3A%2F%2Fevil.example',
  'state=expected-state&error=denied&iss=https%3A%2F%2Fevil.example&error_description=private-secret',
]) {
  test(`Given an invalid callback ${callback.split('&')[0]}, when it is checked, then it fails without remote details`, async () => {
    const observed = await observeCallback(callback);
    assert.equal(observed.status, 400);
    assert.equal(observed.body, 'Invalid callback. Return to the terminal.');
    assert.equal(observed.result.code, 'recovery-code');
  });
}

test('Given metadata that requires iss, when it is absent, then the callback is rejected', async () => {
  const observed = await observeCallback('state=expected-state&code=a', true);
  assert.equal(observed.status, 400);
  assert.equal(observed.result.code, 'recovery-code');
});


test('Given malformed HTTP input before the valid callback, when the listener receives it, then the process stays alive and accepts the valid authorization', async () => {
  const redirectUrl = await callbackUrl();
  const result = await browserAuthorization({
    ...expected, redirectUrl, authorizationUrl: new URL('https://issuer.example/authorize'),
    openBrowser: async () => {
      const malformedStatus = await new Promise<number | undefined>((resolve, reject) => {
        const input = request({ host: '127.0.0.1', port: Number(new URL(redirectUrl).port), path: 'http://[' }, (response) => { response.resume(); resolve(response.statusCode); });
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
  const redirectUrl = await callbackUrl();
  const fallback = Promise.withResolvers<string>();
  t.mock.method(process.stderr, 'write', (text: string) => { fallback.resolve(text); return true; });
  const authorization = browserAuthorization({ ...expected, redirectUrl, authorizationUrl: new URL('https://issuer.example/authorize') }, AbortSignal.timeout(1_000));
  const message = await fallback.promise;
  assert.equal(message, 'Open this URL in a browser on this machine:\nhttps://issuer.example/authorize\n');
  assert.equal((await fetch(`${redirectUrl}?state=expected-state&code=manual-code`)).status, 200);
  assert.equal((await authorization).code, 'manual-code');
});
