import { once } from 'node:events';
import { createServer, STATUS_CODES } from 'node:http';
import { Readable } from 'node:stream';
export const CLIENT_ADDRESS_HEADER = 'x-magumagu-client-address';
// In the absolute form, "*", "//", "\", or "#", a URL parser can find another host or a fragment.
const ORIGIN_FORM_TARGET = /^\/(?!\/)[^\\#]*$/;
const DEFAULT_SHUTDOWN_GRACE_MS = 5_000;
export async function startHttpServer(handler, options) {
    const bridge = { handler, publicOrigin: new URL(options.publicBaseUrl).origin, logger: options.logger };
    const server = createServer((incoming, outgoing) => {
        // After close(), Node keeps a finished keep-alive connection open until its timeout.
        outgoing.once('finish', () => {
            if (!server.listening)
                server.closeIdleConnections();
        });
        void serve(bridge, incoming, outgoing);
    });
    server.listen({ host: options.listen.host, port: options.listen.port });
    await once(server, 'listening');
    const url = listenUrlOrClose(server);
    let closing;
    return {
        url,
        close: () => (closing ??= closeServer(server, options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS)),
    };
}
function listenUrlOrClose(server) {
    const { address, port } = server.address();
    const host = address.includes(':') ? `[${address}]` : address;
    try {
        return new URL(`http://${host}:${port}/`);
    }
    catch (error) {
        server.close();
        throw error;
    }
}
async function closeServer(server, graceMs) {
    const closed = new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    const deadline = setTimeout(() => server.closeAllConnections(), graceMs);
    try {
        await closed;
    }
    finally {
        clearTimeout(deadline);
    }
}
async function serve(bridge, incoming, outgoing) {
    const target = incoming.url ?? '';
    if (!ORIGIN_FORM_TARGET.test(target))
        return sendStatus(outgoing, 400);
    // Node accepts the TRACE method, but a Fetch Request cannot have it.
    if (incoming.method === 'TRACE')
        return sendStatus(outgoing, 501);
    const url = new URL(`${bridge.publicOrigin}${target}`);
    const disconnected = new AbortController();
    outgoing.once('close', () => {
        if (!outgoing.writableFinished)
            disconnected.abort();
    });
    try {
        const response = await bridge.handler(fetchRequest(incoming, url, disconnected.signal));
        await sendResponse(response, outgoing, incoming.method);
    }
    catch (error) {
        // The message has no error text, because that text can contain request data.
        bridge.logger?.error(`The HTTP handler failed for ${incoming.method} ${url.pathname}: ${errorName(error)}`);
        sendFailure(outgoing);
    }
}
function fetchRequest(incoming, url, signal) {
    const method = incoming.method ?? 'GET';
    const body = method === 'GET' || method === 'HEAD' ? {} : { body: requestBody(incoming), duplex: 'half' };
    return new Request(url, { method, headers: requestHeaders(incoming), signal, ...body });
}
// set() replaces every client copy, so the handler can trust the socket address.
function requestHeaders(incoming) {
    const headers = new Headers();
    const raw = incoming.rawHeaders;
    for (let index = 0; index < raw.length; index += 2)
        headers.append(raw[index], raw[index + 1]);
    headers.set(CLIENT_ADDRESS_HEADER, incoming.socket.remoteAddress ?? '');
    return headers;
}
// With no high-water mark, Node can discard a body that the handler does not read, so the connection stays usable.
function requestBody(incoming) {
    return Readable.toWeb(incoming, { strategy: { highWaterMark: 0 } });
}
// A flat header list keeps each Set-Cookie header separate.
async function sendResponse(response, outgoing, method) {
    const statusText = response.statusText === '' ? undefined : response.statusText;
    outgoing.writeHead(response.status, statusText, [...response.headers].flat());
    const body = response.body;
    if (body === null || method === 'HEAD' || outgoing.destroyed) {
        outgoing.end();
        await body?.cancel();
        return;
    }
    // A streamed body, such as Server-Sent Events, can send its first chunk much later.
    outgoing.flushHeaders();
    await sendBody(body.getReader(), outgoing);
}
// Cancelling the body when the connection closes lets an endless stream stop its work.
async function sendBody(reader, outgoing) {
    const cancel = () => {
        // A failed cancel has no client to report to.
        reader.cancel().catch(() => undefined);
    };
    outgoing.once('close', cancel);
    try {
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
            if (!outgoing.write(chunk.value))
                await drainedOrClosed(outgoing);
        }
    }
    finally {
        outgoing.off('close', cancel);
    }
    outgoing.end();
}
function drainedOrClosed(outgoing) {
    return new Promise((resolve) => {
        const settle = () => {
            outgoing.off('drain', settle).off('close', settle);
            resolve();
        };
        outgoing.on('drain', settle).on('close', settle);
    });
}
// After the headers are sent, only an ended connection can tell the client that the response failed.
function sendFailure(outgoing) {
    if (outgoing.headersSent)
        outgoing.destroy();
    else
        sendStatus(outgoing, 500);
}
function sendStatus(outgoing, status) {
    const text = STATUS_CODES[status] ?? '';
    outgoing.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
    outgoing.end(text);
}
function errorName(error) {
    return error instanceof Error ? error.name : 'unknown error';
}
//# sourceMappingURL=server.js.map