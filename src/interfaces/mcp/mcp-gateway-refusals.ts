import type { SystemLog } from '../../logs/system/system-logger.ts';
import { GATEWAY_WORDS, messageAnswers, unavailableAnswer } from './mcp-gateway-answers.ts';
import type { ForwardedBody } from './mcp-gateway-request.ts';
import type { RestartCause } from './mcp-gateway-stream.ts';
import type { GatewayResume, GatewayTenantState } from './mcp-gateway-tenants.ts';

type RefusalReason = 'starting' | 'resuming' | 'failed' | 'deleted' | 'capacity' | 'registry-unavailable';

/** A 503 of the gateway: its reason and the facts of its log line, and whether the line reports to the operator. */
export interface Refusal {
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

/**
 * The answers of the gateway itself and their system log lines: one line for each refusal and no audit event, because
 * no tool ran. A line that reports to the operator is an error line: the first refusal of a failed tenant, a failed
 * resume, and each restart of a tenant.
 */
export class GatewayRefusals {
  private readonly logger: SystemLog;

  constructor(logger: SystemLog) {
    this.logger = logger;
  }

  refuse(organizationId: string, refusal: Refusal): Response {
    const { report = false, ...facts } = refusal;
    this.line({ organizationId, ...facts }, report);
    const { words, retryAfter } = REFUSALS[refusal.reason];
    return unavailableAnswer(words, retryAfter);
  }

  searchBusy(organizationId: string, body: ForwardedBody): Response {
    this.line({ organizationId, reason: 'search-busy' }, false);
    return messageAnswers(body, GATEWAY_WORDS.busy) ?? unavailableAnswer(GATEWAY_WORDS.busy);
  }

  // Before the first answer byte, the client gets the restart words for each request (answer 1 of 27 October 2026).
  restarted(organizationId: string, body: ForwardedBody, cause: RestartCause): Response {
    this.restartLine(organizationId, 'before-answer', cause);
    return messageAnswers(body, GATEWAY_WORDS.restarted) ?? unavailableAnswer(GATEWAY_WORDS.restarted, 60);
  }

  // After the first answer byte, the gateway ended the answer stream; the client gets no answer of the gateway.
  streamBrokenOff(organizationId: string): void {
    this.restartLine(organizationId, 'during-answer', 'connection');
  }

  private line(facts: Readonly<Record<string, string>>, report: boolean): void {
    const line = `MCP gateway refusal: ${JSON.stringify(facts)}`;
    if (report) this.logger.error(line);
    else this.logger.info(line);
  }

  // The restart line is the operator report, and the line of the restart alert of SO-11.
  private restartLine(organizationId: string, phase: 'before-answer' | 'during-answer', cause: RestartCause): void {
    this.logger.error(`MCP gateway tenant restart: ${JSON.stringify({ organizationId, phase, cause })}`);
  }
}
