import { createClient } from '@workos-inc/authkit-js';

const CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_WORKOS_REDIRECT_URI;

/**
 * Initialize AuthKit and set up the application
 */
async function initApp() {
  const app = document.getElementById('app');

  // createClient is async - must be awaited
  const authkit = await createClient(CLIENT_ID, {
    redirectUri: REDIRECT_URI,
  });

  // Handle /login route - auto sign-in for Initiate login URI
  if (window.location.pathname === '/login') {
    await authkit.signIn();
    return;
  }

  // Get the current user (returns null if not authenticated)
  const user = authkit.getUser();

  // Render the appropriate UI
  renderApp(app, authkit, user);
}

/**
 * Render the application based on auth state
 */
function renderApp(container, authkit, user) {
  if (user) {
    renderAuthenticatedUI(container, authkit, user);
  } else {
    renderUnauthenticatedUI(container, authkit);
  }
}

/**
 * Render UI for authenticated users
 */
function renderAuthenticatedUI(container, authkit, user) {
  container.innerHTML = `
    <div class="auth-container">
      <h1>Welcome, ${user.firstName || user.email}!</h1>
      <div class="user-info">
        <p><strong>Email:</strong> ${user.email}</p>
        ${user.firstName ? `<p><strong>Name:</strong> ${user.firstName} ${user.lastName || ''}</p>` : ''}
      </div>
      <button id="sign-out-btn" class="btn btn-secondary">Sign Out</button>
    </div>
  `;

  document.getElementById('sign-out-btn').addEventListener('click', async () => {
    await authkit.signOut();
  });
}

/**
 * Render UI for unauthenticated users
 */
function renderUnauthenticatedUI(container, authkit) {
  container.innerHTML = `
    <div class="auth-container">
      <h1>Welcome to Thermus</h1>
      <p>Please sign in to continue.</p>
      <button id="sign-in-btn" class="btn btn-primary">Sign In</button>
    </div>
  `;

  // signIn must be called from a user gesture (click handler)
  document.getElementById('sign-in-btn').addEventListener('click', async () => {
    await authkit.signIn();
  });
}

// Initialize the app
initApp().catch((error) => {
  console.error('Failed to initialize auth:', error);
  document.getElementById('app').innerHTML = `
    <div class="error">
      <h1>Authentication Error</h1>
      <p>Failed to initialize authentication. Please try again.</p>
    </div>
  `;
});
