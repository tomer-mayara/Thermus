import type { RequestContext } from '../../accounts/identity/access-context.ts';
import type { AccessContextClaims } from '../../accounts/identity/signed-access-context.ts';
import type { SystemLog } from '../../logs/system/system-logger.ts';
import { waitForRequest } from '../../runtime/http/request-cancellation.ts';
import { GATEWAY_WORDS, messageAnswers, unavailableAnswer } from './mcp-gateway-answers.ts';
import { readForwardedBody, tenantHeaders, tooLargeAnswer, type ForwardedBody } from './mcp-gateway-request.ts';
import { callTenant, type RestartCause, type TenantAnswer } from './mcp-gateway-stream.ts';
import type { GatewayResume, GatewayTenants, GatewayTenantState } from './mcp-gateway-tenants.ts';
import type { McpForwardedRequest } from './mcp-server.ts';

// Signs the access context of one request. Only the control plane holds the private key.
interface ContextSigner {
  sign(claims: AccessContextClaims, bearerToken: string): Promise<string>;
}

export interface McpGatewayOptions {
  readonly signer: ContextSigner;
  readonly tenants: GatewayTenants;
  readonly logger: SystemLog;
}

type RefusalReason = 'starting' | 'resuming' | 'failed' | 'deleted' | 'capacity' | 'registry-unavailable';

// A 503 of the gateway: its reason, the facts of its log line, and whether the line reports to the operator.
interface Refusal {
  readonly reason: RefusalReason;
  readonly state?: GatewayTenantState;
  readonly resume?: GatewayResume['status'];
  readonly resumeFailure?: string;
  readonly report?: boolean;
}

// The answers of 27 October 2026: Retry-After 15 while a tenant starts or the registry is unreadable, and 60 after a
// resume. A failed or deleted tenant and a full cap need the operator, so a retry time does not help.
const REFUSALS: Readonly<Record<RefusalReason, { readonly words: string; readonly retryAfter?: number }>> = {
  starting: { words: GATEWAY_WORDS.starting, retryAfter: 15 },
  resuming: { words: GATEWAY_WORDS.resuming, retryAfter: 60 },
  failed: { words: GATEWAY_WORDS.failed },
  deleted: { words: GATEWAY_WORDS.deleted },
  capacity: { words: GATEWAY_WORDS.capacity },
  'registry-unavailable': { words: GATEWAY_WORDS.unavailable, retryAfter: 15 },
};
// The answer of 27 October 2026: 5 searches at a time across all tenants, because all tenants of a region send their
// Brave searches from the shared outbound addresses of Render (record SO-01e).
const SEARCH_LIMIT = 5;
// The organizations that got their one failure report. At this size, the gateway forgets them all.
const REPORT_MEMORY = 1_024;

/**
 * The MCP gateway of the control plane (SO-05), the forward step of MCPServer after the bearer check and the access
 * check. It reads the row of the organization in the registry copy. It forwards a request for a live tenant to its
 * internal address with a signed access context, and streams the answer back; each other state gets 503. It is a light
 * streaming proxy: of a forwarded body, it reads only the id, the method, and the tool name of each JSON-RPC message,
 * for its own answers and for the search limit. Each refusal writes one system log line and no audit event.
 */
export class McpGateway {
  private readonly options: McpGatewayOptions;
  private readonly searches = new SearchSlots(SEARCH_LIMIT);
  private readonly reportedFailures = new Set<string>();

  constructor(options: McpGatewayOptions) {
    this.options = options;
  }

  async forward(request: Request, forwarded: McpForwardedRequest): Promise<Response> {
    const organizationId = forwarded.context.organizationId;
    // The access check gives each hosted request its organization; a request without one never reaches a tenant.
    if (organizationId === undefined) throw new Error('A forwarded request has no organization.');
    const signal = forwarded.lifetime.signal;
    const route = await waitForRequest(signal, () => this.options.tenants.find(organizationId));
    if (route.status === 'unavailable') return this.refuse(organizationId, { reason: 'registry-unavailable' });
    if (route.status === 'absent') return this.requestTenant(organizationId, signal);
    if (route.state !== 'failed') this.reportedFailures.delete(organizationId);
    if (route.state === 'live' && route.internalUrl !== null) return this.forwardLive(request, forwarded, route.internalUrl);
    return this.answerState(organizationId, route.state, signal);
  }

  // A live row without an address, here or in a tenant request, waits for the next copy of the registry.
  private answerState(organizationId: string, state: GatewayTenantState, signal: AbortSignal): Promise<Response> | Response {
    if (state === 'suspended') return this.resume(organizationId, signal);
    if (state === 'failed') return this.refuse(organizationId, { reason: 'failed', state, report: this.firstReport(organizationId) });
    if (state === 'deleted') return this.refuse(organizationId, { reason: 'deleted', state });
    if (state === 'live') return this.refuse(organizationId, { reason: 'registry-unavailable', state });
    return this.refuse(organizationId, { reason: 'starting', state });
  }

  // The access check ran before, so a token without product access requests no tenant.
  private async requestTenant(organizationId: string, signal: AbortSignal): Promise<Response> {
    const result = await waitForRequest(signal, () => this.options.tenants.request(organizationId));
    if (result.status === 'present') return this.answerState(organizationId, result.state, signal);
    if (result.status === 'requested') return this.refuse(organizationId, { reason: 'starting', state: 'requested' });
    if (result.status === 'full') return this.refuse(organizationId, { reason: 'capacity' });
    return this.refuse(organizationId, { reason: 'registry-unavailable' });
  }

  private async resume(organizationId: string, signal: AbortSignal): Promise<Response> {
    const result = await waitForRequest(signal, () => this.options.tenants.resume(organizationId));
    if (result.status === 'unavailable') return this.refuse(organizationId, { reason: 'registry-unavailable', state: 'suspended' });
    if (result.status !== 'failed') return this.refuse(organizationId, { reason: 'resuming', state: 'suspended', resume: result.status });
    return this.refuse(organizationId, { reason: 'resuming', state: 'suspended', resume: 'failed', resumeFailure: result.reason, report: true });
  }

  private async forwardLive(request: Request, forwarded: McpForwardedRequest, internalUrl: string): Promise<Response> {
    const organizationId = forwarded.context.organizationId ?? '';
    const read = await readForwardedBody(request, forwarded.lifetime.signal);
    if (read.status === 'too-large') return tooLargeAnswer();
    const release = this.searches.take(searchesIn(read.body));
    if (release === undefined) return this.searchBusy(organizationId, read.body);
    let answer: TenantAnswer;
    try {
      const context = await this.options.signer.sign(claimsOf(forwarded.context), forwarded.bearerToken);
      const call = { target: targetOf(request, internalUrl), method: request.method, headers: tenantHeaders(request.headers, context) };
      answer = await callTenant(read.body.bytes === undefined ? call : { ...call, body: read.body.bytes }, forwarded.lifetime.signal);
    } catch (error) {
      release();
      throw error;
    }
    if (answer.status === 'restarted') {
      release();
      return this.restarted(organizationId, read.body, answer.cause);
    }
    // A forward that answers keeps its search places until its answer stream ends.
    forwarded.lifetime.track(answer.ended.then((end) => this.ended(organizationId, end, release)));
    if (answer.response.status < 500) this.options.tenants.recordActive(organizationId);
    return answer.response;
  }

  // Before the first answer byte, the client gets the restart words for each request (answer 1 of 27 October 2026).
  private restarted(organizationId: string, body: ForwardedBody, cause: RestartCause): Response {
    this.reportRestart(organizationId, 'before-answer', cause);
    return messageAnswers(body, GATEWAY_WORDS.restarted) ?? unavailableAnswer(GATEWAY_WORDS.restarted, 60);
  }

  private ended(organizationId: string, end: string, release: () => void): void {
    release();
    if (end === 'failed') this.reportRestart(organizationId, 'during-answer', 'connection');
  }

  private searchBusy(organizationId: string, body: ForwardedBody): Response {
    this.options.logger.info(`MCP gateway refusal: ${JSON.stringify({ organizationId, reason: 'search-busy' })}`);
    return messageAnswers(body, GATEWAY_WORDS.busy) ?? unavailableAnswer(GATEWAY_WORDS.busy);
  }

  // One line for each refusal. A line that reports to the operator is an error line.
  private refuse(organizationId: string, refusal: Refusal): Response {
    const { report = false, ...facts } = refusal;
    const line = `MCP gateway refusal: ${JSON.stringify({ organizationId, ...facts })}`;
    if (report) this.options.logger.error(line);
    else this.options.logger.info(line);
    const { words, retryAfter } = REFUSALS[refusal.reason];
    return unavailableAnswer(words, retryAfter);
  }

  // The restart line is the one line and the operator report of a tenant that failed during a forward.
  private reportRestart(organizationId: string, phase: 'before-answer' | 'during-answer', cause: RestartCause): void {
    this.options.logger.error(`MCP gateway tenant restart: ${JSON.stringify({ organizationId, phase, cause })}`);
  }

  private firstReport(organizationId: string): boolean {
    if (this.reportedFailures.has(organizationId)) return false;
    if (this.reportedFailures.size >= REPORT_MEMORY) this.reportedFailures.clear();
    this.reportedFailures.add(organizationId);
    return true;
  }
}

// The places of the searches that run through the gateway. A request takes one place for each search that it holds.
class SearchSlots {
  private active = 0;

  constructor(private readonly limit: number) {}

  /** The release of the places, or undefined when they do not fit. A release frees the places one time. */
  take(count: number): (() => void) | undefined {
    if (this.active + count > this.limit) return undefined;
    this.active += count;
    let held = count;
    return () => {
      this.active -= held;
      held = 0;
    };
  }
}

function searchesIn(body: ForwardedBody): number {
  return body.messages.filter((message) => message.method === 'tools/call' && message.toolName === 'search').length;
}

// The tenant serves the same MCP path as the public origin, because it has the same PUBLIC_BASE_URL.
function targetOf(request: Request, internalUrl: string): URL {
  const { pathname, search } = new URL(request.url);
  return new URL(`${pathname}${search}`, internalUrl);
}

function claimsOf(context: RequestContext): AccessContextClaims {
  const { authority, subject, name } = context.user;
  return { authority, subject, ...(name === undefined ? {} : { name }), organizationId: context.organizationId ?? '', grants: context.grants };
}
