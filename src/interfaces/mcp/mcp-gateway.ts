import type { SystemLog } from '../../logs/system/system-logger.ts';
import { waitForRequest } from '../../runtime/http/request-cancellation.ts';
import { LiveForward, type ContextSigner } from './mcp-gateway-forward.ts';
import { GatewayRefusals, type Refusal } from './mcp-gateway-refusals.ts';
import type { GatewayTenantRequest, GatewayTenants, GatewayTenantState } from './mcp-gateway-tenants.ts';
import type { McpForwardedRequest } from './mcp-server.ts';

export interface McpGatewayOptions {
  readonly signer: ContextSigner;
  readonly tenants: GatewayTenants;
  readonly logger: SystemLog;
}

// The organizations that got their one failure report. At this size, the gateway forgets them all.
const REPORT_MEMORY = 1_024;

// The refusal of each row state that needs no registry write. A row that starts gets the starting words; a live row
// without an address, here or in a tenant request, waits for the next copy of the registry.
const STATE_REFUSALS: Readonly<Record<Exclude<GatewayTenantState, 'suspended' | 'failed'>, Refusal['reason']>> = {
  requested: 'starting', creating: 'starting', deploying: 'starting', live: 'registry-unavailable', deleted: 'deleted',
};

// The refusal of a tenant request for an organization without a row.
const REQUEST_REFUSALS: Readonly<Record<Exclude<GatewayTenantRequest['status'], 'present'>, Refusal>> = {
  requested: { reason: 'starting', state: 'requested' },
  full: { reason: 'capacity' },
  unavailable: { reason: 'registry-unavailable' },
};

/**
 * The MCP gateway of the control plane (SO-05), the forward step of MCPServer after the bearer check and the access
 * check. It reads the row of the organization in the registry copy and forwards a request for a live tenant; each
 * other row gets the 503 of its state. It is a light streaming proxy: of a forwarded body, it reads only the id, the
 * method, and the tool name of each JSON-RPC message, for its own answers and for the search limit.
 */
export class McpGateway {
  private readonly tenants: GatewayTenants;
  private readonly refusals: GatewayRefusals;
  private readonly live: LiveForward;
  private readonly reportedFailures = new Set<string>();

  constructor(options: McpGatewayOptions) {
    this.tenants = options.tenants;
    this.refusals = new GatewayRefusals(options.logger);
    this.live = new LiveForward({ signer: options.signer, tenants: options.tenants, refusals: this.refusals });
  }

  async forward(request: Request, forwarded: McpForwardedRequest): Promise<Response> {
    const organizationId = forwarded.context.organizationId;
    // The access check gives each hosted request its organization; a request without one never reaches a tenant.
    if (organizationId === undefined) throw new Error('A forwarded request has no organization.');
    const signal = forwarded.lifetime.signal;
    const route = await waitForRequest(signal, () => this.tenants.find(organizationId));
    if (route.status === 'unavailable') return this.refusals.refuse(organizationId, { reason: 'registry-unavailable' });
    if (route.status === 'absent') return this.requestTenant(organizationId, signal);
    if (route.state !== 'failed') this.reportedFailures.delete(organizationId);
    if (route.state === 'live' && route.internalUrl !== null) return this.live.forward(request, forwarded, route.internalUrl);
    return this.answerState(organizationId, route.state, signal);
  }

  private answerState(organizationId: string, state: GatewayTenantState, signal: AbortSignal): Promise<Response> | Response {
    if (state === 'suspended') return this.resume(organizationId, signal);
    if (state === 'failed') return this.refusals.refuse(organizationId, { reason: 'failed', state, report: this.firstReport(organizationId) });
    return this.refusals.refuse(organizationId, { reason: STATE_REFUSALS[state], state });
  }

  // The access check ran before, so a token without product access requests no tenant.
  private async requestTenant(organizationId: string, signal: AbortSignal): Promise<Response> {
    const result = await waitForRequest(signal, () => this.tenants.request(organizationId));
    if (result.status === 'present') return this.answerState(organizationId, result.state, signal);
    return this.refusals.refuse(organizationId, REQUEST_REFUSALS[result.status]);
  }

  private async resume(organizationId: string, signal: AbortSignal): Promise<Response> {
    const result = await waitForRequest(signal, () => this.tenants.resume(organizationId));
    if (result.status === 'unavailable') return this.refusals.refuse(organizationId, { reason: 'registry-unavailable', state: 'suspended' });
    if (result.status !== 'failed') return this.refusals.refuse(organizationId, { reason: 'resuming', state: 'suspended', resume: result.status });
    return this.refusals.refuse(organizationId, { reason: 'resuming', state: 'suspended', resume: 'failed', resumeFailure: result.reason, report: true });
  }

  // A failed tenant reports one time until its row leaves the failed state.
  private firstReport(organizationId: string): boolean {
    if (this.reportedFailures.has(organizationId)) return false;
    if (this.reportedFailures.size >= REPORT_MEMORY) this.reportedFailures.clear();
    this.reportedFailures.add(organizationId);
    return true;
  }
}
