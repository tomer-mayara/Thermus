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
}

// The paths are relative, so the portal works under any public base path of the server.
const paths = { session: 'session', productAccess: 'portal/access', signIn: 'login', signOut: 'logout', organizations: 'organizations' };
const readOptions: RequestInit = { credentials: 'same-origin', headers: { Accept: 'application/json' } };

export async function initializePortal(options: PortalOptions): Promise<void> {
  const { container } = options;
  if (!container) return;
  try {
    const answer = await options.fetch(paths.session, readOptions);
    if (answer.status === 401) return renderSignedOut(container, options.navigate);
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
    return;
  }
  if (answer.status !== 403) throw new Error('The product access request failed');
  status.textContent = 'Your account has no product access in the selected organization. ';
  const link = container.ownerDocument.createElement('a');
  link.href = paths.organizations;
  link.textContent = 'Open the organization page';
  status.append(link);
}

function productAccess(body: unknown): ProductAccess {
  const { organizationId, roles } = (body ?? {}) as Partial<Record<keyof ProductAccess, unknown>>;
  if (typeof organizationId !== 'string' || !Array.isArray(roles)) throw new Error('The product access answer is not valid');
  return { organizationId, roles: roles.map(String) };
}

function renderSignedIn(container: HTMLElement, session: SessionView): void {
  container.innerHTML = `
    <div class="auth-container">
      <h1></h1>
      <div class="user-info"></div>
      <p class="product-access" role="status">Checking your product access...</p>
      <form method="post">
        <input type="hidden" name="csrf_token">
        <button type="submit" id="sign-out-btn" class="btn btn-secondary">Sign Out</button>
      </form>
    </div>
  `;
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

function renderSignedOut(container: HTMLElement, navigate: (path: string) => void): void {
  container.innerHTML = `
    <div class="auth-container">
      <h1>Welcome to Thermus</h1>
      <p>Please sign in to continue.</p>
      <button id="sign-in-btn" class="btn btn-primary">Sign In</button>
    </div>
  `;
  container.querySelector('#sign-in-btn')?.addEventListener('click', () => navigate(paths.signIn));
}

function renderError(container: HTMLElement, message: string): void {
  container.innerHTML = '<div class="error" role="alert"><h1>Authentication Error</h1><p></p></div>';
  const paragraph = container.querySelector('p');
  if (paragraph) paragraph.textContent = message;
}
