import assert from 'node:assert/strict';
import childProcess, {} from 'node:child_process';
import dns from 'node:dns/promises';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.js';
import { WebsiteFetchHttpError } from '../../../src/website-fetcher/website-fetcher.js';
const url = 'https://example.com/';
function output(status, error) {
    return JSON.stringify({ url, http_status: status, content: '<html>Challenge page</html>', error });
}
function stubProcess(context, error, stdout) {
    context.mock.property(process, 'env', { ...process.env, LIGHTPANDA_BIN: '' });
    context.mock.method(childProcess, 'execFile', (...args) => {
        const callback = args.at(-1);
        assert.ok(typeof callback === 'function');
        callback(error, stdout, '');
        return new childProcess.ChildProcess();
    });
    context.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }]);
    syncBuiltinESMExports();
    context.after(() => {
        context.mock.restoreAll();
        syncBuiltinESMExports();
    });
}
for (const [status, rendererError] of [[403, 'BotChallenge'], [429, 'BotChallenge'], [500, 'ServerError']]) {
    test(`classifies renderer error ${rendererError} with HTTP ${status} as an HTTP failure`, async (context) => {
        const cause = Object.assign(new Error(`renderer rejected HTTP ${status}`), { code: 1 });
        stubProcess(context, cause, output(status, rendererError));
        await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => {
            assert.ok(error instanceof WebsiteFetchHttpError);
            assert.equal(error.kind, 'http');
            assert.equal(error.status, status);
            assert.equal(error.cause, cause);
            return true;
        });
    });
}
for (const code of ['ENOENT', 'EACCES']) {
    test(`preserves launch error ${code} when output contains a failed HTTP status`, async (context) => {
        const cause = Object.assign(new Error(`spawn lightpanda ${code}`), { code });
        stubProcess(context, cause, output(500, 'ServerError'));
        await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => {
            if (code === 'ENOENT') {
                assert.ok(error instanceof Error);
                assert.ok(!(error instanceof WebsiteFetchHttpError));
                assert.equal(error.message, 'Lightpanda executable "lightpanda" was not found. See docs/lightpanda-runtime.md for setup.');
                assert.equal(error.cause, cause);
            }
            else {
                assert.equal(error, cause);
            }
            return true;
        });
    });
}
test('preserves a signaled process with a numeric exit code and failed HTTP status', async (context) => {
    const cause = Object.assign(new Error('renderer terminated by signal'), {
        code: 1, signal: 'SIGTERM', killed: false,
    });
    stubProcess(context, cause, output(500, 'ServerError'));
    await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => error === cause);
});
test('preserves a non-HTTP process error when renderer metadata is invalid', async (context) => {
    const cause = Object.assign(new Error('renderer failed before producing metadata'), { code: 1 });
    stubProcess(context, cause, '{invalid JSON');
    await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => error === cause);
});
//# sourceMappingURL=website-fetcher-http-errors.test.js.map