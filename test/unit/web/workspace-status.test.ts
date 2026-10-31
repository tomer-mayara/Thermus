import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkspaceStatuses, type WorkspaceState, type WorkspaceTenants } from '../../../src/interfaces/web/account/workspace-status.ts';

const settingUp = 'Setting up your workspace. This takes about two minutes.';
const paused = 'Your workspace was paused after 14 days without use. It restarts on the next request, which can take about a minute.';

// A stub of the tenant port: each organization has its scripted state, and each read is recorded.
function tenantsOf(states: Record<string, WorkspaceState>): WorkspaceTenants & { readonly reads: string[] } {
  const reads: string[] = [];
  return { reads, stateOf: async (organizationId) => { reads.push(organizationId); return states[organizationId] ?? 'unavailable'; } };
}

function statusesOf(states: Record<string, WorkspaceState>, idleDays = 14) {
  const reports: string[] = [];
  const tenants = tenantsOf(states);
  return { reports, tenants, statuses: new WorkspaceStatuses(tenants, (line) => reports.push(line), idleDays) };
}

test('Given each tenant state, when the portal asks for the view, then only a live or a suspended tenant is ready, a suspended tenant has the notice of the pause, and every other state has the words of the portal', async () => {
  const expected: Readonly<Record<WorkspaceState, { readonly ready: boolean; readonly message?: string }>> = {
    requested: { ready: false, message: settingUp },
    creating: { ready: false, message: settingUp },
    deploying: { ready: false, message: settingUp },
    live: { ready: true },
    suspended: { ready: true, message: paused },
    failed: { ready: false, message: 'Workspace setup failed. We have been notified and will fix it.' },
    deleted: { ready: false, message: 'Your workspace is not available. Contact Thermus support.' },
    full: { ready: false, message: 'All free workspaces are in use. Try again later.' },
    unavailable: { ready: false, message: 'The service is temporarily unavailable. Try again in 15 seconds.' },
  };
  for (const [state, view] of Object.entries(expected) as [WorkspaceState, typeof expected[WorkspaceState]][]) {
    const { statuses, tenants } = statusesOf({ org_A: state });
    assert.deepEqual(await statuses.viewOf('org_A'), { state, ...view }, state);
    assert.deepEqual(tenants.reads, ['org_A']);
  }
});

test('Given a failed tenant, when the portal reads its status again and again, then the operator gets one report until the tenant leaves the failed state', async () => {
  const states: Record<string, WorkspaceState> = { org_A: 'failed', org_B: 'failed' };
  const { statuses, reports } = statusesOf(states);
  await statuses.viewOf('org_A');
  await statuses.viewOf('org_A');
  await statuses.viewOf('org_B');
  assert.deepEqual(reports, ['Workspace setup failed: {"organizationId":"org_A"}', 'Workspace setup failed: {"organizationId":"org_B"}']);
  states.org_A = 'unavailable';
  await statuses.viewOf('org_A');
  states.org_A = 'failed';
  await statuses.viewOf('org_A');
  assert.equal(reports.length, 2, 'An unreadable registry says nothing about the row, so it keeps the report memory.');
  states.org_A = 'requested';
  await statuses.viewOf('org_A');
  states.org_A = 'failed';
  await statuses.viewOf('org_A');
  assert.deepEqual(reports.at(-1), 'Workspace setup failed: {"organizationId":"org_A"}');
  assert.equal(reports.length, 3);
});

test('Given 1,024 reported organizations, when one more tenant fails, then the report memory starts again and each organization can report once more', async () => {
  const states: Record<string, WorkspaceState> = {};
  for (let index = 0; index <= 1_024; index++) states[`org_${index}`] = 'failed';
  const { statuses, reports } = statusesOf(states);
  for (let index = 0; index < 1_024; index++) await statuses.viewOf(`org_${index}`);
  await statuses.viewOf('org_0');
  assert.equal(reports.length, 1_024);
  await statuses.viewOf('org_1024');
  await statuses.viewOf('org_0');
  assert.equal(reports.length, 1_026);
});

test('Given current product access, when the status route answers GET or HEAD, then it gives the view as JSON that no cache keeps, and HEAD gives the headers only', async () => {
  const { statuses } = statusesOf({ org_A: 'requested' });
  const answer = await statuses.answer(new Request('https://thermus.example/workspace/status'), 'org_A');
  assert.equal(answer.status, 200);
  assert.deepEqual(await answer.json(), { state: 'requested', ready: false, message: settingUp });
  assert.equal(answer.headers.get('Content-Type'), 'application/json');
  assert.equal(answer.headers.get('Cache-Control'), 'no-store');
  assert.equal(answer.headers.get('X-Content-Type-Options'), 'nosniff');
  const head = await statuses.answer(new Request('https://thermus.example/workspace/status', { method: 'HEAD' }), 'org_A');
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('Cache-Control'), 'no-store');
});

test('Given no current product access, when the status route answers, then it gives the access denial of the portal and reads no tenant state', async () => {
  const { statuses, tenants } = statusesOf({ org_A: 'live' });
  for (const method of ['GET', 'POST']) {
    const answer = await statuses.answer(new Request('https://thermus.example/workspace/status', { method }), undefined);
    assert.equal(answer.status, 403);
    assert.deepEqual(await answer.json(), { access: 'denied' });
  }
  assert.deepEqual(tenants.reads, []);
});

test('Given current product access, when another method than GET or HEAD arrives, then the route refuses it with Allow and reads no tenant state', async () => {
  const { statuses, tenants } = statusesOf({ org_A: 'live' });
  const answer = await statuses.answer(new Request('https://thermus.example/workspace/status', { method: 'DELETE' }), 'org_A');
  assert.equal(answer.status, 405);
  assert.equal(answer.headers.get('Allow'), 'GET, HEAD');
  assert.deepEqual(tenants.reads, []);
});

test('Given FREE_TENANT_IDLE_DAYS of 7, when the portal asks for the view of a suspended tenant, then the notice of the pause names 7 days', async () => {
  const { statuses } = statusesOf({ org_A: 'suspended' }, 7);
  assert.deepEqual(await statuses.viewOf('org_A'), { state: 'suspended', ready: true, message: 'Your workspace was paused after 7 days without use. It restarts on the next request, which can take about a minute.' });
});
