import assert from 'node:assert/strict';
import childProcess, {
  ChildProcess,
  type ExecFileException,
  type ExecFileOptionsWithStringEncoding,
} from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';

describe('WebsiteFetcherLightpanda', () => {
  let command: string;
  let args: readonly string[];
  let options: ExecFileOptionsWithStringEncoding;
  let finish: (error: ExecFileException | null, stdout: string, stderr: string) => void;
  let fetcher: WebsiteFetcherLightpanda;
  let launchCount: number;
  let child: ChildProcess;

  beforeEach(() => {
    launchCount = 0;
    child = new ChildProcess();
    mock.method(childProcess, 'execFile', ((...invocation: [
      string, readonly string[], ExecFileOptionsWithStringEncoding, typeof finish,
    ]) => {
      const [executable, arguments_, executionOptions, callback] = invocation;
      launchCount += 1;
      command = executable;
      args = arguments_;
      options = executionOptions;
      finish = callback;
      return child;
    }) as typeof childProcess.execFile);
    syncBuiltinESMExports();
    fetcher = new WebsiteFetcherLightpanda();
  });

  afterEach(() => {
    mock.restoreAll();
    syncBuiltinESMExports();
  });

  test('uses a bounded network idle wait and preserves process limits', async () => {
    const result = fetcher.fetchURL('https://example.com');

    assert.equal(command, 'lightpanda');
    assert.deepEqual(args, [
      'fetch', '--dump', 'html', '--wait-until', 'networkidle', '--wait-ms', '60000',
      'https://example.com/',
    ]);
    assert.deepEqual(options, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: 60_000,
    });
    finish(null, '<html>Ready</html>', '');
    assert.equal(await result, '<html>Ready</html>');
  });

  test('returns HTML as soon as the process completes', async () => {
    const result = fetcher.fetchURL('https://example.com/');
    finish(null, '<html>Ready early</html>', '');

    const nextTurn = new Promise<string>((resolve) => {
      setImmediate(() => resolve('HTML did not return after process completion'));
    });
    assert.equal(await Promise.race([result, nextTurn]), '<html>Ready early</html>');
  });

  test('rejects a readiness failure and discards partial HTML', async () => {
    const error: ExecFileException = Object.assign(new Error('wait failed'), { code: 1 });
    const result = fetcher.fetchURL('https://example.com/');
    finish(error, '<html>Partial</html>', 'wait failed');

    await assert.rejects(result, (caught) => caught === error);
  });

  test('kills the child at the readiness limit and rejects only after child completion', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const kill = mock.method(child, 'kill', () => true);
    const result = fetcher.fetchURL('https://example.com/');
    let settled = false;
    void result.then(() => { settled = true; }, () => { settled = true; });

    t.mock.timers.tick(4999);
    assert.equal(kill.mock.callCount(), 0);
    t.mock.timers.tick(1);
    assert.equal(kill.mock.callCount(), 1);
    assert.deepEqual(kill.mock.calls[0].arguments, ['SIGKILL']);
    await new Promise<void>((resolve) => { setImmediate(resolve); });
    assert.equal(settled, false);

    const error: ExecFileException = Object.assign(new Error('Command failed'), {
      killed: true, signal: 'SIGKILL' as const, code: null,
    });
    finish(error, '<html>Partial</html>', '');
    await assert.rejects(result, (caught) => {
      assert.ok(caught instanceof Error);
      assert.equal(caught.message, 'Lightpanda readiness limit exceeded after 5000 ms');
      assert.equal(caught.cause, error);
      return true;
    });
    t.mock.timers.tick(60_000);
    assert.equal(kill.mock.callCount(), 1);
  });

  test('clears the readiness timer after success', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const kill = mock.method(child, 'kill', () => true);
    const result = fetcher.fetchURL('https://example.com/');
    finish(null, '<html>Ready</html>', '');
    assert.equal(await result, '<html>Ready</html>');

    t.mock.timers.tick(60_000);
    assert.equal(kill.mock.callCount(), 0);
  });

  test('clears the readiness timer after a process error', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const kill = mock.method(child, 'kill', () => true);
    const error = new Error('launch failed');
    const result = fetcher.fetchURL('https://example.com/');
    finish(error, '', '');
    await assert.rejects(result, (caught) => caught === error);

    t.mock.timers.tick(60_000);
    assert.equal(kill.mock.callCount(), 0);
  });

  test('waits for child completion and preserves the process timeout error', async () => {
    const error: ExecFileException = Object.assign(new Error('Command timed out'), {
      killed: true,
      signal: 'SIGTERM' as const,
      code: null,
    });
    const result = fetcher.fetchURL('https://example.com/');
    assert.equal(options.timeout, 60_000);
    let settled = false;
    void result.then(() => { settled = true; }, () => { settled = true; });
    await new Promise<void>((resolve) => { setImmediate(resolve); });
    assert.equal(settled, false);
    finish(error, '<html>Partial</html>', '');

    await assert.rejects(result, (caught) => caught === error);
  });

  test('preserves the output buffer limit error', async () => {
    const error: ExecFileException = Object.assign(new Error('stdout maxBuffer length exceeded'), {
      code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
    });
    const result = fetcher.fetchURL('https://example.com/');
    finish(error, '<html>Partial</html>', '');

    await assert.rejects(result, (caught) => caught === error);
  });

  test('reports an unavailable executable', async () => {
    const error: ExecFileException = Object.assign(new Error('spawn lightpanda ENOENT'), {
      code: 'ENOENT',
    });
    const result = fetcher.fetchURL('https://example.com/');
    finish(error, '', '');

    await assert.rejects(result, { message: 'lightpanda is not available on PATH' });
  });

  test('preserves other launch errors', async () => {
    const error: ExecFileException = Object.assign(new Error('spawn lightpanda EACCES'), {
      code: 'EACCES',
    });
    const result = fetcher.fetchURL('https://example.com/');
    finish(error, '', '');

    await assert.rejects(result, (caught) => caught === error);
  });

  test('rejects a synchronous launch error without a timer', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const kill = mock.method(child, 'kill', () => true);
    const error = new Error('launch failed');
    mock.method(childProcess, 'execFile', () => { throw error; });
    syncBuiltinESMExports();

    await assert.rejects(fetcher.fetchURL('https://example.com/'), (caught) => caught === error);
    t.mock.timers.tick(60_000);
    assert.equal(kill.mock.callCount(), 0);
  });

  test('rejects unsupported URL protocols before starting a child', async () => {
    await assert.rejects(fetcher.fetchURL('file:///tmp/page.html'), {
      message: 'Fetch URL must use http or https: file:///tmp/page.html',
    });
    assert.equal(launchCount, 0);
  });
});
