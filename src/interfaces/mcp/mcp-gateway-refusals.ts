import type { SystemLog } from '../../logs/system/system-logger.ts';
import { GATEWAY_WORDS, messageAnswers, unavailableAnswer } from './mcp-gateway-answers.ts';
import type { ForwardedBody } from './mcp-gateway-request.ts';
import type { RestartCause } from './mcp-gateway-stream.ts';
import type { GatewayResume, GatewayTenantState } from './mcp-gateway-tenants.ts';

type RefusalReason = 'starting' | 'resuming' | 'failed' | 'deleted' | 'capacity' | 'registry-unavailable';

export interface Refusal {
  readonly reason: RefusalReason;
  readonly state?: GatewayTenantState;
  readonly resume?: GatewayResume['status'];
  readonly resumeFailure?: string;
  readonly report?: boolean;
}

/** A failure of a live tenant before the first answer byte, and the time since the last change of its row. */
export interface EarlyFailure {
  readonly cause: RestartCause;
  readonly sinceChangeMs: number;
}

type GatewayAnswer = { readonly words: string; readonly retryAfter?: number };

// Records SO-03 and SO-12 (release record of 31 October 2026, section 3.7): the private address of a new tenant
// refused connections until about 76 s after its first deploy was live. So a refused connection less than 2 minutes
// after the last change of a live row is the cold start of the tenant. A reset, a broken answer, or HTTP 502 means
// that a server took the connection: a restart, such as a memory kill, also in those 2 minutes.
const COLD_START_MS = 120_000;
const RESTARTED: GatewayAnswer = { words: GATEWAY_WORDS.restarted, retryAfter: 60 };

// The answers of 27 October 2026: Retry-After 15 while a tenant starts or the registry is unreadable, and 60 after a
// resume. A failed or deleted tenant and a full cap need the operator, so a retry time does not help.
const REFUSALS: Readonly<Record<RefusalReason, GatewayAnswer>> = {
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
 * resume, and each restart of a tenant. The cold start of a new tenant is an info line.
 */
export class GatewayRefusals {
  private readonly logger: SystemLog;

  constructor(logger: SystemLog) {
    this.logger = logger;
  }

  refuse(organizationId: string, refusal: Refusal): Response {
    const { report = false, ...facts } = refusal;
    this.write(refusalLineOf({ organizationId, ...facts }), report);
    const { words, retryAfter } = REFUSALS[refusal.reason];
    return unavailableAnswer(words, retryAfter);
  }

  searchBusy(organizationId: string, body: ForwardedBody): Response {
    this.write(refusalLineOf({ organizationId, reason: 'search-busy' }), false);
    return answersTo(body, { words: GATEWAY_WORDS.busy });
  }

  /**
   * Before the first answer byte, the client gets the words of the failure for each request: in the cold start of a new
   * tenant, the starting words; else the restart words (answer 1 of 27 October 2026) and the operator report.
   */
  failedBeforeAnswer(organizationId: string, body: ForwardedBody, failure: EarlyFailure): Response {
    if (failure.cause === 'refused' && failure.sinceChangeMs < COLD_START_MS) {
      this.write(startLineOf({ organizationId, secondsSinceChange: Math.floor(failure.sinceChangeMs / 100) / 10 }), false);
      return answersTo(body, REFUSALS.starting);
    }
    this.write(restartLineOf({ organizationId, phase: 'before-answer', cause: failure.cause }), true);
    return answersTo(body, RESTARTED);
  }

  /** After the first answer byte, the gateway ended the answer stream; the client gets no answer of the gateway. */
  streamBrokenOff(organizationId: string): void {
    this.write(restartLineOf({ organizationId, phase: 'during-answer', cause: 'connection' }), true);
  }

  private write(line: string, report: boolean): void {
    if (report) this.logger.error(line);
    else this.logger.info(line);
  }
}

// The answer to each request of the body, or a 503 for a body without a request.
function answersTo(body: ForwardedBody, answer: GatewayAnswer): Response {
  return messageAnswers(body, answer.words) ?? unavailableAnswer(answer.words, answer.retryAfter);
}

function refusalLineOf(facts: Readonly<Record<string, string>>): string {
  return `MCP gateway refusal: ${JSON.stringify(facts)}`;
}

// The restart line is the operator report, and the line of the restart alert of SO-11.
function restartLineOf(restart: { readonly organizationId: string; readonly phase: 'before-answer' | 'during-answer'; readonly cause: RestartCause }): string {
  return `MCP gateway tenant restart: ${JSON.stringify(restart)}`;
}

// The start line has another prefix, so the restart alert does not match it. The seconds are whole tenths.
function startLineOf(start: { readonly organizationId: string; readonly secondsSinceChange: number }): string {
  return `MCP gateway tenant starting: ${JSON.stringify(start)}`;
}
