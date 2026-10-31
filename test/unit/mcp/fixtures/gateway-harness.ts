import type { TestContext } from 'node:test';
import type { RequestContext } from '../../../../src/accounts/identity/access-context.ts';
import type { AccessContextClaims } from '../../../../src/accounts/identity/signed-access-context.ts';
import { McpGateway } from '../../../../src/interfaces/mcp/mcp-gateway.ts';
import type { GatewayResume, GatewayRoute, GatewayTenantRequest } from '../../../../src/interfaces/mcp/mcp-gateway-tenants.ts';
import type { McpForwardedRequest } from '../../../../src/interfaces/mcp/mcp-server.ts';
import { OperatorLogSpy } from '../../../support/doubles/application/operator-log-spy.ts';

export const organizationId = 'org_A';
export const internalUrl = 'http://thermus-tenant-org-a:8080';
export const context: RequestContext = Object.freeze({
  user: Object.freeze({ authority: 'workos:client_A', subject: 'user_A', name: 'Ann', selectedOrganizationId: organizationId }),
  tenantId: `workos:client_A:${organizationId}`,
  organizationId,
  grants: Object.freeze([Object.freeze({ role: 'user', permissions: Object.freeze(['product:access']) })]),
  permissions: Object.freeze(['product:access']),
});
export const fetchCall = { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'getURLAsMarkdown', arguments: { url: 'https://source.example/', reason: 'Read it' } } };

interface UpstreamCall {
  readonly url: string;
  readonly init: RequestInit;
}

export function gatewayOf(t: TestContext, route: GatewayRoute = { status: 'found', state: 'live', internalUrl }) {
  const log = new OperatorLogSpy();
  const signed: Array<{ readonly claims: AccessContextClaims; readonly token: string }> = [];
  const registry = {
    route,
    request: { status: 'requested' } as GatewayTenantRequest,
    resume: { status: 'sent' } as GatewayResume,
    finds: [] as string[],
    requests: [] as string[],
    resumes: [] as string[],
    active: [] as string[],
  };
  const tenants = {
    find: async (organization: string) => { registry.finds.push(organization); return registry.route; },
    request: async (organization: string) => { registry.requests.push(organization); return registry.request; },
    resume: async (organization: string) => { registry.resumes.push(organization); return registry.resume; },
    recordActive: (organization: string) => { registry.active.push(organization); },
  };
  const signer = { sign: async (claims: AccessContextClaims, token: string) => { signed.push({ claims, token }); return `signed-context-${signed.length}`; } };
  const calls: UpstreamCall[] = [];
  const upstream = { answer: async (_call: UpstreamCall): Promise<Response> => Response.json({ jsonrpc: '2.0', id: 7, result: { content: [] } }) };
  t.mock.method(globalThis, 'fetch', (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return upstream.answer(call);
  }) as typeof fetch);
  const gateway = new McpGateway({ signer, tenants, logger: log });
  const tracked: Array<Promise<unknown>> = [];
  const forward = (request: Request, signal: AbortSignal = new AbortController().signal) => {
    const forwarded: McpForwardedRequest = { context, bearerToken: 'connect-token', lifetime: { signal, track: (task) => { tracked.push(task); return task; } } };
    return gateway.forward(request, forwarded);
  };
  return { gateway, log, signed, registry, calls, upstream, forward, tracked };
}

export function post(body: unknown, headers: Record<string, string> = {}, path = '/mcp'): Request {
  return new Request(`https://thermus.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer connect-token', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export async function refusalOf(response: Response) {
  return { status: response.status, retryAfter: response.headers.get('Retry-After'), body: await response.json() as Record<string, unknown> };
}

export function controlledBody() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const cancelled = Promise.withResolvers<unknown>();
  const body = new ReadableStream<Uint8Array>({ start(started) { controller = started; }, cancel(reason) { cancelled.resolve(reason); } });
  return {
    body,
    cancelled: cancelled.promise,
    send: (text: string) => controller?.enqueue(new TextEncoder().encode(text)),
    end: () => { try { controller?.close(); } catch { /* The test ended this body before. */ } },
    fail: () => controller?.error(new TypeError('terminated')),
  };
}
