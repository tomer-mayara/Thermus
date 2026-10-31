import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { AuditLog, type AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import type { FakeUser } from '../../support/doubles/workos/workos-fake.ts';
import { assertSeatLimitNotice, submitOnPage } from '../../support/dsl/hosted-administration.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

const workspace = 'org_01FREE';
const recordPrefix = 'INFO Account change record: ';
const person = (name: string): FakeUser => ({ id: `user_01${name.toUpperCase()}`, email: `${name}@example.com`, firstName: name });
const [ada, bea, cal, dan] = ['ada', 'bea', 'cal', 'dan'].map(person);

// Ada is the Admin of a free workspace with 4 active members and 1 pending invitation: 5 of 5 seats.
async function serveFullWorkspace(t: TestContext, events: AuditEvent[]) {
  const site = await serveWorkOSSite(t, {
    organizations: [workspace],
    audit: new AuditLog({ writeAuditEvent: (event) => { events.push(event); } }),
    setUp: (world) => {
      world.users = [ada, bea, cal, dan];
      world.organizationNames = { [workspace]: 'Initech' };
      world.memberships = [
        { userId: ada.id, organizationId: workspace, roles: ['admin'] },
        ...[bea, cal, dan].map((member) => ({ userId: member.id, organizationId: workspace, roles: ['user'] })),
      ];
      world.invitations = [{ id: 'invitation_01EVE', email: 'eve@example.com', organizationId: workspace, roleSlug: 'user', state: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' }];
    },
  });
  const { browser } = await signInThroughServer(site, ada, workspace);
  return { site, browser };
}

describe('The free member limit in the WorkOS composition, with a fake of the WorkOS API', () => {
  test('Given a refused invitation at 5 of 5 seats, when the change is recorded, then the change record and the audit event have the outcome limit-reached and WorkOS gets no invitation write', { timeout: 20_000 }, async (t) => {
    const events: AuditEvent[] = [];
    const { site, browser } = await serveFullWorkspace(t, events);

    const answer = await submitOnPage(browser, 'members', { label: 'Send invitation', filled: { email: 'fay@example.com' } });

    assertSeatLimitNotice(answer);
    const writes = site.world.fake.takeRequests().filter((request) => request.method === 'POST' && request.path === '/user_management/invitations');
    assert.deepEqual(writes, []);
    assert.deepEqual(events.map((event) => event.eventName === 'organization.changed' ? [event.action, event.target, event.role, event.outcome] : event.eventName), [
      ['invite', { email: 'fay@example.com' }, 'user', 'limit-reached'],
    ]);
    const records = site.log.lines.filter((line) => line.startsWith(recordPrefix)).map((line) => JSON.parse(line.slice(recordPrefix.length)) as { action: string; outcome: string });
    assert.deepEqual(records.map(({ action, outcome }) => `${action}: ${outcome}`), ['invite: limit-reached']);
  });

  test('Given a free workspace, when a member reads the portal access, then the JSON has the plan free and the member limit 5', { timeout: 20_000 }, async (t) => {
    const { browser } = await serveFullWorkspace(t, []);

    const access = await browser.open('portal/access', { Accept: 'application/json' });

    assert.equal(access.status, 200, access.body);
    assert.deepEqual(JSON.parse(access.body), { organizationId: workspace, organizationName: 'Initech', roles: ['admin'], plan: 'free', memberLimit: 5, mcpUrl: hostedConfig.mcpResourceUrl });
  });
});
