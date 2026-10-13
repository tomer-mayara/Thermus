import { createClient } from '@workos-inc/authkit-js';
import { initializePortal } from './portal.ts';
import './style.css';

await initializePortal({
  container: document.getElementById('app'),
  pathname: window.location.pathname,
  clientId: import.meta.env.VITE_WORKOS_CLIENT_ID,
  redirectUri: import.meta.env.VITE_WORKOS_REDIRECT_URI,
}, createClient);
