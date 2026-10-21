import { initializePortal } from './portal.ts';
import './style.css';

await initializePortal({
  container: document.getElementById('app'),
  fetch: (path, init) => fetch(path, init),
  navigate: (path) => window.location.assign(path),
});
