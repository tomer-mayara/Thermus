import net from 'node:net';

// This module refuses each outbound connection and reports the attempt. The test server and command processes load it
// with --import, the hosted live setup test loads it with --import into the process that runs the live gate file, and
// a unit test imports it before its other imports.
function refuse(through: string): never {
  process.stderr.write(`Outbound network access attempted through ${through}\n`);
  throw new Error('Outbound network access is not allowed');
}

globalThis.fetch = async () => refuse('fetch');
net.Socket.prototype.connect = function connect(): never {
  return refuse('a socket');
};
