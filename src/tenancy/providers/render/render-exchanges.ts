import type { RenderAnswer, RenderApi, RenderCall, RenderClock, RenderExchange } from './render-api.ts';
import { recordOf } from './render-services.ts';

// The bounds of 27 October 2026: a read or the delete has up to 3 attempts after a 429, a 5xx, or no answer. It waits
// 5 s after a failure, and the Retry-After time, at most 60 s, after a 429.
const ATTEMPTS = 3;
const RETRY_PAUSE_MS = 5_000;
const MAX_LIMIT_PAUSE_MS = 60_000;
// A bounded message keeps a long answer of Render out of the log and the registry.
const MESSAGE_LIMIT = 200;

export function successOf(exchange: RenderExchange): RenderAnswer | undefined {
  const { answer } = exchange;
  return answer !== undefined && answer.status >= 200 && answer.status < 300 ? answer : undefined;
}

export function retryable(exchange: RenderExchange): boolean {
  return exchange.answer === undefined || exchange.answer.status === 429 || exchange.answer.status >= 500;
}

/** The status and the bounded message of Render, never a request header. */
export function answerReason(answer: RenderAnswer): string {
  const { message } = recordOf(answer.json);
  return typeof message === 'string' && message !== '' ? `Render answered ${answer.status}: ${message.slice(0, MESSAGE_LIMIT)}` : `Render answered ${answer.status}`;
}

export function reasonOf(exchange: RenderExchange): string {
  return exchange.answer === undefined ? exchange.failure : answerReason(exchange.answer);
}

/** Sends a read or the delete with the retry rule. A create or a deploy never goes through here. */
export async function sendRepeated(parts: { readonly api: RenderApi; readonly clock: RenderClock }, call: RenderCall, signal: AbortSignal): Promise<RenderExchange> {
  let exchange = await parts.api.send(call, signal);
  for (let attempt = 2; attempt <= ATTEMPTS && retryable(exchange); attempt += 1) {
    await parts.clock.sleep(pauseOf(exchange), signal);
    exchange = await parts.api.send(call, signal);
  }
  return exchange;
}

// The cap of 60 s keeps a read within its bound, also when Render asks for a longer wait.
function pauseOf(exchange: RenderExchange): number {
  if (exchange.answer?.status !== 429) return RETRY_PAUSE_MS;
  const seconds = exchange.answer.limits.retryAfterSeconds ?? exchange.answer.limits.resetSeconds;
  return seconds === undefined ? RETRY_PAUSE_MS : Math.min(seconds * 1_000, MAX_LIMIT_PAUSE_MS);
}
