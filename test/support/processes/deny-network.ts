import net from 'node:net';

// This module refuses each outbound connection and reports the attempt. The test server and command processes load it
// with --import, the hosted live setup test loads it with --import into the process that runs the live gate file, and
// a unit test imports it before its other imports. A test can name the port of its own loopback double in
// THERMUS_TEST_LOOPBACK_PORT: then a connection to 127.0.0.1 on that port goes through, and each other connection
// stays refused.
const permittedPort = Number(process.env.THERMUS_TEST_LOOPBACK_PORT || Number.NaN);
const connect = net.Socket.prototype.connect;

function refuse(through: string): never {
  process.stderr.write(`Outbound network access attempted through ${through}\n`);
  throw new Error('Outbound network access is not allowed');
}

// net.connect gives its normalized arguments as one array, and tls.connect gives one options object.
function permitted(args: readonly unknown[]): boolean {
  const target: unknown = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (typeof target !== 'object' || target === null) return false;
  const { host, port } = target as { readonly host?: unknown; readonly port?: unknown };
  return host === '127.0.0.1' && Number(port) === permittedPort;
}

globalThis.fetch = async () => refuse('fetch');
net.Socket.prototype.connect = function permittedConnect(this: net.Socket, ...args: unknown[]): net.Socket {
  return permitted(args) ? Reflect.apply(connect, this, args) as net.Socket : refuse('a socket');
} as typeof net.Socket.prototype.connect;
