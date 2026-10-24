import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { initializePortal } from '../../../src/interfaces/user-portal/portal.ts';

interface ServerState {
  readonly session?: Readonly<Record<string, unknown>>;
  readonly productAccess?: Readonly<Record<string, unknown>>;
}

async function openPortal(server: ServerState) {
  const { document } = parseHTML('<html><body><div id="app">Loading...</div></body></html>');
  const navigations: string[] = [];
  const requests: string[] = [];
  await initializePortal({
    container: document.getElementById('app'),
    fetch: async (path) => {
      requests.push(path);
      if (path === 'session') return server.session ? Response.json(server.session) : Response.json({ signedIn: false }, { status: 401 });
      if (path === 'portal/access') return server.productAccess ? Response.json(server.productAccess) : new Response('<p>Access denied</p>', { status: 403 });
      return new Response('Not Found', { status: 404 });
    },
    navigate: (path) => navigations.push(path),
  });
  return { document, navigations, requests };
}

const ada = { signedIn: true, email: 'ada@example.com', name: 'Ada Lovelace', organizationId: 'org_01ACME', mfaCompleted: true, csrfToken: 'csrf-of-the-session' };

test('Given a signed-out visitor, when the portal opens, then the approved product story is complete', async () => {
  const { document } = await openPortal({});
  assert.equal(document.querySelector('main h1')?.textContent, 'Protect against prompt injection and data leaks from AI agents');
  assert.equal(document.querySelector('.eyebrow')?.textContent, 'MCP GATEWAY FOR AGENT WEB ACCESS');
  assert.equal(document.querySelector('.brand-copy')?.textContent, 'Security for organizations that are deploying organization-wide AI tools that give employees the ability to create agents.');
});

test('Given a signed-out visitor, when the welcome card appears, then both workspace entry routes and free access terms are available', async () => {
  const { document, requests } = await openPortal({});
  assert.equal(document.querySelector('.welcome-card h2')?.textContent, 'Welcome to Thermus');
  assert.equal(document.querySelector('.welcome-card > p')?.textContent, 'Sign in to open your workspace and connect your AI assistant.');
  assert.equal(document.querySelector('.welcome-card a[href="login"]')?.textContent, 'Sign in');
  assert.equal(document.querySelector('.welcome-card a[href="signup"]')?.textContent, 'Start free access');
  assert.ok(document.body.textContent?.includes('Free access requires no card and creates no automatic charge.'));
  assert.deepEqual(requests, ['session'], 'A signed-out visitor makes no protected request');
});

test('Given a signed-out visitor, when the portal opens, then brand and legal navigation remain available', async () => {
  const { document } = await openPortal({});
  assert.equal(document.querySelector('header a[href="./"] img')?.getAttribute('src'), '/assets/thermus-logo.svg');
  assert.equal(document.querySelector('header a[href="https://thermus.ai/"]')?.textContent, 'thermus.ai');
  assert.equal(document.querySelector('footer a[href="https://thermus.ai/privacy"]')?.textContent, 'Privacy Notice');
  assert.equal(document.querySelector('footer a[href="https://thermus.ai/terms"]')?.textContent, 'Terms of Service');
  assert.ok(document.querySelector('footer')?.textContent?.includes('Thermus AI Inc.'));
});

test('Given a signed-out visitor, when the product flow is read, then each request and response passes through Thermus', async () => {
  const { document } = await openPortal({});
  const diagram = document.querySelector('.product-flow');
  assert.equal(diagram?.getAttribute('role'), 'img');
  assert.equal(diagram?.getAttribute('aria-label'), 'Your agents send Request + reason to Thermus. Thermus sends Approved requests to The web. The web returns Raw pages to Thermus. Thermus returns Clean content to Your agents.');
  assert.deepEqual([...document.querySelectorAll('.flow-node text')].map((node) => node.textContent), ['Your agents', 'Thermus', 'The web']);
  assert.deepEqual([...document.querySelectorAll('.flow-label')].map((node) => node.textContent), ['Request + reason', 'Approved', 'Raw pages', 'Clean']);
  assert.equal(document.querySelectorAll('.flow-arrow').length, 4);
});

test('Given a signed-in user with User access, when the portal opens, then it shows the server profile and the product access of the current organization, and Sign Out posts the session form token to the sign-out route', async () => {
  const { document } = await openPortal({ session: ada, productAccess: { organizationId: 'org_01ACME', organizationName: 'Acme Labs', roles: ['admin', 'user'], plan: 'free', mcpUrl: 'https://thermus.example/mcp' } });
  assert.match(document.body.textContent ?? '', /Welcome, Ada Lovelace!.*Email: ada@example.com.*Name: Ada Lovelace/s);
  assert.match(document.body.textContent ?? '', /You have product access in organization org_01ACME\. Roles: admin, user\./);
  const form = document.querySelector('form');
  assert.equal(form?.getAttribute('method'), 'post');
  assert.equal(form?.getAttribute('action'), 'logout');
  assert.deepEqual([...document.querySelectorAll('form input')].map((input) => [input.getAttribute('type'), input.getAttribute('name'), (input as HTMLInputElement).value]), [
    ['hidden', 'csrf_token', 'csrf-of-the-session'],
  ]);
});

test('Given a signed-in user whose current grants do not include User, when the portal opens, then it shows no product access and keeps signup visible', async () => {
  const { document } = await openPortal({ session: { ...ada, name: undefined } });
  assert.match(document.body.textContent ?? '', /Welcome, ada@example.com!/);
  assert.match(document.body.textContent ?? '', /Your account has no product access in the selected organization\./);
  assert.ok(!document.querySelector('a[href^="organizations"]'), 'The portal must not link to the organization page');
  assert.doesNotMatch(document.body.textContent ?? '', /You have product access/);
});

test('Given HTML in the profile fields of the server, when the portal shows the profile, then those fields remain text', async () => {
  const name = '<img src=x onerror="alert(1)">';
  const { document } = await openPortal({ session: { ...ada, name, email: '<b>ada@example.com</b>' }, productAccess: { organizationId: '<script>alert(1)</script>', organizationName: 'Acme Labs', roles: ['<i>user</i>'], plan: 'free', mcpUrl: 'https://thermus.example/mcp' } });
  assert.equal(document.querySelector('img:not([src="/assets/thermus-logo.svg"]), script, b, i'), null, 'Server values must not create HTML elements');
  assert.ok(document.body.textContent?.includes(name));
  assert.ok(document.body.textContent?.includes('<b>ada@example.com</b>'));
});

test('Given product access, when the portal opens, then it keeps setup visible and puts technical access details in a closed disclosure below the steps', async () => {
  const { document } = await openPortal({ session: ada, productAccess: { organizationId: 'org_01ACME', organizationName: 'Acme Labs', roles: ['user'], plan: 'free', mcpUrl: 'https://thermus.example/mcp' } });
  const text = document.body.textContent ?? '';
  assert.equal(document.querySelector('.workspace-name')?.textContent, 'Workspace: Acme Labs');
  assert.equal(document.querySelector('.workspace-name')?.closest('details'), null);
  assert.match(text, /Free access.*No card.*no automatic charge/s);
  assert.match(text, /https:\/\/thermus.example\/mcp/);
  assert.match(text, /claude mcp add.*Sign in.*workspace.*Approve.*fetch/s);
  const details = document.querySelector('details');
  assert.ok(details, 'Access details must use a native disclosure');
  assert.equal(details.hasAttribute('open'), false, 'Access details must start closed');
  assert.equal(details.querySelector('summary')?.textContent, 'Details');
  assert.equal(details.parentElement?.lastElementChild, details, 'Details must follow the full connection guide');
  assert.match(details.textContent ?? '', /You have product access in organization org_01ACME\. Roles: user\./);
  assert.match(details.textContent ?? '', /only affects this browser.*own consent/s);
  assert.equal(details.querySelector('.product-access')?.getAttribute('role'), null, 'Closed technical details must not be announced as a status');
  assert.equal(document.querySelector('a[href="organizations"]')?.textContent, 'Switch workspace');
});

test('Given no product access, when the portal opens, then signup recovery remains visible', async () => {
  const { document } = await openPortal({ session: ada });
  assert.equal(document.querySelector('a[href="signup"]')?.textContent, 'Start free access');
  assert.equal(document.querySelector('a[href="signup"]')?.closest('details'), null);
  assert.equal(document.querySelector('details'), null);
  assert.equal(document.querySelector('select'), null, 'A user without access has no connection guide');
  assert.ok(!document.querySelector('a[href^="organizations"]'), 'The portal must not link to the organization page');
});

test('Given product access at a custom endpoint, when the portal opens, then Claude Code is selected with the endpoint from the server', async () => {
  const mcpUrl = 'https://gateway.example/team/thermus/mcp';
  const { document } = await openPortal({ session: ada, productAccess: { organizationId: 'org_custom', organizationName: 'Acme Labs', roles: ['user'], plan: 'free', mcpUrl } });
  const select = document.querySelector<HTMLSelectElement>('#ai-agent');
  assert.ok(select, 'The guide has a native AI agent selector');
  assert.equal(document.querySelector('label[for="ai-agent"]')?.textContent, 'Your AI agent');
  assert.equal(select.value, 'claude-code');
  assert.match(document.querySelector('.connection-guide')?.textContent ?? '', /claude mcp add/);
  assert.equal([...document.querySelectorAll('p')].find((paragraph) => paragraph.textContent === `MCP endpoint: ${mcpUrl}`)?.textContent, `MCP endpoint: ${mcpUrl}`);
  assert.doesNotMatch(document.body.textContent ?? '', /Add the MCP endpoint as a remote HTTP server in your client/);
});

const clientGuides = [
  ['cli', 'codex', /codex mcp add/, 'https://learn.chatgpt.com/docs/extend/mcp?surface=cli'],
  ['desktop', 'cursor', /mcpServers/, 'https://cursor.com/docs/mcp'],
  ['desktop', 'vscode', /MCP: Add Server/, 'https://code.visualstudio.com/docs/agent-customization/mcp-servers'],
  ['desktop', 'claude', /custom connector/i, 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp'],
  ['desktop', 'codex-app', /Settings → MCP servers → Add server/, 'https://learn.chatgpt.com/docs/extend/mcp?surface=app'],
  ['desktop', 'chatgpt', /Use ChatGPT on the web.*Add custom MCP server/i, 'https://developers.openai.com/api/docs/guides/custom-mcp-server'],
  ['desktop', 'other', /remote HTTP/i, 'https://modelcontextprotocol.io/docs/learn/client-concepts'],
] as const;

for (const [method, value, expected, guideUrl] of clientGuides) {
  test(`Given product access, when the user selects ${value}, then its quick guide uses the configured endpoint without another request`, async () => {
    const mcpUrl = 'https://gateway.example/team/thermus/mcp';
    const { document, requests } = await openPortal({ session: ada, productAccess: { organizationId: 'org_custom', organizationName: 'Acme Labs', roles: ['user'], plan: 'free', mcpUrl } });
    const select = document.querySelector<HTMLSelectElement>('#ai-agent');
    const view = document.defaultView;
    assert.ok(select);
    assert.ok(view);
    const radio = document.querySelector<HTMLInputElement>(`input[name="connection-method"][value="${method}"]`);
    assert.ok(radio);
    radio.checked = true;
    radio.dispatchEvent(new view.Event('change'));
    for (const option of select.querySelectorAll('option')) option.removeAttribute('selected');
    const selected = select.querySelector<HTMLOptionElement>(`option[value="${value}"]`);
    assert.ok(selected);
    selected.selected = true;
    select.dispatchEvent(new view.Event('change'));
    const guide = document.querySelector('.connection-guide');
    assert.ok(guide);
    assert.match(guide.textContent ?? '', expected);
    assert.ok(guide.textContent?.includes(mcpUrl));
    assert.deepEqual([...guide.querySelectorAll('h3')].map((heading) => heading.textContent), ['Add Thermus', 'Authorize access', 'Try it']);
    assert.equal(guide.querySelector('.client-guide')?.getAttribute('href'), guideUrl);
    assert.equal(guide.querySelector('.test-prompt')?.textContent, 'Use Thermus to fetch https://example.com and summarize the page.');
    assert.equal(document.querySelector('details')?.hasAttribute('open'), false);
    assert.equal(document.querySelector('details')?.parentElement?.lastElementChild?.localName, 'details');
    assert.deepEqual(requests, ['session', 'portal/access']);
  });
}

test('Given a signed-in user at a custom endpoint, when they choose Desktop and Web Apps and return to CLI, then each setup method offers its own apps without another request', async () => {
  const mcpUrl = 'https://gateway.example/team/thermus/mcp';
  const { document, requests } = await openPortal({ session: ada, productAccess: { organizationId: 'org_custom', organizationName: 'Acme Labs', roles: ['user'], plan: 'free', mcpUrl } });
  const view = document.defaultView;
  assert.ok(view);
  const methods = document.querySelector('fieldset');
  assert.ok(methods);
  assert.equal(methods.querySelector('legend')?.textContent, 'Connect with');
  assert.deepEqual([...methods.querySelectorAll('label')].map((label) => label.textContent), ['CLI', 'Desktop and Web Apps']);
  const select = document.querySelector<HTMLSelectElement>('#ai-agent');
  assert.ok(select);
  assert.deepEqual([...select.querySelectorAll('option')].map((option) => option.textContent), ['Claude Code', 'Codex CLI']);
  const desktop = methods.querySelector<HTMLInputElement>('input[value="desktop"]');
  assert.ok(desktop);
  desktop.checked = true;
  desktop.dispatchEvent(new view.Event('change'));
  assert.equal(select.value, 'claude');
  assert.equal(document.querySelector('label[for="ai-agent"]')?.textContent, 'Your desktop app');
  assert.deepEqual([...select.querySelectorAll('option')].map((option) => option.textContent), ['Claude (web / desktop)', 'Codex app', 'ChatGPT (web setup)', 'Cursor', 'VS Code', 'Other MCP client']);
  assert.equal(document.querySelector('.add-content code')?.textContent, mcpUrl);
  assert.match(document.querySelector('.add-content')?.textContent ?? '', /Connectors/);
  assert.match(document.querySelector('.authorize-content')?.textContent ?? '', /Sign in.*workspace.*Approve/s);

  const cli = methods.querySelector<HTMLInputElement>('input[value="cli"]');
  assert.ok(cli);
  cli.checked = true;
  cli.dispatchEvent(new view.Event('change'));
  assert.equal(select.value, 'claude-code');
  assert.equal(document.querySelector('label[for="ai-agent"]')?.textContent, 'Your AI agent');
  assert.match(document.querySelector('.add-content code')?.textContent ?? '', /claude mcp add/);
  assert.deepEqual(requests, ['session', 'portal/access']);
});

for (const role of ['admin', 'user']) {
  test(`Given a current ${role}, when the portal opens, then workspace navigation matches the current server role and legal links need no invited-member agreement`, async () => {
    const { document, requests } = await openPortal({ session: { ...ada, roles: ['admin'] }, productAccess: {
      organizationId: 'org_01ACME', organizationName: 'Acme Labs', roles: [role], plan: 'free', mcpUrl: 'https://thermus.example/mcp',
    } });
    const navigation = document.querySelector('nav[aria-label="Workspace"]');
    assert.ok(navigation);
    assert.equal(navigation.querySelector('a[aria-current="page"]')?.textContent, 'Product / Connect');
    assert.equal(navigation.querySelector('a[aria-current="page"]')?.getAttribute('href'), './');
    assert.equal(navigation.querySelector('a[href="organizations"]')?.textContent, 'Switch workspace');
    assert.equal(navigation.querySelector('a[href="members"]')?.textContent ?? null, role === 'admin' ? 'Members' : null);
    assert.equal(navigation.querySelector('a[href="logging"]')?.textContent ?? null, role === 'admin' ? 'Audit logs' : null);
    assert.doesNotMatch(navigation.textContent ?? '', /Security|Remove|Change role|MFA/);
    assert.equal(document.querySelector('footer a[href="https://thermus.ai/privacy"]')?.textContent, 'Privacy Notice');
    assert.equal(document.querySelector('footer a[href="https://thermus.ai/terms"]')?.textContent, 'Terms of Service');
    assert.equal(document.querySelector('input[type="checkbox"]'), null);
    assert.deepEqual([...document.querySelectorAll('form')].map((form) => form.getAttribute('action')), ['logout']);
    assert.deepEqual(requests, ['session', 'portal/access']);
  });
}
