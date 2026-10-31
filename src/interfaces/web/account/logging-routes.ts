import type { RequestContext } from '../../../accounts/identity/access-context.ts';
import type { AuditLog, DestinationChange } from '../../../logs/audit/audit-log.ts';
import { loggingRequestNotice, loggingTestNotice } from './logging-test-page.ts';
import type { DestinationSettingsService, DestinationSettingsSaveInput, DestinationSettingsSaveResult, DestinationTestResult, PublicDestinationSettings } from '../../../logs/audit/destination-settings-service.ts';
import type { AdministrationHandler } from './administration-routes.ts';
import { readForm } from './account-form.ts';
import type { FormRefusal } from './account-form.ts';
import { accessDeniedPage } from './account-pages.ts';
import { loggingForm } from './logging-form.ts';
import { loggingPage } from './logging-page.ts';
import type { LoggingNotice } from './logging-page.ts';

export interface LoggingRoutesOptions {
  readonly publicBaseUrl: string;
  readonly organizationsPage: string;
  readonly service?: Pick<DestinationSettingsService, 'read' | 'save'> & Partial<Pick<DestinationSettingsService, 'test'>>;
  readonly audit?: Pick<AuditLog, 'destinationChanged'>;
}

type LoggingAction = DestinationChange['action'];
interface LoggingScope extends Pick<RequestContext, 'tenantId' | 'user'> { readonly csrfToken: string }
interface SettingsView { readonly settings: PublicDestinationSettings; readonly notice?: LoggingNotice; readonly saved: boolean }

const unavailable: LoggingNotice = { title: 'Audit logs unavailable', message: 'Audit logs settings are unavailable. Read saved settings before making another change.', status: 503 };

// Current access is resolved before this boundary. The tenant and Admin permission come only from that decision.
export class LoggingRoutes {
  private readonly origin: string;
  private readonly paths: { readonly product: string; readonly members: string; readonly organizations: string; readonly quickStart: string; readonly logging: string; readonly save: string; readonly test: string };
  private readonly actions: ReadonlyMap<string, LoggingAction>;
  constructor(private readonly options: LoggingRoutesOptions) {
    this.origin = new URL(options.publicBaseUrl).origin;
    const path = (relative: string) => new URL(relative, options.publicBaseUrl).pathname;
    this.paths = { product: path(''), members: path('members'), organizations: options.organizationsPage, quickStart: path('quick-start'), logging: path('logging'), save: path('logging/save'), test: path('logging/test') };
    this.actions = new Map<string, LoggingAction>([[this.paths.save, 'save'], [this.paths.test, 'test']]);
  }

  handlerFor(path: string): AdministrationHandler | undefined {
    const action = this.actions.get(path);
    if (action === undefined && path !== this.paths.logging) return undefined;
    return async (request, session, context) => {
      const scope: LoggingScope = { csrfToken: session.csrfToken, tenantId: context.tenantId, user: context.user };
      if (!context.permissions.includes('admin-grants:manage')) return this.deny(request, scope, action);
      try {
        if (action !== undefined) return await this.change(request, scope, action);
        if (request.method !== 'GET' && request.method !== 'HEAD') return this.refuse('methodNotAllowed', 'GET, HEAD');
        return await this.readPage(scope);
      } catch {
        request.signal.throwIfAborted();
        // Collaborator errors can contain credentials. Do not pass their causes to the account failure reporter.
        return this.noticePage(unavailable);
      }
    };
  }

  private deny(request: Request, scope: LoggingScope, action: LoggingAction | undefined): Response {
    if (request.method === 'POST' && action !== undefined) this.keep(scope, action, 'denied');
    return accessDeniedPage(this.paths.organizations);
  }

  private async change(request: Request, scope: LoggingScope, action: LoggingAction): Promise<Response> {
    const settings = await this.submittedSettings(request, scope, action);
    if (settings instanceof Response) return settings;
    request.signal.throwIfAborted();
    if (this.options.service === undefined || (action === 'test' && this.options.service.test === undefined)) {
      this.keep(scope, action, 'unavailable');
      return this.noticePage(unavailable);
    }
    const saved = await this.saveSettings(request, scope, settings);
    if (!('settings' in saved)) return this.saveFailure(saved, scope);
    if (action === 'save') return this.settingsPage(scope, { settings: saved.settings, saved: true });
    const tested = await this.testSaved(request, scope, saved.settings);
    const notice = loggingTestNotice(tested);
    if (tested.status !== 'tested') return this.readPage(scope, notice, saved.settings.revision);
    return this.settingsPage(scope, { notice, settings: saved.settings, saved: true });
  }

  private async submittedSettings(request: Request, scope: LoggingScope, action: LoggingAction): Promise<DestinationSettingsSaveInput | Response> {
    if (request.method !== 'POST') return this.refuse('methodNotAllowed', 'POST');
    if (request.headers.get('Origin') !== this.origin) return this.refuse('forgedRequest');
    const body = await readForm(request);
    const form = typeof body === 'string' ? body : loggingForm(body, scope.csrfToken);
    if (typeof form === 'string') return this.refuse(form);
    if (form.tenantId !== scope.tenantId) {
      this.keep(scope, action, 'stale');
      return this.refuse('changeStale');
    }
    const { tenantId: _, ...settings } = form;
    return settings;
  }

  private async saveSettings(request: Request, scope: LoggingScope, settings: DestinationSettingsSaveInput): Promise<DestinationSettingsSaveResult> {
    let result: DestinationSettingsSaveResult;
    try { result = await this.options.service?.save(scope.tenantId, settings) ?? { status: 'unavailable' }; }
    catch {
      request.signal.throwIfAborted();
      result = { status: 'unconfirmed' };
    }
    this.keep(scope, 'save', result.status);
    return result;
  }

  private async testSaved(request: Request, scope: LoggingScope, settings: PublicDestinationSettings): Promise<DestinationTestResult> {
    const destination = { endpoint: settings.endpoint, ...(settings.axiomDataset === undefined ? {} : { axiomDataset: settings.axiomDataset }), auth: settings.auth, enabled: settings.enabled };
    request.signal.throwIfAborted();
    let result: DestinationTestResult;
    try { result = await this.options.service?.test?.(scope.tenantId, { ...destination, expectedRevision: settings.revision, token: '' }, scope.user, request.signal) ?? { status: 'unavailable' }; }
    catch {
      request.signal.throwIfAborted();
      result = { status: 'unconfirmed' };
    }
    this.keep(scope, 'test', result.status);
    return result;
  }

  private async saveFailure(result: Exclude<DestinationSettingsSaveResult, { readonly settings: PublicDestinationSettings }>, scope: LoggingScope): Promise<Response> {
    if (result.status === 'conflict') return this.readPage(scope, loggingRequestNotice('changeStale'));
    if (result.status === 'invalid') return this.readPage(scope, { title: 'Invalid settings', message: 'Check the public HTTPS endpoint, Axiom dataset, authentication, and token. No settings were saved. No Test was sent.', status: 400 });
    if (result.status === 'unconfirmed') return this.noticePage({ title: 'Save unconfirmed', message: 'The Save result is unconfirmed. No Test was sent. Read saved settings before making another change. A pending Save can finish after that read.', status: 503 });
    return this.noticePage(unavailable);
  }

  private async readPage(scope: LoggingScope, notice?: LoggingNotice, savedRevision?: string | null): Promise<Response> {
    const result = await this.options.service?.read(scope.tenantId).catch(() => ({ status: 'unavailable' as const }));
    if (result === undefined || result.status === 'unavailable') return this.noticePage(notice === undefined ? unavailable : { ...notice, status: 503, message: `${notice.message} Current saved settings are unavailable. Read saved settings before another change.` });
    return this.settingsPage(scope, { notice, settings: result.settings, saved: savedRevision !== undefined && result.settings.revision === savedRevision });
  }

  private noticePage(notice: LoggingNotice): Response {
    return loggingPage({ notice, saved: false, tenantId: '', csrfToken: '', action: this.paths.save, testAction: this.paths.test, navigation: this.paths });
  }

  private settingsPage(scope: LoggingScope, view: SettingsView): Response {
    return loggingPage({ ...view, tenantId: scope.tenantId, csrfToken: scope.csrfToken, action: this.paths.save, testAction: this.paths.test, navigation: this.paths });
  }

  private refuse(name: FormRefusal | 'changeStale' | 'methodNotAllowed', allow?: string): Response {
    const response = this.noticePage(loggingRequestNotice(name));
    if (allow !== undefined) response.headers.set('Allow', allow);
    return response;
  }

  private keep(scope: LoggingScope, action: LoggingAction, outcome: DestinationChange['outcome']): void {
    try {
      this.options.audit?.destinationChanged({ timestamp: new Date().toISOString(), organizationId: scope.tenantId, actor: scope.user, action, outcome });
    } catch {
      // Capture failure cannot change Save or Test, and must not expose an export cause.
    }
  }
}
