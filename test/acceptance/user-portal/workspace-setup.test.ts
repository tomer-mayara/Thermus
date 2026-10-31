import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { initializePortal } from '../../../src/interfaces/user-portal/portal.ts';

// SO-07: the portal shows Setting up your workspace with a meta refresh until the tenant of the organization is live,
// and the connection guide only then. The server double answers GET workspace/status with the state of each case.

interface ServerState {
  readonly session: Readonly<Record<string, unknown>>;
  readonly productAccess: Readonly<Record<string, unknown>>;
  readonly workspace: Readonly<Record<string, unknown>>;
}

async function openPortal(server: ServerState) {
  const { document } = parseHTML('<html><head></head><body><div id="app">Loading...</div></body></html>');
  const requests: string[] = [];
  await initializePortal({
    container: document.getElementById('app'),
    fetch: async (path) => {
      requests.push(path);
      if (path === 'session') return Response.json(server.session);
      if (path === 'portal/access') return Response.json(server.productAccess);
      if (path === 'workspace/status') return Response.json(server.workspace);
      return new Response('Not Found', { status: 404 });
    },
    navigate: () => {},
  });
  return { document, requests };
}

const ada = { signedIn: true, email: 'ada@example.com', name: 'Ada Lovelace', organizationId: 'org_01ACME', mfaCompleted: true, csrfToken: 'csrf-of-the-session' };

const settingUp = 'Setting up your workspace. This takes about two minutes.';
const acmeAccess = { organizationId: 'org_01ACME', organizationName: 'Acme Labs', roles: ['admin'], plan: 'free', memberLimit: 5, mcpUrl: 'https://thermus.example/mcp' };

function refreshOf(document: Document): string | null | undefined {
  return document.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content');
}

for (const state of ['requested', 'creating', 'deploying']) {
  test(`Given a tenant in state ${state}, when the portal opens, then it shows Setting up your workspace with a refresh every 5 seconds and no connection guide`, async () => {
    const { document, requests } = await openPortal({ session: ada, productAccess: acmeAccess, workspace: { state, ready: false, message: settingUp } });
    const text = document.body.textContent ?? '';
    assert.equal(document.querySelector('.workspace-status')?.textContent, settingUp);
    assert.equal(document.querySelector('.workspace-status')?.getAttribute('role'), 'status');
    assert.equal(document.querySelector('.workspace-name')?.textContent, 'Workspace: Acme Labs');
    assert.equal(refreshOf(document), '5');
    assert.ok(document.querySelector('.connection-guide') === null, 'The portal shows no connection guide.');
    assert.doesNotMatch(text, /claude mcp add|MCP endpoint/);
    assert.equal(document.querySelectorAll('script').length, 0, 'The refresh needs no script.');
    assert.deepEqual(requests, ['session', 'portal/access', 'workspace/status']);
  });
}

for (const [state, message] of [
  ['failed', 'Workspace setup failed. We have been notified and will fix it.'],
  ['full', 'All free workspaces are in use. Try again later.'],
] as const) {
  test(`Given a ${state} workspace, when the portal opens, then it shows the words of the server, refreshes, and shows no connection guide`, async () => {
    const { document } = await openPortal({ session: ada, productAccess: acmeAccess, workspace: { state, ready: false, message } });
    assert.equal(document.querySelector('.workspace-status')?.textContent, message);
    assert.equal(refreshOf(document), '5');
    assert.ok(document.querySelector('.connection-guide') === null, 'The portal shows no connection guide.');
  });
}

test('Given a tenant that reaches live, when the portal opens again, then it shows the connection guide and no refresh', async () => {
  const before = await openPortal({ session: ada, productAccess: acmeAccess, workspace: { state: 'deploying', ready: false, message: settingUp } });
  assert.ok(before.document.querySelector('.connection-guide') === null, 'Before live, the portal shows no connection guide.');

  const { document } = await openPortal({ session: ada, productAccess: acmeAccess, workspace: { state: 'live', ready: true } });

  assert.ok(document.querySelector('.connection-guide') !== null, 'The portal shows the connection guide.');
  assert.match(document.body.textContent ?? '', /claude mcp add.*Sign in.*workspace.*Approve.*fetch/s);
  assert.ok(document.querySelector('.workspace-status') === null, 'A live workspace has no setup words.');
  assert.equal(refreshOf(document), undefined);
});
