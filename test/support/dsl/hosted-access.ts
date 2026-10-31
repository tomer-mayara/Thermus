import assert from 'node:assert/strict';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import type { HostedBrowser } from '../drivers/browser/hosted-browser.ts';

export const destinationPaths = ['portal', 'administration/users', 'administration/admins', 'billing'];

export async function statusesOf(browser: Pick<HostedBrowser, 'open'>, paths: readonly string[] = destinationPaths): Promise<Record<string, number>> {
  const statuses: Record<string, number> = {};
  for (const path of paths) statuses[path] = (await browser.open(path)).status;
  return statuses;
}

export async function contextAt(browser: Pick<HostedBrowser, 'open'>, path: string): Promise<RequestContext> {
  const answer = await browser.open(path);
  assert.equal(answer.status, 200, answer.body);
  return (JSON.parse(answer.body) as { context: RequestContext }).context;
}
