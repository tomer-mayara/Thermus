import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { fetchUrlScript } from '../../../support/processes/module-paths.ts';

const { browserAuthorization } = await import(new URL('helper/browser.ts', pathToFileURL(fetchUrlScript)).href);

export async function callbackUrl(): Promise<string> {
  const listener = createServer();
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  return `http://127.0.0.1:${address.port}/callback`;
}

export async function observeCallback(callback: string, requireIssuer = false) {
  const redirectUrl = await callbackUrl();
  let status = 0;
  let body = '';
  const result = await browserAuthorization({
    state: 'expected-state', redirectUrl, authorizationUrl: new URL('https://issuer.example/authorize'),
    metadata: { issuer: 'https://issuer.example', authorization_response_iss_parameter_supported: requireIssuer },
    openBrowser: async () => {
      const response = await fetch(`${redirectUrl}?${callback}`);
      status = response.status;
      body = await response.text();
      if (status !== 200) await fetch(`${redirectUrl}?state=expected-state&code=recovery-code&iss=https%3A%2F%2Fissuer.example`);
    },
  }, AbortSignal.timeout(1_000));
  return { status, body, result };
}
