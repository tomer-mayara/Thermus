import assert from 'node:assert/strict';
import childProcess, { type ExecFileException, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { createServer, type RequestListener } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { test, type TestContext } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';

const html = '<html><head><title>Redirect fixture</title></head><body><main><p>Related pages: <a href="child">Child</a> and <a href="/root">Root</a>.</p></main></body></html>';

function trustLoopbackFixture(t: TestContext): void {
  const execFile = childProcess.execFile;
  const stub = t.mock.method(childProcess, 'execFile', ((
    ...[file, args, options, callback]: [
      string,
      readonly string[],
      ExecFileOptionsWithStringEncoding,
      (error: ExecFileException | null, stdout: string, stderr: string) => void,
    ]
  ) =>
    execFile(file, [
      ...args, '--block-private-networks', '--block-cidrs', '-127.0.0.1/32',
    ], options, callback)) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  t.after(() => {
    stub.mock.restore();
    syncBuiltinESMExports();
  });
}

async function serveFixture(t: TestContext, listener: RequestListener): Promise<number> {
  const server = createServer(listener);
  t.after(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}

test('returns direct-page metadata and preserves rendered content', { timeout: 65_000 }, async (t) => {
  trustLoopbackFixture(t);
  const port = await serveFixture(t, (_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(html);
  });
  const url = `http://127.0.0.1:${port}/directory/page`;

  const page = await new WebsiteFetcherLightpanda().fetchURL(url);

  assert.equal(page.requestedUrl, url);
  assert.equal(page.finalUrl, url);
  assert.match(page.html, /Redirect fixture/);
  const result = await new HtmlToMarkdownPipeline([new CleanHtmlToMarkdownDefuddle()]).process(page);
  assert.ok(result.markdown?.includes(`[Child](http://127.0.0.1:${port}/directory/child)`));
});

test('uses the final host and path after a local redirect chain', { timeout: 65_000 }, async (t) => {
  trustLoopbackFixture(t);
  const visited: string[] = [];
  const destinationPort = await serveFixture(t, (request, response) => {
    visited.push(`destination${request.url}`);
    response.setHeader('Content-Type', 'text/html');
    response.end(html);
  });
  const finalUrl = `http://localhost:${destinationPort}/directory/page`;
  const sourcePort = await serveFixture(t, (request, response) => {
    visited.push(`source${request.url}`);
    response.writeHead(302, { Location: request.url === '/redirect' ? '/next' : finalUrl });
    response.end();
  });
  const requestedUrl = `http://127.0.0.1:${sourcePort}/redirect`;

  const page = await new WebsiteFetcherLightpanda().fetchURL(requestedUrl);

  assert.equal(page.requestedUrl, requestedUrl);
  assert.equal(page.finalUrl, finalUrl);
  assert.deepEqual(visited, ['source/redirect', 'source/next', 'destination/directory/page']);
  const result = await new HtmlToMarkdownPipeline([new CleanHtmlToMarkdownDefuddle()]).process(page);
  assert.ok(result.markdown?.includes(`[Child](http://localhost:${destinationPort}/directory/child)`));
  assert.ok(result.markdown?.includes(`[Root](http://localhost:${destinationPort}/root)`));
  assert.equal(result.requestedUrl, requestedUrl);
  assert.equal(result.finalUrl, finalUrl);
});
