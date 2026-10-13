import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import dns from 'node:dns/promises';
import { createServer } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import {} from 'node:test';
export async function startFixture(t, handler, host = '127.0.0.1') {
    const requests = [];
    let connections = 0;
    const server = createServer((request, response) => {
        requests.push(request.url ?? '/');
        handler(request, response);
    });
    server.on('connection', () => { connections += 1; });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen({ host, port: 0, ipv6Only: true }, resolve);
    });
    t.after(async () => {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return {
        origin: `http://${host.includes(':') ? `[${host}]` : host}:${address.port}`,
        hostnameOrigin: `http://localhost:${address.port}`,
        requests,
        get connections() { return connections; },
    };
}
export function resolveAsPublic(t) {
    t.mock.method(dns, 'lookup', async (hostname) => {
        assert.equal(hostname, 'localhost');
        return [{ address: '1.1.1.1', family: 4 }];
    });
}
export function permitIPv4Fixture(t) {
    resolveAsPublic(t);
    const execute = childProcess.execFile;
    const executable = process.env.LIGHTPANDA_BIN || 'lightpanda';
    t.mock.method(childProcess, 'execFile', (...args) => {
        assert.equal(args[0], executable);
        const command = [...(args[1] ?? [])];
        const url = command.pop();
        assert.ok(url && url.startsWith('http://localhost:'));
        command.push('--block-cidrs', '-127.0.0.1/32', url);
        return execute(args[0], command, {
            ...args[2],
            env: { ...process.env, LIGHTPANDA_DISABLE_TELEMETRY: 'true' },
        }, args[3]);
    });
    syncBuiltinESMExports();
    t.after(() => {
        t.mock.restoreAll();
        syncBuiltinESMExports();
    });
}
//# sourceMappingURL=network-fixture.js.map