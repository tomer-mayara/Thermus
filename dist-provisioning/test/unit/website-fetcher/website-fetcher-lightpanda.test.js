import assert from 'node:assert/strict';
import childProcess, { ChildProcess, } from 'node:child_process';
import dns from 'node:dns/promises';
import { syncBuiltinESMExports } from 'node:module';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.js';
describe('WebsiteFetcherLightpanda', () => {
    const htmlResult = (url, html) => JSON.stringify({ url, http_status: 200, content: html, error: null });
    const expectedPage = (requestedUrl, html, finalUrl = requestedUrl) => ({
        requestedUrl,
        finalUrl,
        html,
    });
    let command;
    let args;
    let options;
    let finish;
    let fetcher;
    let launchCount;
    let child;
    let rendererLaunched;
    let signalRendererLaunch;
    beforeEach(() => {
        mock.property(process, 'env', { ...process.env, LIGHTPANDA_BIN: '' });
        launchCount = 0;
        child = new ChildProcess();
        rendererLaunched = new Promise((resolve) => { signalRendererLaunch = resolve; });
        mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
        mock.method(childProcess, 'execFile', ((...invocation) => {
            const [executable, arguments_, executionOptions, callback] = invocation;
            launchCount += 1;
            signalRendererLaunch();
            command = executable;
            args = arguments_;
            options = executionOptions;
            finish = callback;
            return child;
        }));
        syncBuiltinESMExports();
        fetcher = new WebsiteFetcherLightpanda();
    });
    afterEach(() => {
        mock.restoreAll();
        syncBuiltinESMExports();
    });
    test('uses bounded network idle and native network policies while preserving process limits', async () => {
        const requestedUrl = 'https://example.com';
        const finalUrl = 'https://redirected.example/final';
        const result = fetcher.fetchURL(requestedUrl);
        await rendererLaunched;
        assert.equal(command, 'lightpanda');
        assert.deepEqual(args.slice(0, 10), [
            'fetch', '--json', '--dump', 'html', '--fail-on-http-error', '--wait-until', 'networkidle', '--wait-ms', '60000',
            '--block-private-networks',
        ]);
        assert.ok(args.includes('--block-cidrs'));
        assert.ok(args.includes('--http-proxy'));
        assert.equal(args[args.indexOf('--http-proxy') + 1], '');
        assert.equal(args.at(-1), 'https://example.com/');
        assert.deepEqual(options, {
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
            timeout: 60_000,
        });
        finish(null, htmlResult(finalUrl, '<html>Ready</html>'), '');
        assert.deepEqual(await result, expectedPage(requestedUrl, '<html>Ready</html>', finalUrl));
    });
    test('returns HTML as soon as the process completes', async () => {
        const result = fetcher.fetchURL('https://example.com/');
        await rendererLaunched;
        finish(null, htmlResult('https://example.com/', '<html>Ready early</html>'), '');
        const nextTurn = new Promise((resolve) => {
            setImmediate(() => resolve('HTML did not return after process completion'));
        });
        assert.deepEqual(await Promise.race([result, nextTurn]), expectedPage('https://example.com/', '<html>Ready early</html>'));
    });
    const processErrors = [
        ['rejects a readiness failure and discards partial HTML', Object.assign(new Error('wait failed'), { code: 1 })],
        ['preserves the output buffer limit error', Object.assign(new Error('stdout maxBuffer length exceeded'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' })],
        ['reports an unavailable executable', Object.assign(new Error('spawn lightpanda ENOENT'), { code: 'ENOENT' }), 'Lightpanda executable "lightpanda" was not found. See docs/lightpanda-runtime.md for setup.'],
        ['preserves other launch errors', Object.assign(new Error('spawn lightpanda EACCES'), { code: 'EACCES' })],
    ];
    for (const [name, error, expectedMessage] of processErrors) {
        test(name, async () => {
            const result = fetcher.fetchURL('https://example.com/');
            await rendererLaunched;
            finish(error, '<html>Partial</html>', error.message);
            await assert.rejects(result, (caught) => expectedMessage
                ? caught.message === expectedMessage
                : caught === error);
        });
    }
    test('kills the child at the readiness limit and rejects only after child completion', async (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const kill = mock.method(child, 'kill', () => true);
        const result = fetcher.fetchURL('https://example.com/');
        await rendererLaunched;
        let settled = false;
        void result.then(() => { settled = true; }, () => { settled = true; });
        t.mock.timers.tick(4999);
        assert.equal(kill.mock.callCount(), 0);
        t.mock.timers.tick(1);
        assert.equal(kill.mock.callCount(), 1);
        assert.deepEqual(kill.mock.calls[0].arguments, ['SIGKILL']);
        await new Promise((resolve) => { setImmediate(resolve); });
        assert.equal(settled, false);
        const error = Object.assign(new Error('Command failed'), {
            killed: true, signal: 'SIGKILL', code: null,
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
    const timerCleanupCases = [
        ['clears the readiness timer after success', null],
        ['clears the readiness timer after a process error', new Error('launch failed')],
    ];
    for (const [name, error] of timerCleanupCases) {
        test(name, async (t) => {
            t.mock.timers.enable({ apis: ['setTimeout'] });
            const kill = mock.method(child, 'kill', () => true);
            const result = fetcher.fetchURL('https://example.com/');
            await rendererLaunched;
            finish(error, htmlResult('https://example.com/', '<html>Ready</html>'), '');
            if (error === null) {
                assert.deepEqual(await result, expectedPage('https://example.com/', '<html>Ready</html>'));
            }
            else {
                await assert.rejects(result, (caught) => caught === error);
            }
            t.mock.timers.tick(60_000);
            assert.equal(kill.mock.callCount(), 0);
        });
    }
    test('waits for child completion and preserves the process timeout error', async () => {
        const error = Object.assign(new Error('Command timed out'), {
            killed: true,
            signal: 'SIGTERM',
            code: null,
        });
        const result = fetcher.fetchURL('https://example.com/');
        await rendererLaunched;
        assert.equal(options.timeout, 60_000);
        let settled = false;
        void result.then(() => { settled = true; }, () => { settled = true; });
        await new Promise((resolve) => { setImmediate(resolve); });
        assert.equal(settled, false);
        finish(error, '<html>Partial</html>', '');
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
//# sourceMappingURL=website-fetcher-lightpanda.test.js.map