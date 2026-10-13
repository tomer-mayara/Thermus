import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
const serverEntry = fileURLToPath(new URL('../../src/index.js', import.meta.url));
// The server runs with outbound access denied: each attempt fails and writes a line that a test can find.
const networkBlocker = new URL('./deny-network.js', import.meta.url).href;
const listeningLine = /Listening on (http:\/\/\S+)/;
const outboundAttempt = /Outbound network access attempted/;
const tenantLine = /tenant (local:[0-9a-f-]+)/;
export class ServerProcess {
    child;
    exit;
    listening = Promise.withResolvers();
    text = '';
    constructor(settings, args) {
        this.child = spawn(process.execPath, ['--import', networkBlocker, serverEntry, ...args], { env: { ...settings }, stdio: ['ignore', 'pipe', 'pipe'] });
        this.exit = once(this.child, 'exit').then(([code, signal]) => ({ code, signal }));
        for (const stream of [this.child.stdout, this.child.stderr]) {
            stream.setEncoding('utf8').on('data', (chunk) => this.record(chunk));
        }
    }
    static launch(t, settings, args = []) {
        const server = new ServerProcess(settings, args);
        t.after(() => server.kill());
        return server;
    }
    static async start(t, settings) {
        const server = ServerProcess.launch(t, settings);
        await server.started();
        return server;
    }
    get output() {
        return this.text;
    }
    get attemptedOutboundAccess() {
        return outboundAttempt.test(this.text);
    }
    async started() {
        const url = await this.listeningOrExit();
        assert.ok(url, `The server stopped before it listened:\n${this.text}`);
        return url;
    }
    async listeningOrExit() {
        return Promise.race([this.listening.promise, this.exit.then(() => undefined)]);
    }
    tenant() {
        const tenant = tenantLine.exec(this.text)?.[1];
        assert.ok(tenant, `The server reported no local tenant:\n${this.text}`);
        return tenant;
    }
    async request(path, init = {}) {
        return fetch(new URL(path, await this.started()), init);
    }
    async stop() {
        this.child.kill('SIGTERM');
        return this.exit;
    }
    async exited() {
        return this.exit;
    }
    record(chunk) {
        this.text += chunk;
        const address = listeningLine.exec(this.text)?.[1];
        if (address !== undefined)
            this.listening.resolve(new URL(address));
    }
    kill() {
        if (this.child.exitCode === null && this.child.signalCode === null)
            this.child.kill('SIGKILL');
    }
}
//# sourceMappingURL=server-process.js.map