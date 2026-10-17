import { productFlow } from './product-flow.ts';

// The server owns the browser session: it signs in, keeps the sealed HttpOnly cookie, and signs out. The portal only
// reads the session and the product access from the server on the same origin, so no profile or organization value of
// the browser can select a tenant or give access.
type PortalFetch = (path: string, init: RequestInit) => Promise<Response>;

export interface PortalOptions {
  container: HTMLElement | null;
  fetch: PortalFetch;
  navigate: (path: string) => void;
}

interface SessionView {
  readonly email: string;
  readonly name?: string;
  readonly csrfToken: string;
}

interface ProductAccess {
  readonly organizationId: string;
  readonly roles: readonly string[];
  readonly plan: 'free';
  readonly mcpUrl: string;
}

// The paths are relative, so the portal works under any public base path of the server.
const paths = { session: 'session', productAccess: 'portal/access', signIn: 'login', signOut: 'logout', organizations: 'organizations' };
const readOptions: RequestInit = { credentials: 'same-origin', headers: { Accept: 'application/json' } };

export async function initializePortal(options: PortalOptions): Promise<void> {
  const { container } = options;
  if (!container) return;
  try {
    const answer = await options.fetch(paths.session, readOptions);
    if (answer.status === 401) return renderSignedOut(container);
    if (answer.status !== 200) throw new Error('The session request failed');
    renderSignedIn(container, sessionView(await answer.json()));
    await showProductAccess(container, options.fetch);
  } catch {
    renderError(container, 'Failed to load your session. Please try again.');
  }
}

function sessionView(body: unknown): SessionView {
  const { email, name, csrfToken } = (body ?? {}) as Partial<Record<keyof SessionView, unknown>>;
  if (typeof email !== 'string' || typeof csrfToken !== 'string') throw new Error('The session answer is not valid');
  return { email, csrfToken, ...(typeof name === 'string' && name !== '' ? { name } : {}) };
}

async function showProductAccess(container: HTMLElement, fetch: PortalFetch): Promise<void> {
  const status = container.querySelector('.product-access');
  if (!status) return;
  const answer = await fetch(paths.productAccess, readOptions);
  if (answer.status === 200) {
    const access = productAccess(await answer.json());
    status.textContent = `You have product access in organization ${access.organizationId}. Roles: ${access.roles.join(', ')}.`;
    showConnection(container, access);
    showWorkspaceSelection(status);
    return;
  }
  if (answer.status !== 403) throw new Error('The product access request failed');
  status.textContent = 'Your account has no product access in the selected organization. ';
  const link = container.ownerDocument.createElement('a');
  link.href = 'signup';
  link.textContent = 'Start free access';
  status.append(link);
  showWorkspaceSelection(status);
}

function productAccess(body: unknown): ProductAccess {
  const { organizationId, roles, plan, mcpUrl } = (body ?? {}) as Partial<Record<keyof ProductAccess, unknown>>;
  if (typeof organizationId !== 'string' || !Array.isArray(roles) || plan !== 'free' || typeof mcpUrl !== 'string') throw new Error('The product access answer is not valid');
  const endpoint = new URL(mcpUrl);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('The MCP endpoint is not valid');
  return { organizationId, roles: roles.map(String), plan, mcpUrl };
}

function showWorkspaceSelection(container: Element): void {
  const document = container.ownerDocument;
  const link = document.createElement('a');
  const basePath = new URL('.', document.baseURI || 'https://portal.invalid/').pathname;
  link.href = `${paths.organizations}?return_to=${encodeURIComponent(basePath)}`;
  link.className = 'workspace-selection';
  link.textContent = 'Open the organization page';
  const explanation = document.createElement('span');
  explanation.append(document.createTextNode(' '), link, document.createTextNode('. This selection only affects this browser. Your MCP client uses the workspace from its own consent.'));
  container.append(explanation);
}

function showConnection(container: HTMLElement, access: ProductAccess): void {
  const document = container.ownerDocument;
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Connect your MCP client';
  const plan = document.createElement('p');
  plan.textContent = 'Free access. No card is required and there is no automatic charge.';
  const endpoint = document.createElement('p');
  endpoint.textContent = `MCP endpoint: ${access.mcpUrl}`;
  const steps = document.createElement('ol');
  for (const instruction of [
    'Add the MCP endpoint as a remote HTTP server in your client.',
    'Sign in when your client asks.',
    'Choose the intended workspace in the client consent screen.',
    'Approve the connection.',
    'Ask your client to fetch a page to test access.',
  ]) {
    const item = document.createElement('li');
    item.textContent = instruction;
    steps.append(item);
  }
  section.append(heading, plan, endpoint, steps);
  container.querySelector('.auth-container')?.append(section);
}

function renderSignedIn(container: HTMLElement, session: SessionView): void {
  renderPage(container, `
    <div class="auth-container">
      <h1></h1>
      <div class="user-info"></div>
      <p class="product-access" role="status">Checking your product access...</p>
      <form method="post">
        <input type="hidden" name="csrf_token">
        <button type="submit" id="sign-out-btn" class="btn btn-secondary">Sign Out</button>
      </form>
    </div>
  `, 'workspace-page');
  const heading = container.querySelector('h1');
  const info = container.querySelector('.user-info');
  const form = container.querySelector('form');
  const token = container.querySelector<HTMLInputElement>('input[name="csrf_token"]');
  if (heading) heading.textContent = `Welcome, ${session.name ?? session.email}!`;
  if (info) {
    appendProfileField(info, 'Email:', session.email);
    if (session.name) appendProfileField(info, 'Name:', session.name);
  }
  form?.setAttribute('action', paths.signOut);
  if (token) token.value = session.csrfToken;
}

function appendProfileField(container: Element, label: string, value: string): void {
  const document = container.ownerDocument;
  const paragraph = document.createElement('p');
  const caption = document.createElement('strong');
  caption.textContent = label;
  paragraph.append(caption, document.createTextNode(` ${value}`));
  container.append(paragraph);
}

function renderSignedOut(container: HTMLElement): void {
  renderPage(container, `
    <section class="brand-panel" aria-labelledby="product-title">
      <p class="eyebrow">MCP GATEWAY FOR AGENT WEB ACCESS</p>
      <h1 id="product-title">Protect against prompt injection and data leaks from <span class="agent-phrase">AI agents</span></h1>
      <p class="brand-copy">Security for organizations that are deploying organization-wide AI tools that give employees the ability to create agents.</p>
      ${productFlow}
    </section>
    <section class="welcome-card" aria-labelledby="welcome-title">
      <h2 id="welcome-title">Welcome to Thermus</h2>
      <p>Sign in to open your workspace and connect your AI assistant.</p>
      <a id="sign-in-btn" class="btn btn-primary" href="${paths.signIn}">Sign in</a>
      <div class="free-access">
        <p class="new-visitor">New to Thermus?</p>
        <a class="btn btn-secondary" href="signup">Start free access</a>
        <p class="helper">Free access requires no card and creates no automatic charge.</p>
      </div>
    </section>
  `, 'entry-page');
}

function renderError(container: HTMLElement, message: string): void {
  renderPage(container, '<div class="error" role="alert"><h1>Authentication Error</h1><p></p><a class="retry-link" href="./">Try again</a></div>', 'notice-page');
  const paragraph = container.querySelector('main p');
  if (paragraph) paragraph.textContent = message;
}

function renderPage(container: HTMLElement, content: string, pageClass: string): void {
  container.innerHTML = `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
      <div class="header-content">
        <a class="brand-home" href="./" aria-label="Thermus home"><img src="/assets/thermus-logo.svg" alt="Thermus" width="166" height="48"></a>
        <a class="website-link" href="https://thermus.ai/">thermus.ai</a>
      </div>
    </header>
    <main id="main-content" class="${pageClass}" tabindex="-1">${content}</main>
    <footer class="site-footer">
      <div class="footer-content">
        <p>Thermus AI Inc.</p>
        <nav aria-label="Legal"><a href="https://thermus.ai/privacy">Privacy Notice</a><a href="https://thermus.ai/terms">Terms of Service</a></nav>
      </div>
    </footer>
  `;
}
