import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mock } from 'node:test';
import { WorkOSOrganizations } from '../../src/accounts/providers/workos/workos-organizations.ts';
import { OrganizationAdministration } from '../../src/accounts/organizations/organization-administration.ts';
import { hostedRolePermissions } from '../../test/support/fixtures/hosted-roles.ts';

// This is cache-only review evidence. It performs no network or SQL requests.
// Each successful getUser costs 300 milliseconds on the fake monotonic clock.
// Tick the fake setTimeout clock by those same milliseconds, so the production
// 30,000-millisecond lifetime ends at its real timer and continuation boundaries.
const reviewedSHA = '806ccc573c6ae09c411a47a755d6dd9316343f8f';
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const actualSHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
assert.equal(actualSHA, reviewedSHA, 'Rerun at the reviewed source revision');
const command = 'node --import tsx .cache/s25-review/member-read-budget-probe.mjs';
let now = 0;
let measure = false;
let users = 0;
let deletes = 0;
let operation;
let administration;

mock.method(performance, 'now', () => now);
mock.timers.enable({ apis: ['setTimeout'] });

try {
  const record = index => ({
    id: `member-${index}`, userId: `user-${index}`, organizationId: 'org-a',
    organizationName: 'A', status: 'active', updatedAt: '2026-10-25T00:00:00Z',
    directoryManaged: false, roles: [{ slug: index === 0 ? 'admin' : 'user' }],
  });
  const records = Array.from({ length: 100 }, (_, index) => record(index));
  const unused = async () => { throw new Error('Unexpected operation'); };
  const directory = new WorkOSOrganizations({
    authority: 'provider',
    memberships: {
      listOrganizationMemberships: async query => ({
        data: query.userId ? [records[0]] : records, listMetadata: {},
      }),
      getOrganizationMembership: async id => records.find(record => record.id === id),
    },
    authorization: {
      listOrganizationRoles: async () => ({
        data: Object.entries(hostedRolePermissions).map(([slug, permissions]) => ({ slug, permissions })),
      }),
    },
    userManagement: {
      getUser: async id => {
        if (measure) {
          users++;
          now += 300;
          mock.timers.tick(300);
        }
        return { email: `${id}@example.com` };
      },
      deleteOrganizationMembership: async () => { deletes++; },
      listInvitations: unused, getInvitation: unused, sendInvitation: unused,
      resendInvitation: unused, revokeInvitation: unused,
    },
  });

  // Obtain a real adapter-generated form revision before timing the operation.
  const target = await directory.member('member-1');
  assert.ok(target);
  const store = {
    admitRemoval: async intent => {
      if (operation?.outcome === null) return { status: 'busy' };
      operation = { ...intent, outcome: null };
      return { status: 'admitted' };
    },
    completeRemoval: async (_org, _id, outcome) => {
      operation.outcome = outcome;
      return { status: 'completed' };
    },
    readRemoval: async () => ({ status: 'found', operation }),
  };
  administration = new OrganizationAdministration({
    directory, removalStore: store, records: { record() {} },
    billing: { stateOf: unused, updateSeats: unused },
  });
  measure = true;
  const actor = { user: { authority: 'provider', subject: 'user-0' } };
  const request = { organizationId: 'org-a', membershipId: 'member-1', revision: target.revision };
  const first = await administration.removeMember(actor, request);
  await new Promise(resolve => setImmediate(resolve));
  const second = await administration.removeMember(actor, request);

  assert.equal(first, 'unknown');
  assert.equal(second, 'busy');
  assert.equal(operation?.outcome, null);
  assert.equal(deletes, 0);
  assert.equal(users, 100);
  assert.equal(now, 30_000);
  console.log(JSON.stringify({
    reviewedSHA, actualSHA, command,
    clockUnit: 'milliseconds',
    clockModel: 'Advance performance.now and mocked setTimeout by 300 ms per successful getUser; all other calls are immediate.',
    activeMembers: records.length, simulatedLatencyPerUserMs: 300,
    elapsedMonotonicMs: now, userEnrichmentReads: users, deletes,
    first, second, operationOutcome: operation.outcome, assertionsPassed: true,
  }, null, 2));
} finally {
  await administration?.close();
  mock.reset();
  mock.timers.reset();
}
