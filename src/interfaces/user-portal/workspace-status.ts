// The workspace status answer of the server for the organization of the session (SO-07). The connection guide shows
// only when the workspace is ready; else the portal shows the words of the server as text. The words select nothing
// and give no access.
export type WorkspaceStatus = { readonly ready: true } | { readonly ready: false; readonly message: string };

// The setup state reloads the page with a meta refresh, not with a script timer (answer 3 of 27 October 2026).
const REFRESH_SECONDS = '5';

// An answer that does not keep the contract throws, so that the portal shows the safe error and no guide.
export function workspaceStatus(body: unknown): WorkspaceStatus {
  const { ready, message } = (body ?? {}) as Partial<Record<'ready' | 'message', unknown>>;
  if (ready === true) return { ready };
  if (ready === false && typeof message === 'string' && message.trim() !== '') return { ready, message };
  throw new Error('The workspace status answer is not valid');
}

// The words of a workspace that is not ready, and a meta refresh every 5 s until the next read finds it ready.
export function renderWorkspaceSetup(document: Document, status: { readonly message: string }): HTMLElement {
  const refresh = document.createElement('meta');
  refresh.setAttribute('http-equiv', 'refresh');
  refresh.setAttribute('content', REFRESH_SECONDS);
  (document.head ?? document.documentElement).append(refresh);
  const words = document.createElement('p');
  words.className = 'workspace-status';
  words.setAttribute('role', 'status');
  words.textContent = status.message;
  return words;
}
