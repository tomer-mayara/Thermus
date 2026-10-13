import assert from 'node:assert/strict';
import childProcess, {} from 'node:child_process';
import dns from 'node:dns/promises';
import { syncBuiltinESMExports } from 'node:module';
import { describe, test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.js';
import { WebsiteFetchHttpError } from '../../../src/website-fetcher/website-fetcher.js';
const url = 'https://example.com/';
const html = '<html><body>Rendered page</body></html>';
function output(status = 200, content = html) {
    return JSON.stringify({ url, http_status: status, content, error: null });
}
function stubProcess(context, result) {
    context.mock.property(process, 'env', { ...process.env, LIGHTPANDA_BIN: '' });
    const stub = context.mock.method(childProcess, 'execFile', (...args) => {
        const callback = args.at(-1);
        assert.ok(typeof callback === 'function');
        callback(result.error ?? null, result.stdout ?? '', '');
        return new childProcess.ChildProcess();
    });
    context.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }]);
    syncBuiltinESMExports();
    context.after(() => {
        context.mock.restoreAll();
        syncBuiltinESMExports();
    });
    return stub;
}
describe('WebsiteFetcherLightpanda process contract', () => {
    test('returns rendered HTML and requests HTTP failure metadata', async (context) => {
        const process = stubProcess(context, { stdout: output() });
        assert.deepEqual(await new WebsiteFetcherLightpanda().fetchURL(url), {
            html, requestedUrl: url, finalUrl: url,
        });
        const [executable, args, options] = process.mock.calls[0].arguments;
        assert.equal(executable, 'lightpanda');
        assert.ok(args?.includes('--json'));
        assert.ok(args?.includes('--fail-on-http-error'));
        assert.equal(args?.at(-1), url);
        assert.equal(options?.encoding, 'utf8');
    });
    for (const status of [403, 404, 429, 500]) {
        for (const exitCode of [0, 22]) {
            test(`rejects HTTP ${status} content with process exit ${exitCode}`, async (context) => {
                const cause = exitCode === 0 ? undefined : Object.assign(new Error('HTTP failure'), { code: exitCode });
                stubProcess(context, { error: cause, stdout: output(status, '<html>Error page</html>') });
                await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => {
                    assert.ok(error instanceof WebsiteFetchHttpError);
                    assert.equal(error.kind, 'http');
                    assert.equal(error.status, status);
                    assert.equal(error.cause, cause);
                    assert.match(error.message, new RegExp(`HTTP.*${status}`));
                    return true;
                });
            });
        }
    }
    test('keeps an HTTP failure when status metadata is unavailable', async (context) => {
        const cause = Object.assign(new Error('HTTP failure'), { code: 22 });
        stubProcess(context, { error: cause });
        await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), {
            name: 'WebsiteFetchHttpError', kind: 'http', status: undefined, cause,
        });
    });
    test('preserves the missing executable cause', async (context) => {
        const cause = Object.assign(new Error('spawn lightpanda ENOENT'), { code: 'ENOENT' });
        stubProcess(context, { error: cause });
        await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), {
            name: 'Error', message: 'Lightpanda executable "lightpanda" was not found. See docs/lightpanda-runtime.md for setup.', cause,
        });
    });
    for (const code of [1, 22]) {
        test(`preserves a timeout with exit ${code} even when partial output contains an HTTP failure`, async (context) => {
            const cause = Object.assign(new Error('process timed out'), { code, killed: true, signal: 'SIGTERM' });
            stubProcess(context, { error: cause, stdout: output(500) });
            await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => error === cause);
        });
    }
    test('preserves other nonzero process exits', async (context) => {
        const cause = Object.assign(new Error('navigation failed'), { code: 1 });
        stubProcess(context, { error: cause, stdout: output(200) });
        await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => error === cause);
    });
    for (const [stdout, message] of [
        ['<html>Unstructured output</html>', 'lightpanda returned invalid fetch metadata'],
        ['null', 'lightpanda returned invalid fetch metadata'],
        ['{}', 'lightpanda did not return successful HTML'],
        [JSON.stringify({ url, content: html, error: null }), 'lightpanda did not return successful HTML'],
        [
            JSON.stringify({ url, http_status: 0, content: html, error: 'CouldntConnect' }),
            'lightpanda did not return successful HTML',
        ],
        [
            JSON.stringify({ url, http_status: 200, content: html, error: 'WaitTimeout' }),
            'lightpanda did not return successful HTML',
        ],
        [JSON.stringify({ url, http_status: 200, error: null }), 'lightpanda did not return successful HTML'],
    ]) {
        test(`rejects an invalid renderer result: ${stdout}`, async (context) => {
            stubProcess(context, { stdout });
            await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => {
                assert.ok(error instanceof Error);
                assert.ok(!(error instanceof WebsiteFetchHttpError));
                assert.equal(error.message, message);
                return true;
            });
        });
    }
    test('rejects unsupported URL protocols before starting a process', async (context) => {
        const process = stubProcess(context, { stdout: output() });
        await assert.rejects(new WebsiteFetcherLightpanda().fetchURL('file:///tmp/page.html'), /http or https/);
        assert.equal(process.mock.callCount(), 0);
    });
});
test('keeps the exact requested URL and the final URL after a redirect', async (context) => {
    const requestedUrl = 'https://EXAMPLE.com:443/redirect?source=original#part';
    const finalUrl = 'https://destination.example/directory/page?key=value';
    const process = stubProcess(context, {
        stdout: JSON.stringify({ url: finalUrl, http_status: 200, content: html, error: null }),
    });
    assert.deepEqual(await new WebsiteFetcherLightpanda().fetchURL(requestedUrl), {
        html, requestedUrl, finalUrl,
    });
    assert.equal(process.mock.callCount(), 1);
    const args = process.mock.calls[0].arguments[1];
    assert.ok(args);
    assert.ok(args.includes('--block-private-networks'));
    assert.ok(args.includes('--block-cidrs'));
    assert.ok(args.includes('--http-proxy'));
    assert.equal(args[args.indexOf('--http-proxy') + 1], '');
    assert.equal(args.at(-1), new URL(requestedUrl).href);
});
test('keeps an empty HTML result', async (context) => {
    stubProcess(context, { stdout: output(200, '') });
    assert.deepEqual(await new WebsiteFetcherLightpanda().fetchURL(url), {
        html: '', requestedUrl: url, finalUrl: url,
    });
});
for (const finalUrl of [undefined, '/relative', 'file:///tmp/page']) {
    test(`rejects an invalid final URL: ${finalUrl}`, async (context) => {
        stubProcess(context, {
            stdout: JSON.stringify({ url: finalUrl, http_status: 200, content: html, error: null }),
        });
        await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => {
            assert.ok(error instanceof Error);
            assert.ok(!(error instanceof WebsiteFetchHttpError));
            return true;
        });
    });
}
//# sourceMappingURL=website-fetcher.test.js.map