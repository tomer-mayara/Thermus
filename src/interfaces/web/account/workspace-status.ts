import { waitForRequest } from '../../../runtime/http/request-cancellation.ts';
import { noticePage } from './account-pages.ts';
import { PORTAL_JSON_HEADERS, portalAccessDenied } from './portal-access.ts';

/**
 * The state of the tenant of an organization: the state of its registry row, or for an organization without a row, a
 * full free-tenant cap. unavailable: the registry cannot say.
 */
export type WorkspaceState = 'requested' | 'creating' | 'deploying' | 'live' | 'suspended' | 'failed' | 'deleted' | 'full' | 'unavailable';

/** The tenant registry as the portal needs it. App composes this port on the tenants owner, so web imports no registry module. */
export interface WorkspaceTenants {
  /** The state of the tenant of an organization with product access. For an organization without a row, the read requests the tenant inside the cap. */
  stateOf(organizationId: string): Promise<WorkspaceState>;
}

/** What the portal shows: the connection guide when the workspace is ready, else the words of its state. */
export interface WorkspaceView {
  readonly state: WorkspaceState;
  readonly ready: boolean;
  readonly message?: string;
}

// The words of the portal (plan section 4.2, answers of 27 October 2026). A failed setup, a full cap, a removed tenant,
// and an unreadable registry have the words of the MCP gateway. Web cannot import mcp, so this is their second copy.
const WORDS = Object.freeze({
  settingUp: 'Setting up your workspace. This takes about two minutes.',
  failed: 'Workspace setup failed. We have been notified and will fix it.',
  full: 'All free workspaces are in use. Try again later.',
  deleted: 'Your workspace is not available. Contact Thermus support.',
  unavailable: 'The service is temporarily unavailable. Try again in 15 seconds.',
});

// The connection guide appears only when the tenant is live, or suspended: the gateway resumes a suspended tenant at
// the next MCP call (SO-10), and the view of the class adds the notice of the pause.
const VIEWS: Readonly<Record<Exclude<WorkspaceState, 'suspended'>, Omit<WorkspaceView, 'state'>>> = {
  requested: { ready: false, message: WORDS.settingUp },
  creating: { ready: false, message: WORDS.settingUp },
  deploying: { ready: false, message: WORDS.settingUp },
  live: { ready: true },
  failed: { ready: false, message: WORDS.failed },
  deleted: { ready: false, message: WORDS.deleted },
  full: { ready: false, message: WORDS.full },
  unavailable: { ready: false, message: WORDS.unavailable },
};

// The notice of a free tenant that the idle sweep paused (SO-10, answer 3 of 27 October 2026). Its days are those of
// FREE_TENANT_IDLE_DAYS, so the words stay true for another setting.
function pausedView(idleDays: number): Omit<WorkspaceView, 'state'> {
  return { ready: true, message: `Your workspace was paused after ${idleDays} days without use. It restarts on the next request, which can take about a minute.` };
}

// The organizations that got their one report of a failed setup. At this size, the memory starts again.
const REPORT_MEMORY = 1_024;

/** The workspace status of the portal (SO-07): the view of the state of a tenant, and the operator report of a failed setup. */
export class WorkspaceStatuses {
  /** The port that app composes on the tenants owner. */
  private readonly tenants: WorkspaceTenants;
  /** The operator report: one error line. */
  private readonly report: (line: string) => void;
  /** The organizations whose failed setup has its report. */
  private readonly reported = new Set<string>();
  /** The view of each state, with the notice of a paused workspace. */
  private readonly views: Readonly<Record<WorkspaceState, Omit<WorkspaceView, 'state'>>>;

  /** idleDays is FREE_TENANT_IDLE_DAYS, the days that the notice of a paused workspace names. */
  constructor(tenants: WorkspaceTenants, report: (line: string) => void, idleDays: number) {
    this.tenants = tenants;
    this.report = report;
    this.views = { ...VIEWS, suspended: pausedView(idleDays) };
  }

  /**
   * The answer of GET workspace/status. The account routes give the organization only for current product access in
   * the organization that the session selected; without it, the answer is the denial of the portal, before any
   * registry work.
   */
  async answer(request: Request, organizationId: string | undefined): Promise<Response> {
    if (organizationId === undefined) return portalAccessDenied();
    if (request.method !== 'GET' && request.method !== 'HEAD') return noticePage('methodNotAllowed', { Allow: 'GET, HEAD' });
    const view = await waitForRequest(request.signal, () => this.viewOf(organizationId));
    request.signal.throwIfAborted();
    const json = Response.json(view, { headers: PORTAL_JSON_HEADERS });
    return request.method === 'HEAD' ? new Response(null, { status: json.status, headers: json.headers }) : json;
  }

  async viewOf(organizationId: string): Promise<WorkspaceView> {
    const state = await this.tenants.stateOf(organizationId);
    this.reportFailedSetup(organizationId, state);
    return { state, ...this.views[state] };
  }

  // A failed setup reports one time, until the tenant leaves the failed state. An unreadable registry says nothing
  // about the row, so it keeps the memory.
  private reportFailedSetup(organizationId: string, state: WorkspaceState): void {
    if (state !== 'failed') {
      if (state !== 'unavailable') this.reported.delete(organizationId);
      return;
    }
    if (this.reported.has(organizationId)) return;
    if (this.reported.size >= REPORT_MEMORY) this.reported.clear();
    this.reported.add(organizationId);
    this.report(`Workspace setup failed: ${JSON.stringify({ organizationId })}`);
  }
}
