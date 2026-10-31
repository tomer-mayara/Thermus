import type { SystemLog } from '../../logs/system/system-logger.ts';
import { waitForRequest } from '../../runtime/http/request-cancellation.ts';
import { LiveForward, type ContextSigner } from './mcp-gateway-forward.ts';
import { GatewayRefusals, type Refusal } from './mcp-gateway-refusals.ts';
import type { GatewayResume, GatewayTenantRequest, GatewayTenants, GatewayTenantState } from './mcp-gateway-tenants.ts';
import type { McpForwardedRequest } from './mcp-server.ts';

export interface McpGatewayOptions {
  readonly signer: ContextSigner;
  readonly tenants: GatewayTenants;
  readonly logger: SystemLog;
}

// The organizations that got their one failure report. At this size, the gateway forgets them all.
const REPORT_MEMORY = 1_024;

// The state and the internal address of a row, from the registry copy or, without an address, from a tenant request.
type TenantRow = { readonly state: GatewayTenantState; readonly internalUrl: string | null };

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
  /** The registry port that app composes on the tenants owner. */
  private readonly tenants: GatewayTenants;
  /** The answers of the gateway itself, with their log lines. */
  private readonly refusals: GatewayRefusals;
  /** The forward to a live tenant. */
  private readonly live: LiveForward;
  /** The refusal of each row that is not live, with the one report of each failed row. */
  private readonly states = new StateRefusals();

  /** The answers of the gateway and of its live forward share one refusals object and one logger. */
  constructor(options: McpGatewayOptions) {
    this.tenants = options.tenants;
    this.refusals = new GatewayRefusals(options.logger);
    this.live = new LiveForward({ signer: options.signer, tenants: options.tenants, refusals: this.refusals });
  }

  /** The forward step: the answer of the live tenant of the organization, or the 503 of its row. */
  async forward(request: Request, forwarded: McpForwardedRequest): Promise<Response> {
    const organizationId = organizationOf(forwarded);
    const signal = forwarded.lifetime.signal;
    const route = await waitForRequest(signal, () => this.tenants.find(organizationId));
    if (route.status === 'unavailable') return this.refusals.refuse(organizationId, { reason: 'registry-unavailable' });
    if (route.status === 'absent') return this.requestTenant(organizationId, signal);
    this.states.rowSeen(organizationId, route.state);
    if (route.state === 'live' && route.internalUrl !== null) return this.live.forward(request, forwarded, route.internalUrl);
    return this.answerState(organizationId, route, signal);
  }

  /** The 503 of a row that is not live, after the one resume of a suspended row. */
  private async answerState(organizationId: string, row: TenantRow, signal: AbortSignal): Promise<Response> {
    if (row.state === 'suspended') {
      const resumed = await waitForRequest(signal, () => this.tenants.resume(organizationId));
      return this.refusals.refuse(organizationId, resumeRefusalOf(resumed));
    }
    return this.refusals.refuse(organizationId, this.states.refusalOf(organizationId, { state: row.state, internalUrl: row.internalUrl }));
  }

  /** The access check ran before, so a token without product access requests no tenant. */
  private async requestTenant(organizationId: string, signal: AbortSignal): Promise<Response> {
    const result = await waitForRequest(signal, () => this.tenants.request(organizationId));
    if (result.status === 'present') return this.answerState(organizationId, { state: result.state, internalUrl: null }, signal);
    return this.refusals.refuse(organizationId, REQUEST_REFUSALS[result.status]);
  }
}

// The access check gives each hosted request its organization; a request without one never reaches a tenant.
function organizationOf(forwarded: McpForwardedRequest): string {
  const organizationId = forwarded.context.organizationId;
  if (organizationId === undefined) throw new Error('A forwarded request has no organization.');
  return organizationId;
}

// A failed resume reports to the operator with its reason; the row is suspended again, so the next call tries again.
function resumeRefusalOf(result: GatewayResume): Refusal {
  if (result.status === 'unavailable') return { reason: 'registry-unavailable', state: 'suspended' };
  if (result.status !== 'failed') return { reason: 'resuming', state: 'suspended', resume: result.status };
  return { reason: 'resuming', state: 'suspended', resume: 'failed', resumeFailure: result.reason, report: true };
}

/** The refusal of each row state. A failed tenant reports one time until its row leaves the failed state. */
class StateRefusals {
  /** The organizations that got their report. At REPORT_MEMORY of them, the memory starts again. */
  private readonly reported = new Set<string>();

  /** A row that is not failed makes the next failure of its organization report again. */
  rowSeen(organizationId: string, state: GatewayTenantState): void {
    if (state !== 'failed') this.reported.delete(organizationId);
  }

  refusalOf(organizationId: string, row: TenantRow & { readonly state: Exclude<GatewayTenantState, 'suspended'> }): Refusal {
    const { state } = row;
    if (state === 'failed') return { reason: 'failed', state, report: this.firstReport(organizationId) };
    // Only a live record gives a row its address, and a delete takes it away, so a deploying row with an address was
    // live before: its deploy is the deploy of a resume, and the client waits a minute (plan section 4.2).
    if (state === 'deploying' && row.internalUrl !== null) return { reason: 'resuming', state };
    return { reason: STATE_REFUSALS[state], state };
  }

  private firstReport(organizationId: string): boolean {
    if (this.reported.has(organizationId)) return false;
    if (this.reported.size >= REPORT_MEMORY) this.reported.clear();
    this.reported.add(organizationId);
    return true;
  }
}
