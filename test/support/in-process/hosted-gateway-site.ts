import { createPublicKey, randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { Application } from '../../../src/app/application.ts';
import { composeLoggingStorage } from '../../../src/app/logging-storage.ts';
import { gatewayTenantsOf } from '../../../src/app/mcp-gateway-composition.ts';
import { AuditLog, type AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { startHttpServer } from '../../../src/runtime/http/server.ts';
import { TenantActivity } from '../../../src/tenancy/tenants/tenant-activity.ts';
import { TenantLookup } from '../../../src/tenancy/tenants/tenant-lookup.ts';
import { TenantRequests } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { TenantResumes } from '../../../src/tenancy/tenants/tenant-resumes.ts';
import { OperatorLogSpy } from '../doubles/application/operator-log-spy.ts';
import { AuditExportSenderSpy } from '../doubles/logging/audit-export-sender-spy.ts';
import { SnapshotSettingsStoreSpy } from '../doubles/logging/snapshot-settings-store-spy.ts';
import { TenantUpstreamFake } from '../doubles/mcp/tenant-upstream-fake.ts';
import { TenantRegistryFake } from '../doubles/tenants/tenant-registry-fake.ts';
import { TenantResumeSpy } from '../doubles/tenants/tenant-resume-spy.ts';
import { WorkOSFake, type FakeUser } from '../doubles/workos/workos-fake.ts';
import { listenerTransport } from '../drivers/browser/hosted-browser.ts';
import { connectMcpClient } from '../drivers/mcp/mcp-sdk-client.ts';
import { httpRefusal, mcpRequest, rpcResult, type McpRequestOptions } from '../drivers/mcp/mcp-http-request.ts';
import type { McpProtocolEra } from '../drivers/mcp/mcp-protocol-eras.ts';
import { SignedContextGateway, type ContextChanges } from '../drivers/mcp/signed-context-gateway.ts';
import { hostedRootConfig } from '../fixtures/hosted-config.ts';
import { gatewayKeyPairOf } from '../fixtures/hosted-tenant.ts';
import { userGrant } from '../fixtures/hosted-roles.ts';
import { composeApplicationWithWorkOSFake } from './workos-site.ts';

export const gatewayOrganization = 'org_GATEWAY_A';
export const otherGatewayOrganization = 'org_GATEWAY_B';
export const gatewayUser: FakeUser = { id: 'user_GATEWAY_A', email: 'gateway-a@example.com', firstName: 'Gateway' };
const otherUser: FakeUser = { id: 'user_GATEWAY_B', email: 'gateway-b@example.com', firstName: 'Other' };

export interface HostedGatewaySiteOptions {
  // MCP_TENANTS_ENABLED of the composition. The default is on.
  readonly tenantsEnabled?: boolean;
  readonly freeTenantLimit?: number;
}

export interface WireExchange {
  readonly httpMethod: string;
  readonly rpcMethod: string | undefined;
  readonly status: number;
}

type PostOptions = Omit<McpRequestOptions, 'url'>;

export type HostedGatewaySite = Awaited<ReturnType<typeof openHostedGatewaySite>>;

export async function openHostedGatewaySite(t: TestContext, options: HostedGatewaySiteOptions = {}) {
  const config = hostedRootConfig;
  const world = await WorkOSFake.start(t, config.publicBaseUrl, [gatewayOrganization, otherGatewayOrganization]);
  world.users = [gatewayUser, otherUser];
  world.memberships = [
    { userId: gatewayUser.id, organizationId: gatewayOrganization, roles: ['user'] },
    { userId: otherUser.id, organizationId: otherGatewayOrganization, roles: ['user'] },
  ];
  const keys = gatewayKeyPairOf();
  const publicKey = createPublicKey(keys.publicKeyPem);
  const tenant = await TenantUpstreamFake.start(t, { publicKey, organizationId: gatewayOrganization });
  const registry = new TenantRegistryFake();
  const resume = new TenantResumeSpy();
  let now = 0;
  const clock = (): number => now;
  const settings = new SnapshotSettingsStoreSpy();
  const sender = new AuditExportSenderSpy();
  t.after(() => sender.attempts.forEach((attempt) => attempt.complete()));
  const storage = composeLoggingStorage({ store: settings, close: async () => { settings.close(); } }, Buffer.alloc(32, 7), sender);
  const log = new OperatorLogSpy();
  // The listener starts first, because its origin is the internal URL of the composition.
  const composed = Promise.withResolvers<Application>();
  const server = await startHttpServer(async (request) => (await composed.promise).handle(request), { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger: log });
  const internalUrl = server.url.origin;
  const gateway = options.tenantsEnabled === false ? undefined : {
    settings: { signingKey: keys.privateKey, verifyingKey: publicKey, controlPlaneInternalUrl: internalUrl },
    tenants: gatewayTenantsOf({
      lookup: new TenantLookup(registry, clock),
      requests: new TenantRequests(registry, options.freeTenantLimit ?? 25),
      resumes: new TenantResumes(registry, resume),
      activity: new TenantActivity(registry, clock),
    }),
  };
  const toolOperations = {
    fetch: async (url: string) => `Markdown of ${url} from the control plane`,
    search: async (query: string) => ({ status: 'released' as const, markdown: `Results for ${query} from the control plane` }),
  };
  const application = await composeApplicationWithWorkOSFake(config, world, { logger: log, toolOperations, loggingStorage: storage, gateway });
  composed.resolve(application);
  t.after(async () => { const draining = server.close(); await application.close(draining); });
  tenant.relayTo(internalUrl);
  const authority = `workos:${world.settings.clientId}`;
  const mcpUrl = new URL('mcp', server.url).href;
  const wire: WireExchange[] = [];
  const contexts = new SignedContextGateway(keys.privateKey, { authority, subject: gatewayUser.id, organizationId: gatewayOrganization, grants: [userGrant] });
  const tenantId = (organizationId: string = gatewayOrganization): string => `${authority}:${organizationId}`;
  const tokenOf = (user: FakeUser, organizationId: string) => (claims: Readonly<Record<string, unknown>> = {}): Promise<string> => world.connectToken(user, { org_id: organizationId, ...claims });
  const post = (request: PostOptions): Promise<Response> => fetch(mcpRequest({ url: mcpUrl, ...request }));

  return {
    config, world, tenant, registry, resume, sender, settings, log, authority, wire, tenantId,
    token: tokenOf(gatewayUser, gatewayOrganization),
    advance: (milliseconds: number): void => { now += milliseconds; },
    enableExport: (organizationId: string = gatewayOrganization) => storage.service.save(tenantId(organizationId), { expectedRevision: null, endpoint: 'https://collector.example/v1/logs', auth: 'none', token: '', enabled: true }),
    addTenant: async (organizationId: string) => {
      const other = await TenantUpstreamFake.start(t, { publicKey, organizationId });
      registry.live(organizationId, other.origin);
      return { tenant: other, token: tokenOf(otherUser, organizationId) };
    },
    connect: async (token: string, era: McpProtocolEra = '2026-07-28') => {
      const tap = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const response = await fetch(input, init);
        wire.push({ httpMethod: init?.method ?? 'GET', rpcMethod: rpcMethodOf(init?.body), status: response.status });
        return response;
      };
      const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: { token: async () => token }, fetch: tap });
      const client = await connectMcpClient(t, transport, { era, probe: era === '2026-07-28' });
      t.after(() => client.close());
      return client;
    },
    untilWire: async (match: (exchange: WireExchange) => boolean): Promise<void> => {
      while (!wire.some(match)) {
        t.signal.throwIfAborted();
        await setImmediate();
      }
    },
    post,
    toolResult: async (request: PostOptions) => rpcResult(await post(request)),
    refusal: async (request: PostOptions) => httpRefusal(await post(request)),
    // The request in the process, without a client: the client may send headers that the fetch of Node refuses.
    handle: (request: PostOptions): Promise<Response> => application.handle(mcpRequest({ url: config.mcpResourceUrl, ...request })),
    request: (path: string, init: RequestInit = {}): Promise<Response> => fetch(new URL(path, server.url), init),
    // A tenant relay to POST /internal/audit. The host is the internal service host unless the test gives another.
    relay: (event: unknown, context: string | undefined, target: { readonly host?: string; readonly path?: string } = {}): Promise<Response> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(context === undefined ? {} : { 'Thermus-Access': context }) };
      const address = new URL(target.path ?? '/internal/audit', target.host === undefined ? server.url : `http://${target.host}`);
      return listenerTransport(server.url)(new Request(address, { method: 'POST', headers, body: JSON.stringify(event) }));
    },
    contextFor: (changes: ContextChanges = {}): Promise<string> => contexts.contextFor('relay-token-of-the-request', changes),
    relayEventOf: async (): Promise<AuditEvent & { readonly actor: unknown }> => {
      const events: AuditEvent[] = [];
      new AuditLog({ writeAuditEvent: (event) => { events.push(event); } }).toolCompleted({
        tool: 'getURLAsMarkdown', input: { url: 'https://source.example/relayed', reason: 'Read the relayed source' }, timestamp: new Date().toISOString(),
        organizationId: tenantId(), actor: { authority, subject: gatewayUser.id }, operationId: randomUUID(), status: 'success', durationMs: 7, result: 'Relayed Markdown',
      });
      const [event] = events;
      if (event === undefined) throw new Error('The relay event did not project');
      return event;
    },
  };
}

function rpcMethodOf(body: RequestInit['body']): string | undefined {
  if (typeof body !== 'string') return undefined;
  try {
    const message: unknown = JSON.parse(body);
    return typeof message === 'object' && message !== null && 'method' in message && typeof message.method === 'string' ? message.method : undefined;
  } catch {
    return undefined;
  }
}
