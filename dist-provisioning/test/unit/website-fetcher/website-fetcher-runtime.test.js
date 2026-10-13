import assert from 'node:assert/strict';
import childProcess, {} from 'node:child_process';
import dns from 'node:dns/promises';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.js';
const url = 'https://example.com/';
const html = '<html>Configured runtime</html>';
function stubRuntime(t, configured, cause = null) {
    const environment = { ...process.env };
    if (configured === undefined)
        delete environment.LIGHTPANDA_BIN;
    else
        environment.LIGHTPANDA_BIN = configured;
    t.mock.property(process, 'env', environment);
    t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
    const execute = t.mock.method(childProcess, 'execFile', (...args) => {
        args[3]?.(cause, JSON.stringify({ url, http_status: 200, content: html, error: null }), '');
        return new childProcess.ChildProcess();
    });
    syncBuiltinESMExports();
    t.after(() => {
        t.mock.restoreAll();
        syncBuiltinESMExports();
    });
    return execute;
}
for (const executable of ['/opt/lightpanda/lightpanda', '/opt/Lightpanda runtime/lightpanda;echo unexpected']) {
    test(`Given LIGHTPANDA_BIN is ${executable}, when fetching, then it runs that executable directly`, async (t) => {
        const execute = stubRuntime(t, executable);
        assert.deepEqual(await new WebsiteFetcherLightpanda().fetchURL(url), { requestedUrl: url, finalUrl: url, html });
        assert.equal(execute.mock.callCount(), 1);
        const [command, args, options] = execute.mock.calls[0].arguments;
        assert.equal(command, executable);
        assert.equal(options?.shell, undefined);
        assert.equal(args?.at(-1), url);
    });
}
for (const configured of [undefined, '']) {
    test(`Given LIGHTPANDA_BIN is ${String(configured)}, when fetching, then it uses lightpanda on PATH`, async (t) => {
        const execute = stubRuntime(t, configured);
        await new WebsiteFetcherLightpanda().fetchURL(url);
        assert.equal(execute.mock.callCount(), 1);
        assert.equal(execute.mock.calls[0].arguments[0], 'lightpanda');
    });
}
for (const executable of ['lightpanda', '/opt/Missing runtime/lightpanda']) {
    test(`Given ${executable} is missing, when fetching, then the error identifies it and the setup guide`, async (t) => {
        const cause = Object.assign(new Error(`spawn ${executable} ENOENT`), { code: 'ENOENT' });
        const execute = stubRuntime(t, executable, cause);
        await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /Lightpanda/);
            assert.ok(error.message.includes(executable));
            assert.ok(error.message.includes('docs/lightpanda-runtime.md'));
            assert.equal(error.cause, cause);
            return true;
        });
        assert.equal(execute.mock.callCount(), 1);
    });
}
test('Given the host is offline, when the configured runtime fails to connect, then it preserves the failure', async (t) => {
    const executable = '/opt/Lightpanda runtime/lightpanda';
    const cause = Object.assign(new Error('Network is unreachable'), { code: 1 });
    const execute = stubRuntime(t, executable, cause);
    await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => error === cause);
    assert.equal(execute.mock.callCount(), 1);
    assert.equal(execute.mock.calls[0].arguments[0], executable);
});
//# sourceMappingURL=website-fetcher-runtime.test.js.map