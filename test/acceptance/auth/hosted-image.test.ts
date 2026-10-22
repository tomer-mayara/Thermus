import { parseHTML } from 'linkedom';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { HostedImageGate } from '../../support/container/hosted-image-gate.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';

const story = 'http://localhost:8090/story';
const slow = 'http://localhost:8090/slow';
const renderedParagraph = 'JavaScript produced this article with enough words to keep the complete paragraph.';

function call(url: URL, page: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  return fetch(mcpRequest({ url: new URL('/mcp', url).href, method: 'tools/call', token: 'hosted-image-user', signal,
    params: { name: 'getURLAsMarkdown', arguments: { url: page, reason: 'Verify the packaged hosted image' } },
  })).then(rpcResult);
}

// This explicit gate requires Docker and a Linux AMD64 builder. It never uses live identity credentials.
test('Given a clean hosted build without live secrets, when checks pass, then the final Linux AMD64 image serves and renders within its safety and shutdown contracts', { timeout: 3_600_000 }, async (t) => {
  const gate = new HostedImageGate(t);
  await gate.build();

  await t.test('Given the unmodified image and placeholder runtime settings, when the real CLI starts, then portal, assets and health work, MCP remains protected, and foreign origins are refused', { timeout: 90_000 }, async (step) => {
    const server = await gate.server({}, false, step.signal);
    await server.started();
    const portal = await fetch(server.url, { signal: step.signal });
    const html = await portal.text();
    assert.equal(portal.status, 200);
    assert.match(portal.headers.get('Content-Type') ?? '', /text\/html/);
    assert.match(portal.headers.get('Content-Security-Policy') ?? '', /form-action[^;]*https:\/\/api\.workos\.com[^;]*https:\/\/thermus-test\.authkit\.app/);
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g)].map((match) => match[1]);
    assert.ok(assets.length > 0, 'The built portal names no assets');
    for (const asset of assets) {
      const response = await fetch(new URL(asset ?? '', server.url), { signal: step.signal });
      assert.equal(response.status, 200);
      const bundle = await response.text();
      assert.ok(bundle.length > 0);
      for (const secret of [workOSSettings.WORKOS_API_KEY, workOSSettings.WORKOS_COOKIE_PASSWORD]) assert.ok(secret !== undefined && !bundle.includes(secret));
    }
    for (const secret of [workOSSettings.WORKOS_API_KEY, workOSSettings.WORKOS_COOKIE_PASSWORD]) assert.ok(secret !== undefined && !html.includes(secret));
    assert.equal((await fetch(new URL('/healthz', server.url), { method: 'HEAD', signal: step.signal })).status, 200);
    const signup = await fetch(new URL('/signup', server.url), { signal: step.signal });
    assert.equal(signup.status, 200);
    assert.equal(signup.headers.get('Cache-Control'), 'no-store');
    assert.match(await signup.text(), /New account activation is closed/);
    const oldAgreement = await fetch(new URL('/signup', server.url), { method: 'POST', body: 'agreement=accepted', signal: step.signal });
    assert.equal(oldAgreement.status, 403);
    assert.match(await oldAgreement.text(), /New account activation is closed/);
    assert.equal((await fetch(mcpRequest({ url: new URL('/mcp', server.url).href, method: 'tools/list', signal: step.signal }))).status, 401);
    const foreign = await fetch(mcpRequest({ url: new URL('/mcp', server.url).href, method: 'tools/list', token: 'unused-token', headers: { Origin: 'https://foreign.example' }, signal: step.signal }));
    assert.equal(foreign.status, 403);
    assert.equal((await server.stop()).code, 0);
  });

  await t.test('Given placeholder settings and signup enabled only in this image test, when a visitor opens signup, then the exact approved notice appears before sign-in', { timeout: 45_000 }, async (step) => {
    const server = await gate.server({ SELF_SERVE_SIGNUP_ENABLED: 'true' }, false, step.signal);
    await server.started();
    const response = await fetch(new URL('/signup', server.url), { signal: step.signal });
    assert.equal(response.status, 200);
    const document = parseHTML(await response.text()).document;
    const notice = document.querySelector('#privacy-notice .document-reader')?.textContent ?? '';
    assert.equal(Buffer.byteLength(notice, 'utf8'), 24591);
    assert.equal(createHash('sha256').update(notice).digest('hex'), '2c285b8ae45a90dc355706f9728e8769e19b8174b4abefb8adf57ac9aa1d12f9');
    assert.equal(document.querySelector('#privacy-notice details .document-text')?.textContent, notice);
    assert.equal(document.querySelector('.primary-action')?.getAttribute('href'), '/login?return_to=%2Fsignup');
    assert.equal(document.querySelectorAll('form, input').length, 0);
    assert.equal((await server.stop()).code, 0);
  });

  await t.test('Given a Connect User at the external-provider seam, when the image fetches public HTTPS and a controlled JavaScript page, then the real renderer verifies TLS and returns script output cleaned with the shipped native policy', { timeout: 180_000 }, async (step) => {
    const server = await gate.server({}, true, step.signal);
    await server.started();
    const https = await call(server.url, 'https://example.com/', step.signal);
    assert.notEqual(https.isError, true, JSON.stringify(https));
    assert.match(JSON.stringify(https.content), /documentation examples|illustrative examples|Example Domain/i);
    const javascript = await call(server.url, story, step.signal);
    assert.notEqual(javascript.isError, true, JSON.stringify(javascript));
    assert.match(JSON.stringify(javascript.content), new RegExp(renderedParagraph.replace('.', '\\.')));
    assert.doesNotMatch(JSON.stringify(javascript.content), /Waiting for JavaScript|Image advertisement|Hidden image instruction/);
    assert.match(await server.logs(), /Image renderer settled https:\/\/example\.com\//);
    assert.equal((await server.stop()).code, 0);
  });

  await t.test('Given the final hosted runtime, when calls target private addresses, exceed capacity, disconnect or receive SIGTERM during rendering, then the guards refuse unsafe work, cancellation releases capacity after settlement, and the CLI exits within its shutdown bound', { timeout: 180_000 }, async (step) => {
    const server = await gate.server({}, true, step.signal);
    await server.started();
    for (const privateUrl of ['http://127.0.0.1:8090/story', 'http://10.0.0.1/story', 'http://[::1]:8090/story']) {
      const refused = await call(server.url, privateUrl, step.signal);
      assert.equal(refused.isError, true);
      assert.deepEqual(refused.content, [{ type: 'text', text: 'Page fetch failed' }]);
    }
    assert.doesNotMatch(await server.logs(), /Image renderer started/);
    const socketRefused = await call(server.url, 'http://localhost:8090/blocked', step.signal);
    assert.equal(socketRefused.isError, true);
    assert.deepEqual(socketRefused.content, [{ type: 'text', text: 'Page fetch failed: Renderer connection failed' }]);
    const refusedLogs = await server.logs();
    assert.match(refusedLogs, /Image renderer started http:\/\/localhost:8090\/blocked/);
    assert.doesNotMatch(refusedLogs, /Image page connection|Image page request \/blocked/);
    const controller = new AbortController();
    const pending = call(server.url, slow, AbortSignal.any([step.signal, controller.signal])).catch(() => undefined);
    await server.waitForLog('Image page request /slow');
    const busyStarted = performance.now();
    const busy = await call(server.url, story, step.signal);
    assert.equal(busy.isError, true);
    assert.deepEqual(busy.content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
    assert.ok(performance.now() - busyStarted < 3_000, 'The overloaded call did not fail promptly');
    controller.abort();
    await pending;
    await server.waitForLog(`Image renderer settled ${slow}`);
    await server.waitForLog('"status":"cancelled"');
    const recovered = await call(server.url, story, step.signal);
    assert.notEqual(recovered.isError, true, JSON.stringify(recovered));
    const interrupted = call(server.url, slow, step.signal).catch(() => undefined);
    await server.waitForLog('Image page request /slow', 2);
    const stopped = await server.stop();
    await interrupted;
    assert.equal(stopped.code, 0, stopped.logs);
    assert.ok(stopped.duration < 13_000, `SIGTERM shutdown took ${stopped.duration.toFixed(0)} ms`);
    assert.doesNotMatch(stopped.logs, /Hosted shutdown exceeded/);
    assert.equal(stopped.logs.split(`Image renderer settled ${slow}`).length - 1, 2, stopped.logs);
  });

  await t.test('Given invalid local startup inputs, when the image starts, then the real CLI fails before listening', { timeout: 120_000 }, async (step) => {
    const invalidSettings: Readonly<Record<string, string>>[] = [{ AD_RULES_FILE: '/missing-rules' }, { LIGHTPANDA_BIN: '/missing-renderer' }, { WORKOS_COOKIE_PASSWORD: '' }, { PUBLIC_BASE_URL: 'http://thermus.example/' }, { SELF_SERVE_SIGNUP_ENABLED: 'yes' }];
    for (const environment of invalidSettings) {
      const { code, logs } = await gate.rejectedStartup(environment, step.signal);
      assert.equal(code, 1);
      assert.match(logs, /FATAL/);
      assert.doesNotMatch(logs, /Listening on http:\/\//);
      for (const secret of [workOSSettings.WORKOS_API_KEY, workOSSettings.WORKOS_COOKIE_PASSWORD]) assert.ok(secret !== undefined && !logs.includes(secret), logs);
    }
  });

  await t.test('Given a final image with its portal hidden by an empty mount, when startup runs, then it fails before listening', { timeout: 45_000 }, async (step) => {
    const { code, logs } = await gate.rejectedMissingPortal(step.signal);
    assert.equal(code, 1);
    assert.match(logs, /The hosted portal build is missing or invalid/);
    assert.doesNotMatch(logs, /Listening on http:\/\//);
  });
});
