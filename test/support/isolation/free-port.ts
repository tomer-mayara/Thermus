import { once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';

// A loopback port that is free at the call, for a process that must know its own address before it starts, such as a
// control plane whose CONTROL_PLANE_INTERNAL_URL names it. Another program can take the port before the process
// listens; then the process stops with EADDRINUSE and the test fails without a wrong result.
export async function freeLoopbackPort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  server.close();
  await once(server, 'close');
  return port;
}
