import '../../support/processes/use-hosted-portal-fixture.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApplication } from '../../../src/application.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { hostedFetchSettings, workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';

const environment = {
  ...hostedFetchSettings,
  ...workOSSettings,
  DEPLOYMENT: 'hosted',
  PUBLIC_BASE_URL: 'https://thermus.example/',
};

test('Given valid local hosted inputs, when the production application opens, then the portal, built assets, and local health are available without WorkOS calls and protected routes still require sign-in', async (t) => {
  let outboundCalls = 0;
  t.mock.method(globalThis, 'fetch', () => { outboundCalls += 1; throw new Error('This specification permits no outbound call.'); });
  const application = await createApplication(loadDeploymentConfig(environment, 'http'), { info() {}, error() {} }, environment);
  t.after(() => application.close());

  const portal = await application.handle(new Request('https://thermus.example/'));
  assert.equal(portal.status, 200);
  assert.match(portal.headers.get('Content-Type') ?? '', /^text\/html/);
  assert.equal(portal.headers.get('Content-Security-Policy'), "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.workos.com https://thermus-test.authkit.app");
  const html = await portal.text();
  const script = /src="(\/assets\/[^\"]+\.js)"/.exec(html)?.[1];
  assert.ok(script, 'The portal loads its built module.');
  const asset = await application.handle(new Request(`https://thermus.example${script}`));
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('Content-Type') ?? '', /^text\/javascript/);
  assert.ok((await asset.text()).length > 0);

  for (const method of ['GET', 'HEAD']) {
    const health = await application.handle(new Request('https://thermus.example/healthz', { method }));
    assert.equal(health.status, 200);
    assert.equal(await health.text(), method === 'HEAD' ? '' : 'ok\n');
  }
  assert.equal((await application.handle(new Request('https://thermus.example/account'))).status, 401);
  assert.equal((await application.handle(new Request('https://thermus.example/mcp'))).status, 401);
  assert.equal(outboundCalls, 0);
});
