import assert from 'node:assert/strict';
import { addRow } from '../render-tenant-lifecycle/context.ts';
import { sleep } from '../render-tenant-lifecycle/polls.ts';
import type { ProbeContext } from './context.ts';
import { answeredOk, outcomeText, requestHere, type Outcome } from './here.ts';

export const PUBLIC_HEALTH = { everyMs: 5_000, attempts: 6, timeoutMs: 10_000 } as const;

// The deploy is live when the Render health check passed, so the first request should answer. The bounded
// repeats cover a slow first route of a new onrender.com name.
async function requestUntilOk(context: ProbeContext, url: string): Promise<{ readonly outcome: Outcome; readonly tries: number }> {
  for (let tries = 1; ; tries++) {
    const outcome = await requestHere(url, PUBLIC_HEALTH.timeoutMs, context.signal);
    if (answeredOk(outcome) || tries === PUBLIC_HEALTH.attempts) return { outcome, tries };
    await sleep(PUBLIC_HEALTH.everyMs, context.signal);
  }
}

export async function checkPublicHealth(context: ProbeContext, url: string): Promise<string> {
  const { outcome, tries } = await requestUntilOk(context, url);
  const measured = `${outcomeText(outcome)}; request ${tries} of at most ${PUBLIC_HEALTH.attempts}`;
  addRow(context, 'Web service', { check: `GET ${url} from this machine`, expected: '200 with body ok', measured });
  assert.ok(answeredOk(outcome), `GET ${url} from this machine gave ${measured}, not 200 with body ok`);
  return `GET ${url} from this machine answered 200 with ok (request ${tries}).`;
}
