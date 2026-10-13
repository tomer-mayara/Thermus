import net from 'node:net';

// Loaded with --import before a command, this module refuses each outbound connection and reports the attempt.
function refuse(through: string): never {
  process.stderr.write(`Outbound network access attempted through ${through}\n`);
  throw new Error('Outbound network access is not allowed');
}

globalThis.fetch = async () => refuse('fetch');
net.Socket.prototype.connect = function connect(): never {
  return refuse('a socket');
};
