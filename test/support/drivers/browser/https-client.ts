import { request as httpsRequest } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';

interface HttpsExchange {
  readonly request: ClientRequest;
  readonly response: Promise<IncomingMessage>;
}

// Each request trusts the site's certificate and has its own connection.
export async function sendHttpsRequest(input: Request, ca: Buffer): Promise<HttpsExchange> {
  const body = input.body === null ? undefined : Buffer.from(await input.arrayBuffer());
  const response = Promise.withResolvers<IncomingMessage>();
  const request = httpsRequest(new URL(input.url), {
    method: input.method, headers: Object.fromEntries(input.headers), ca, agent: false,
  }, response.resolve);
  request.once('error', response.reject).end(body);
  return { request, response: response.promise };
}
