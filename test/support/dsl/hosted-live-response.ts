import assert from 'node:assert/strict';
import type { ServerAnswer } from '../hosted-live/portal-visit.ts';

export function assertServerRedirect(answer: Pick<ServerAnswer, 'status' | 'location'>, location: string, operatorLines: readonly string[]): void {
  if (answer.status === 303 && answer.location === location) return;
  const reports = operatorLines.filter((line) => line.startsWith('ERROR ')).slice(-3);
  assert.fail(`Expected a 303 redirect to ${location}; the server gave ${answer.status}. The last operator reports:\n${reports.join('\n')}`);
}
