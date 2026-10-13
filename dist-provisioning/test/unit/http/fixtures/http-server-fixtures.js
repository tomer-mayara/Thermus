import assert from 'node:assert/strict';
import { once } from 'node:events';
import { connect } from 'node:net';
import { startHttpServer } from '../../../../src/http/server.js';
export const loopback = { host: '127.0.0.1', port: 0 };
export const publicBaseUrl = 'http://localhost:8080/';
export async function serve(t, handler, options = {}) {
    const server = await startHttpServer(handler, { listen: loopback, publicBaseUrl, shutdownGraceMs: 200, ...options });
    t.after(() => server.close(), { timeout: 2_000 });
    return server;
}
export function serverHandles() {
    return process.getActiveResourcesInfo().filter((resource) => resource === 'TCPServerWrap').length;
}
// fetch normalizes the request target and sets its own Host header, so these
// tests write raw HTTP/1.1 requests.
export class RawConnection {
    text = '';
    socket;
    ended;
    constructor(socket) {
        this.socket = socket;
        socket.setEncoding('latin1');
        socket.on('data', (chunk) => {
            this.text += chunk;
        });
        // The tests check when the connection ends, not why it ends.
        socket.on('error', () => undefined);
        this.ended = new Promise((resolve) => socket.once('close', () => resolve(this.text)));
    }
    static open(t, server) {
        const socket = connect(Number(server.url.port), server.url.hostname);
        t.after(() => socket.destroy());
        return new RawConnection(socket);
    }
    send(head, body = '') {
        this.socket.write(`${head.join('\r\n')}\r\n\r\n${body}`);
        return this;
    }
    async received(part) {
        while (!this.text.includes(part))
            await once(this.socket, 'data');
        return this.text;
    }
    disconnect() {
        this.socket.destroy();
    }
}
export function encoded(text) {
    return new TextEncoder().encode(text);
}
export function decoded(bytes) {
    return new TextDecoder().decode(bytes);
}
export function bodyReader(response) {
    assert.ok(response.body, 'The response has no body.');
    return response.body.getReader();
}
export async function connectionError(server) {
    const socket = connect(Number(server.url.port), server.url.hostname);
    const [error] = await once(socket, 'error');
    return error;
}
export function recordUrls(urls) {
    return async (request) => {
        urls.push(request.url);
        return new Response('ok');
    };
}
//# sourceMappingURL=http-server-fixtures.js.map