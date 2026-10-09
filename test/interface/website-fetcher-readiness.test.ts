import assert from 'node:assert/strict';
import childProcess, {
  type ChildProcess,
  type ExecFileException,
  type ExecFileOptionsWithStringEncoding,
} from 'node:child_process';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { permitIPv4Fixture } from '../support/network-fixture.ts';

const originalExecFile = childProcess.execFile;
const READINESS_WAIT_MS = 5_000;
const TIMING_TOLERANCE_MS = 500;
const READINESS_FINISH_ALLOWANCE_MS = 1_000;
const CHILD_GUARD_MS = 10_000;
const TEST_TIMEOUT_MS = 12_000;
type FetchInvocation = [
  executable: string,
  args: readonly string[],
  options: ExecFileOptionsWithStringEncoding,
  callback: (error: ExecFileException | null, stdout: string, stderr: string) => void,
];

describe('WebsiteFetcherLightpanda readiness', { concurrency: false }, () => {
  let server: Server;
  let origin: string;
  let fetcher: WebsiteFetcherLightpanda;
  let children: ChildProcess[];
  let timers: Set<ReturnType<typeof setTimeout>>;
  let delayedResponseComplete: boolean;
  let ongoingRequests: number;

  beforeEach(async (context) => {
    assert.ok('mock' in context);
    children = [];
    timers = new Set();
    delayedResponseComplete = false;
    ongoingRequests = 0;
    server = createServer((request, response) => {
      if (request.url === '/delayed-page') {
        response.setHeader('Content-Type', 'text/html');
        response.end(`<!doctype html><html><body><div id="status">loading</div>
          <script>fetch('/delayed').then(response => response.text()).then(text => {
            document.getElementById('status').textContent = text;
          });</script></body></html>`);
        return;
      }
      if (request.url === '/busy-page') {
        response.setHeader('Content-Type', 'text/html');
        response.end(`<!doctype html><html><body><div id="status">loading</div>
          <script>
            const request = () => fetch('/ongoing').catch(() => {});
            for (let index = 0; index < 6; index++) request();
            setInterval(request, 100);
          </script></body></html>`);
        return;
      }
      if (request.url === '/delayed' || request.url === '/ongoing') {
        const delayed = request.url === '/delayed';
        if (!delayed) ongoingRequests++;
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (delayed) delayedResponseComplete = true;
          response.end(delayed ? 'completed asynchronous content' : 'still active');
        }, delayed ? 500 : 900);
        timers.add(timer);
        return;
      }
      response.writeHead(404).end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address !== null && typeof address !== 'string');
    origin = `http://localhost:${address.port}`;

    context.mock.method(childProcess, 'execFile', ((...invocation: FetchInvocation) => {
      const child = originalExecFile(...invocation);
      children.push(child);
      const timer = setTimeout(() => child.kill('SIGKILL'), CHILD_GUARD_MS);
      timers.add(timer);
      child.once('close', () => {
        clearTimeout(timer);
        timers.delete(timer);
      });
      return child;
    }) as typeof childProcess.execFile);
    permitIPv4Fixture(context);
    fetcher = new WebsiteFetcherLightpanda();
  });

  afterEach(async (context) => {
    assert.ok('mock' in context);
    context.mock.restoreAll();
    syncBuiltinESMExports();
    for (const timer of timers) clearTimeout(timer);
    await Promise.all(children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const closed = once(child, 'close');
      child.kill('SIGKILL');
      await closed;
    }));
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  test('returns the completed asynchronous DOM before the full wait budget', { timeout: TEST_TIMEOUT_MS }, async (context) => {
    const started = performance.now();
    const requestedUrl = `${origin}/delayed-page`;
    const page = await fetcher.fetchURL(requestedUrl);
    const elapsed = performance.now() - started;

    assert.match(page.html, /<div id="status">completed asynchronous content<\/div>/);
    assert.equal(page.requestedUrl, requestedUrl);
    assert.equal(page.finalUrl, requestedUrl);
    assert.equal(delayedResponseComplete, true);
    assert.ok(elapsed < READINESS_WAIT_MS - TIMING_TOLERANCE_MS, `Fetch took ${elapsed} ms`);
    assert.equal(children.length, 1);
    assert.equal(children[0]?.exitCode, 0);
    context.diagnostic(`Completed DOM returned after ${elapsed.toFixed(0)} ms`);
  });

  test('rejects at the wait budget when overlapping requests prevent network idle', { timeout: TEST_TIMEOUT_MS }, async (context) => {
    const started = performance.now();
    await assert.rejects(fetcher.fetchURL(`${origin}/busy-page`), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Lightpanda readiness limit exceeded after 5000 ms');
      assert.ok(error.cause instanceof Error);
      const cause = error.cause as ExecFileException;
      assert.equal(cause.code, null);
      assert.equal(cause.killed, true);
      assert.equal(cause.signal, 'SIGKILL');
      return true;
    });
    const elapsed = performance.now() - started;

    assert.ok(
      elapsed >= READINESS_WAIT_MS - TIMING_TOLERANCE_MS
        && elapsed < READINESS_WAIT_MS + READINESS_FINISH_ALLOWANCE_MS,
      `Fetch took ${elapsed} ms`,
    );
    assert.ok(ongoingRequests >= 10, `Received ${ongoingRequests} ongoing requests`);
    assert.equal(children.length, 1);
    const child = children[0];
    assert.ok(child !== undefined);
    const pid = child.pid;
    assert.ok(pid !== undefined);
    assert.equal(child.exitCode, null);
    assert.equal(child.signalCode, 'SIGKILL');
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    context.diagnostic(`Wait failed after ${elapsed.toFixed(0)} ms; child ${pid} exited`);
  });
});
