import { appendFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import type { TLSSocket } from 'node:tls';

const server = createServer({
  key: readFileSync('/fixture/server.key'), cert: readFileSync('/fixture/server.crt'),
}, async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const socket = request.socket as TLSSocket;
  appendFileSync('/fixture/requests.ndjson', `${JSON.stringify({
    method: request.method, path: request.url, headers: request.headers,
    body: Buffer.concat(chunks).toString('utf8'), localAddress: socket.localAddress,
    servername: socket.servername,
  })}\n`);
  if (request.url === '/hold') return;
  if (request.url === '/redirect') {
    response.writeHead(307, { Location: 'https://collector.audit.test:4318/redirect-target' });
    response.end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end('{}');
});
server.listen(4318, '0.0.0.0', () => process.stdout.write('Audit TLS receiver ready\n'));
