import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { initializePortal, type PortalOptions } from '../../../src/interfaces/user-portal/portal.ts';

// SO-07: the portal reads GET workspace/status after the product access and shows the connection guide only when the
// workspace is ready. Else it shows the words of the server and reloads with a meta refresh.

type Answers = Readonly<Record<string, () => Promise<Response>>>;

const session = { signedIn: true, email: 'ada@example.com', name: 'Ada Lovelace', mfaCompleted: true, csrfToken: 'csrf-secret' };
const signedIn = async () => Response.json(session);

function portal(answers: Answers) {
  const { document } = parseHTML('<html><head></head><body><div id="app">Loading...</div></body></html>');
  const requests: Array<{ path: string; init: RequestInit }> = [];
  const options: PortalOptions = {
    container: document.getElementById('app'),
    fetch: async (path, init) => {
      requests.push({ path, init });
      const answer = answers[path];
      if (answer === undefined) return assert.fail(`The portal must not request ${path}`);
      return answer();
    },
    navigate: () => {},
  };
  return { document, options, requests };
}

const access = async () => Response.json({ organizationId: 'org_01A', organizationName: 'Acme Labs', roles: ['admin'], plan: 'free', memberLimit: 5, mcpUrl: 'https://thermus.example/mcp' });
const settingUp = 'Setting up your workspace. This takes about two minutes.';

function refreshOf(document: Document): string | null | undefined {
  return document.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content');
}

for (const state of ['requested', 'creating', 'deploying', 'failed', 'deleted', 'full', 'unavailable']) {
  test(`Given a workspace in state ${state} that is not ready, when the portal opens, then it shows the words of the server as a status with a meta refresh every 5 seconds and no connection guide`, async () => {
    const message = state === 'failed' ? '<b>Workspace setup failed.</b>' : settingUp;
    const { document, options } = portal({ session: signedIn, 'portal/access': access, 'workspace/status': async () => Response.json({ state, ready: false, message }) });
    await initializePortal(options);
    const status = document.querySelector('.workspace-status');
    assert.equal(status?.textContent, message);
    assert.equal(status?.getAttribute('role'), 'status');
    assert.equal(document.querySelector('b'), null, 'The words of the server stay text.');
    assert.equal(document.querySelector('.workspace-name')?.textContent, 'Workspace: Acme Labs');
    assert.equal(document.querySelector('section h2')?.textContent, 'Connect your MCP client');
    assert.equal(refreshOf(document), '5');
    assert.equal(document.querySelectorAll('meta[http-equiv="refresh"]').length, 1);
    assert.ok(document.querySelector('.connection-guide') === null, 'The guide waits until the workspace is ready.');
    assert.ok(document.querySelector('details') !== null, 'The access details stay available.');
  });
}

test('Given a ready workspace, when the portal opens, then it shows the connection guide with no status words and no refresh', async () => {
  const { document, options } = portal({ session: signedIn, 'portal/access': access, 'workspace/status': async () => Response.json({ state: 'live', ready: true }) });
  await initializePortal(options);
  assert.ok(document.querySelector('.connection-guide') !== null, 'A ready workspace shows the guide.');
  assert.ok(document.querySelector('.workspace-status') === null, 'A ready workspace has no status words.');
  assert.ok(document.querySelector('.workspace-notice') === null, 'A ready answer without words has no notice.');
  assert.equal(refreshOf(document), undefined);
});

test('Given a ready workspace with words, such as the notice of a pause, when the portal opens, then it shows the words as text above the connection guide, with no refresh', async () => {
  const words = '<b>Your workspace was paused.</b>';
  const { document, options } = portal({ session: signedIn, 'portal/access': access, 'workspace/status': async () => Response.json({ state: 'suspended', ready: true, message: words }) });
  await initializePortal(options);
  const notice = document.querySelector('.workspace-notice');
  assert.equal(notice?.textContent, words);
  assert.equal(document.querySelector('b'), null, 'The words of the server stay text.');
  assert.ok(notice?.nextElementSibling?.querySelector('.connection-guide'), 'The notice comes just before the guide.');
  assert.ok(document.querySelector('.workspace-status') === null, 'A ready workspace has no status words.');
  assert.equal(refreshOf(document), undefined);
});

for (const [label, answer] of [
  ['without ready', async () => Response.json({ state: 'live' })],
  ['with a text ready', async () => Response.json({ state: 'live', ready: 'true' })],
  ['not ready without words', async () => Response.json({ state: 'requested', ready: false })],
  ['not ready with empty words', async () => Response.json({ state: 'requested', ready: false, message: ' ' })],
  ['not ready with a number for words', async () => Response.json({ state: 'requested', ready: false, message: 5 })],
  ['ready with empty words', async () => Response.json({ state: 'suspended', ready: true, message: ' ' })],
  ['ready with a number for words', async () => Response.json({ state: 'suspended', ready: true, message: 14 })],
  ['with status 500', async () => new Response('failure', { status: 500 })],
  ['with status 403', async () => Response.json({ access: 'denied' }, { status: 403 })],
  ['that is not JSON', async () => new Response('<p>no</p>', { headers: { 'Content-Type': 'text/html' } })],
] as const) {
  test(`Given a workspace status answer ${label}, when the portal opens, then it shows the safe error, no guide, and no refresh`, async () => {
    const { document, options } = portal({ session: signedIn, 'portal/access': access, 'workspace/status': answer });
    await initializePortal(options);
    assert.match(document.body.textContent ?? '', /Failed to load your session/);
    assert.ok(document.querySelector('.connection-guide') === null, 'An invalid status shows no guide.');
    assert.equal(refreshOf(document), undefined);
  });
}

test('Given no product access, when the portal opens, then it does not read the workspace status', async () => {
  const { options, requests } = portal({ session: signedIn, 'portal/access': async () => new Response(null, { status: 403 }) });
  await initializePortal(options);
  assert.deepEqual(requests.map(({ path }) => path), ['session', 'portal/access']);
});
