import type { FetchLike } from '@modelcontextprotocol/client';

// A fetch for one MCP client that records each request as the client sends it: the HTTP method, the JSON-RPC
// message, the answer status, and how the answer stream ended at the client. It also keeps the errors that the client
// reports. Times are performance.now() values of this process, the clock of the other parts.
interface StreamEnd { readonly at: number; readonly how: 'ended' | 'aborted' | 'cancelled' }
interface RpcMessage { readonly id?: unknown; readonly method?: unknown; readonly params?: { readonly [key: string]: unknown } }
export interface WireRequest {
  readonly httpMethod: string;
  readonly message: RpcMessage | undefined;
  readonly sentAt: number;
  status?: number;
  answeredAt?: number;
  streamEnd?: StreamEnd;
}
interface ClientError { readonly at: number; readonly message: string }
export interface WireTap {
  readonly requests: WireRequest[];
  readonly errors: ClientError[];
  readonly fetch: FetchLike;
  recordError(error: Error): void;
}

export function wireTap(): WireTap {
  const requests: WireRequest[] = [];
  const errors: ClientError[] = [];
  const tapFetch: FetchLike = async (url, init) => {
    const request: WireRequest = { httpMethod: init?.method ?? 'GET', message: rpcMessageOf(init?.body), sentAt: performance.now() };
    requests.push(request);
    const response = await fetch(url, init);
    request.status = response.status;
    request.answeredAt = performance.now();
    return observed(response, request);
  };
  return { requests, errors, fetch: tapFetch, recordError: (error) => { errors.push({ at: performance.now(), message: error.message }); } };
}

function rpcMessageOf(body: unknown): RpcMessage | undefined {
  if (typeof body !== 'string') return undefined;
  try {
    const value: unknown = JSON.parse(body);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as RpcMessage : undefined;
  } catch {
    return undefined;
  }
}

// The same answer, with a body that notes when the stream of the answer ends, fails, or is cancelled by the client.
function observed(response: Response, request: WireRequest): Response {
  const body = response.body;
  if (body === null) {
    request.streamEnd = { at: performance.now(), how: 'ended' };
    return response;
  }
  const reader = body.getReader();
  const end = (how: StreamEnd['how']): void => { request.streamEnd ??= { at: performance.now(), how }; };
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          end('ended');
          controller.close();
        } else controller.enqueue(chunk.value);
      } catch (error) {
        end('aborted');
        controller.error(error);
      }
    },
    cancel(reason) {
      end('cancelled');
      return reader.cancel(reason);
    },
  });
  return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
}
