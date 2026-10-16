import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { HostedImageGate } from '../../support/container/hosted-image-gate.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

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

  await t.test('Given the final image, when its metadata and files are inspected, then it contains the checked portal, native cleaner, renderer, certificates and production dependencies, runs as non-root, and contains no development tools or test output', async () => {
    const image = await gate.inspect();
    const facts = await gate.facts();
    const environment = Object.fromEntries(image.Config.Env.map((value) => value.split(/=(.*)/s, 2)));
    const packageJson = JSON.parse(readFileSync(new URL('package.json', repositoryRoot), 'utf8')) as { dependencies: Record<string, string> };
    assert.equal(image.Architecture, 'amd64');
    assert.equal(image.Os, 'linux');
    assert.equal(image.Config.User, 'node');
    assert.deepEqual(image.Config.Entrypoint, ['node', '/app/dist/src/index.js']);
    assert.equal(facts.architecture, 'x64');
    assert.notEqual(facts.user, 0);
    assert.deepEqual(facts.rootEntries, ['dist', 'migrations', 'node_modules', 'package.json', 'src']);
    assert.deepEqual(facts.distEntries, ['src']);
    assert.equal(facts.portal, true);
    assert.deepEqual(facts.developmentPackages, []);
    assert.deepEqual(facts.tools, []);
    assert.deepEqual(facts.productionPackages, Object.keys(packageJson.dependencies).sort());
    assert.equal(facts.rendererVersion, '1.0.0');
    assert.equal(facts.rendererWritable, false);
    assert.equal(facts.certificates, true);
    assert.equal(facts.rulesHash, createHash('sha256').update(readFileSync(new URL('docker/hosted-ad-rules.txt', repositoryRoot))).digest('hex'));
    assert.equal(environment.DEPLOYMENT, 'hosted');
    assert.equal(environment.NODE_ENV, 'production');
    assert.equal(environment.LISTEN_HOST, '0.0.0.0');
    assert.equal(environment.LISTEN_PORT, '8080');
    assert.equal(environment.AD_RULES_FILE, '/etc/thermus/ad-rules.txt');
    assert.equal(environment.LIGHTPANDA_DISABLE_TELEMETRY, 'true');
    assert.deepEqual(Object.keys(environment).filter((name) => /WORKOS|AXIOM|PUBLIC_BASE_URL/.test(name)), []);
  });

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
    assert.deepEqual(socketRefused.content, [{ type: 'text', text: 'Page fetch failed' }]);
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
    const invalidSettings: Readonly<Record<string, string>>[] = [{ AD_RULES_FILE: '/missing-rules' }, { LIGHTPANDA_BIN: '/missing-renderer' }, { WORKOS_COOKIE_PASSWORD: '' }, { PUBLIC_BASE_URL: 'http://thermus.example/' }, { SELF_SERVE_SIGNUP_ENABLED: 'true' }, { SELF_SERVE_SIGNUP_ENABLED: 'yes' }];
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

  await t.test('Given a copied clean context with a failing offline unit check, when the final image target builds, then that check fails and no runtime image is created', { timeout: 1_200_000 }, (step) => gate.assertFailedCheckStopsImage(step.signal));
});
