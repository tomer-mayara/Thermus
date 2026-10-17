import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import type { Application } from '../../../src/application.ts';
import { HostedPortal } from '../../../src/hosted-portal.ts';

const issuer = 'https://auth.example.com';
const html = '<!doctype html><html><head><link rel="stylesheet" href="/assets/portal.css"></head><body><div id="app"></div><script type="module" src="/assets/portal.js"></script></body></html>';

async function portalDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-portal-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'assets/portal.js'), 'document.body.dataset.ready = "true";');
  await writeFile(join(directory, 'assets/portal.css'), 'body { color: black; }');
  return directory;
}

function unusedApplication(): Application {
  return { async handle() { throw new Error('The portal must answer this request.'); }, async close() {} };
}

test('Given a built portal, when GET and HEAD request root or build assets, then preloaded bytes and safe content headers are returned', async (t) => {
  const directory = await portalDirectory(t);
  const portal = await HostedPortal.load(issuer, pathToFileURL(`${directory}/`));
  await rm(directory, { recursive: true });
  const application = portal.withApplication(unusedApplication());
  for (const [path, type, body] of [['/', 'text/html; charset=utf-8', html], ['/assets/portal.js', 'text/javascript; charset=utf-8', 'document.body.dataset.ready = "true";'], ['/assets/portal.css', 'text/css; charset=utf-8', 'body { color: black; }']]) {
    for (const method of ['GET', 'HEAD']) {
      const response = await application.handle(new Request(`https://thermus.example${path}`, { method }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), type);
      assert.equal(response.headers.get('Content-Length'), String(Buffer.byteLength(body ?? '')));
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
      assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.workos.com https://auth.example.com");
      assert.equal(await response.text(), method === 'HEAD' ? '' : body);
    }
  }
});

test('Given the hosted wrapper, when health is read repeatedly, then it returns a constant local answer and refuses other methods', async (t) => {
  const directory = await portalDirectory(t);
  const application = (await HostedPortal.load(issuer, pathToFileURL(`${directory}/`))).withApplication(unusedApplication());
  for (const method of ['GET', 'HEAD', 'GET']) {
    const response = await application.handle(new Request('https://thermus.example/healthz', { method }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    assert.equal(await response.text(), method === 'HEAD' ? '' : 'ok\n');
  }
  const response = await application.handle(new Request('https://thermus.example/healthz', { method: 'POST' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, HEAD');
});

test('Given a built portal, when absent or encoded traversal assets are read, then each returns a missing-file response', async (t) => {
  const directory = await portalDirectory(t);
  await writeFile(join(directory, 'private.txt'), 'private');
  const application = (await HostedPortal.load(issuer, pathToFileURL(`${directory}/`))).withApplication(unusedApplication());
  for (const path of ['/assets/absent.js', '/assets/%2e%2e%2fprivate.txt', '/assets/%2Fprivate.txt', '/assets//portal.js']) {
    const response = await application.handle(new Request(`https://thermus.example${path}`));
    assert.equal(response.status, 404, path);
    assert.equal(await response.text(), 'Not found\n');
  }
});

test('Given any other route or method, when the hosted wrapper receives it, then it passes the same request and close drain to the existing application', async (t) => {
  const directory = await portalDirectory(t);
  const received: Request[] = [];
  let closedWith: Promise<void> | undefined;
  const answer = new Response('existing handler', { status: 202 });
  const existing: Application = { async handle(request) { received.push(request); return answer; }, async close(drain) { closedWith = drain; await drain; } };
  const application = (await HostedPortal.load(issuer, pathToFileURL(`${directory}/`))).withApplication(existing);
  const cancelled = new AbortController();
  for (const [path, method] of [['/', 'POST'], ['/assets/portal.js', 'POST'], ['/account', 'GET'], ['/login', 'GET'], ['/callback', 'GET'], ['/logout', 'POST'], ['/session', 'GET'], ['/portal/access', 'GET'], ['/mcp', 'POST'], ['/.well-known/oauth-protected-resource/mcp', 'GET'], ['/unknown', 'GET'], ['/healthz/extra', 'GET']]) {
    const request = new Request(`https://thermus.example${path}?original=yes`, { method, headers: { 'X-Original': 'yes' }, signal: cancelled.signal, ...(method === 'POST' ? { body: 'original body' } : {}) });
    assert.equal(await application.handle(request), answer);
    assert.equal(received.at(-1), request);
  }
  const drain = Promise.resolve();
  await application.close(drain);
  assert.equal(closedWith, drain);
});

test('Given a missing, empty, or broken portal build, when it is loaded, then startup fails with a safe useful error', async (t) => {
  const directory = await portalDirectory(t);
  const index = join(directory, 'index.html');
  for (const contents of ['', '<html>placeholder</html>', html.replace('/assets/portal.js', '/main.ts'), html.replace('/assets/portal.css', '/assets/absent.css'), html.replace('/assets/portal.js', 'https://outside.example/app.js')]) {
    await writeFile(index, contents);
    await assert.rejects(HostedPortal.load(issuer, pathToFileURL(`${directory}/`)), /The hosted portal build is missing or invalid/);
  }
  await writeFile(index, html);
  await writeFile(join(directory, 'assets/portal.js'), '');
  await assert.rejects(HostedPortal.load(issuer, pathToFileURL(`${directory}/`)), /The hosted portal build is missing or invalid/);
  await rm(index);
  await assert.rejects(HostedPortal.load(issuer, pathToFileURL(`${directory}/`)), /The hosted portal build is missing or invalid/);
});

test('Given a symlink in the portal build, when it is loaded, then startup refuses the build', async (t) => {
  const directory = await portalDirectory(t);
  await symlink(join(directory, 'index.html'), join(directory, 'assets/linked.html'));
  await assert.rejects(HostedPortal.load(issuer, pathToFileURL(`${directory}/`)), /The hosted portal build is missing or invalid/);
});
