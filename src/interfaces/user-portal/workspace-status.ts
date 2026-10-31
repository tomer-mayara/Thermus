// The workspace status answer of the server for the organization of the session (SO-07). The connection guide shows
// only when the workspace is ready; else the portal shows the words of the server as text. A ready workspace can have
// words too, the notice of a pause (SO-10). The words select nothing and give no access.
export type WorkspaceStatus = { readonly ready: true; readonly notice?: string } | { readonly ready: false; readonly message: string };

// The setup state reloads the page with a meta refresh, not with a script timer (answer 3 of 27 October 2026).
const REFRESH_SECONDS = '5';

// An answer that does not keep the contract throws, so that the portal shows the safe error and no guide.
export function workspaceStatus(body: unknown): WorkspaceStatus {
  const { ready, message } = (body ?? {}) as Partial<Record<'ready' | 'message', unknown>>;
  if (ready === true && message === undefined) return { ready };
  const words = typeof message === 'string' && message.trim() !== '' ? message : undefined;
  if (ready === true && words !== undefined) return { ready, notice: words };
  if (ready === false && words !== undefined) return { ready, message: words };
  throw new Error('The workspace status answer is not valid');
}

// What Connect shows: the words of a workspace that is not ready, with the refresh; else the connection guide, after
// the notice of a pause when the server gives one. A paused workspace restarts at the next MCP call, so it needs no
// refresh.
export function renderWorkspace(document: Document, status: WorkspaceStatus, guide: () => HTMLElement): HTMLElement[] {
  if (!status.ready) return [renderWorkspaceSetup(document, status)];
  if (status.notice === undefined) return [guide()];
  const notice = document.createElement('p');
  notice.className = 'workspace-notice';
  notice.textContent = status.notice;
  return [notice, guide()];
}

// The words of a workspace that is not ready, and a meta refresh every 5 s until the next read finds it ready.
function renderWorkspaceSetup(document: Document, status: { readonly message: string }): HTMLElement {
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
