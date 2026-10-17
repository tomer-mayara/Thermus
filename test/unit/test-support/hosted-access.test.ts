import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { RequestContext } from '../../../src/auth/access-context.ts';
import { contextAt, destinationPaths, statusesOf } from '../../support/dsl/hosted-access.ts';
import type { BrowserAnswer, HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';

interface PageAnswer {
  readonly status: number;
  readonly body?: string;
}

function browserAnswering(answers: Readonly<Record<string, PageAnswer>>) {
  const opened: string[] = [];
  const browser: Pick<HostedBrowser, 'open'> = {
    open: async (path): Promise<BrowserAnswer> => {
      opened.push(path);
      const answer = answers[path];
      assert.ok(answer, `The stub has no answer for ${path}.`);
      return { status: answer.status, headers: new Headers(), cookies: [], body: answer.body ?? '' };
    },
  };
  return { browser, opened };
}

describe('Access steps of the offline hosted organization tests', () => {
  test('Given a browser whose pages answer with their own status, when statusesOf() reads two paths, then it gives the status of each path, in the order of the paths', async () => {
    const { browser, opened } = browserAnswering({ billing: { status: 403 }, portal: { status: 200 } });

    const statuses = await statusesOf(browser, ['portal', 'billing']);

    assert.deepEqual(statuses, { portal: 200, billing: 403 });
    assert.deepEqual(Object.keys(statuses), ['portal', 'billing']);
    assert.deepEqual(opened, ['portal', 'billing']);
  });

  test('Given no paths, when statusesOf() reads a browser, then it reads the four destinations: portal, administration/users, administration/admins, and billing', async () => {
    const { browser, opened } = browserAnswering({
      portal: { status: 200 },
      'administration/users': { status: 403 },
      'administration/admins': { status: 403 },
      billing: { status: 403 },
    });

    const statuses = await statusesOf(browser);

    assert.deepEqual(destinationPaths, ['portal', 'administration/users', 'administration/admins', 'billing']);
    assert.deepEqual(opened, destinationPaths);
    assert.deepEqual(statuses, { portal: 200, 'administration/users': 403, 'administration/admins': 403, billing: 403 });
  });

  test('Given a page that answers 200 with a request context in JSON, when contextAt() opens it, then it gives that context', async () => {
    const context: RequestContext = {
      user: { authority: 'hosted-provider-double', subject: 'user-mia', selectedOrganizationId: 'org-a' },
      tenantId: 'hosted:org-a',
      organizationId: 'org-a',
      grants: [{ role: 'user', permissions: ['product:access'] }],
      permissions: ['product:access'],
    };
    const { browser, opened } = browserAnswering({ portal: { status: 200, body: JSON.stringify({ context }) } });

    assert.deepEqual(await contextAt(browser, 'portal'), context);
    assert.deepEqual(opened, ['portal']);
  });

  test('Given a page that answers 403, when contextAt() opens it, then it fails with an AssertionError whose message begins with the body of the answer', async () => {
    const { browser } = browserAnswering({ billing: { status: 403, body: '{"refused":"permission-required"}' } });

    await assert.rejects(contextAt(browser, 'billing'), { name: 'AssertionError', message: /^\{"refused":"permission-required"\}/ });
  });
});
