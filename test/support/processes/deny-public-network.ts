import net from 'node:net';

// The loopback form of deny-network.ts for the processes of one test that talk to each other on 127.0.0.1, such as
// the control plane and a tenant. It refuses each other outbound connection and reports the attempt with the same
// line, so a test still finds each public connection. It keeps the fetch of Node, which connects through net.
const loopbackHosts = new Set(['127.0.0.1', '::1', 'localhost']);
const connect = net.Socket.prototype.connect;

function hostOf(args: readonly unknown[]): string | undefined {
  const [first, second] = args;
  if (typeof first === 'object' && first !== null) {
    const options = first as { readonly host?: unknown; readonly path?: unknown };
    if (typeof options.path === 'string') return 'localhost';
    return typeof options.host === 'string' ? options.host : 'localhost';
  }
  return typeof second === 'string' ? second : 'localhost';
}

net.Socket.prototype.connect = function connectLoopback(this: net.Socket, ...args: unknown[]): net.Socket {
  const host = hostOf(args);
  if (host === undefined || !loopbackHosts.has(host)) {
    process.stderr.write('Outbound network access attempted through a socket\n');
    throw new Error('Outbound network access is not allowed');
  }
  return (connect as (...parameters: unknown[]) => net.Socket).apply(this, args);
} as typeof net.Socket.prototype.connect;
