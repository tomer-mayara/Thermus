import type { createClient, User } from '@workos-inc/authkit-js';

type AuthKitClient = Pick<Awaited<ReturnType<typeof createClient>>, 'getUser' | 'signIn' | 'signOut'>;
type ClientFactory = (clientId: string, options: { redirectUri: string }) => Promise<AuthKitClient>;

export interface PortalOptions {
  container: HTMLElement | null;
  pathname: string;
  clientId: string | undefined;
  redirectUri: string | undefined;
}

export async function initializePortal(options: PortalOptions, createAuthKit: ClientFactory): Promise<void> {
  const { container, pathname, clientId, redirectUri } = options;
  if (!container) return;
  try {
    if (!clientId?.trim() || !redirectUri?.trim()) throw new Error('AuthKit configuration is missing');
    const authkit = await createAuthKit(clientId, { redirectUri });
    if (pathname === '/login') {
      await authkit.signIn();
      return;
    }
    const user = authkit.getUser();
    if (user) renderAuthenticated(container, authkit, user);
    else renderSignedOut(container, authkit);
  } catch {
    renderError(container, 'Failed to initialize authentication. Please try again.');
  }
}

function renderAuthenticated(container: HTMLElement, authkit: AuthKitClient, user: User): void {
  container.innerHTML = `
    <div class="auth-container">
      <h1></h1>
      <div class="user-info"></div>
      <button id="sign-out-btn" class="btn btn-secondary">Sign Out</button>
    </div>
  `;
  const heading = container.querySelector('h1');
  const info = container.querySelector('.user-info');
  if (heading) heading.textContent = `Welcome, ${user.firstName || user.email}!`;
  if (info) {
    appendProfileField(info, 'Email:', user.email);
    if (user.firstName) appendProfileField(info, 'Name:', `${user.firstName} ${user.lastName || ''}`);
  }
  bindAuthAction(container, { selector: '#sign-out-btn', run: () => authkit.signOut(), message: 'Failed to sign out. Please try again.' });
}

function appendProfileField(container: Element, label: string, value: string): void {
  const document = container.ownerDocument;
  const paragraph = document.createElement('p');
  const caption = document.createElement('strong');
  caption.textContent = label;
  paragraph.append(caption, document.createTextNode(` ${value}`));
  container.append(paragraph);
}

function renderSignedOut(container: HTMLElement, authkit: AuthKitClient): void {
  container.innerHTML = `
    <div class="auth-container">
      <h1>Welcome to Thermus</h1>
      <p>Please sign in to continue.</p>
      <button id="sign-in-btn" class="btn btn-primary">Sign In</button>
    </div>
  `;
  bindAuthAction(container, { selector: '#sign-in-btn', run: () => authkit.signIn(), message: 'Failed to sign in. Please try again.' });
}

function bindAuthAction(container: HTMLElement, action: { selector: string; run: () => void | Promise<void>; message: string }): void {
  container.querySelector(action.selector)?.addEventListener('click', async () => {
    try {
      await action.run();
    } catch {
      renderError(container, action.message);
    }
  });
}

function renderError(container: HTMLElement, message: string): void {
  container.innerHTML = '<div class="error" role="alert"><h1>Authentication Error</h1><p></p></div>';
  const paragraph = container.querySelector('p');
  if (paragraph) paragraph.textContent = message;
}
