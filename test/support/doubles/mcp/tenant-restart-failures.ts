import type { IncomingMessage, ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

// The failures of a tenant container that restarts: Render answers 502, or the connection resets before or after the
// first answer byte (record SO-01e).
export type UpstreamFailure = 'http-502' | 'reset-before-answer' | 'reset-after-start';

// Answers one request of the fake tenant as a restarted container does, after its body. A reset after the start
// first sends one progress notification, so the answer stream of the gateway has started.
export async function failAsRestart(failure: UpstreamFailure, incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
  for await (const _chunk of incoming) { /* The failure comes after the request body. */ }
  if (failure === 'http-502') {
    outgoing.writeHead(502, { 'Content-Type': 'text/html' }).end('<html><body>Bad Gateway</body></html>');
  } else if (failure === 'reset-before-answer') {
    incoming.socket.destroy();
  } else {
    outgoing.writeHead(200, { 'Content-Type': 'text/event-stream' });
    outgoing.write('event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progressToken":1,"progress":1}}\n\n');
    await delay(50);
    incoming.socket.destroy();
  }
}
