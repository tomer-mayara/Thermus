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

const unavailable: LoggingNotice = { title: 'Audit logs unavailable', message: 'Audit logs settings are unavailable. Read saved settings before making another change.', status: 503 };

// Current access is resolved before this boundary. The tenant and Admin permission come only from that decision.
export class LoggingRoutes {
  private readonly origin: string;
  private readonly paths: { readonly product: string; readonly members: string; readonly organizations: string; readonly logging: string; readonly save: string; readonly test: string };
  constructor(private readonly options: LoggingRoutesOptions) {
    this.origin = new URL(options.publicBaseUrl).origin;
    const path = (relative: string) => new URL(relative, options.publicBaseUrl).pathname;
    this.paths = { product: path(''), members: path('members'), organizations: options.organizationsPage, logging: path('logging'), save: path('logging/save'), test: path('logging/test') };
  }

  handlerFor(path: string): AdministrationHandler | undefined {
    if (path !== this.paths.logging && path !== this.paths.save && path !== this.paths.test) return undefined;
    return async (request, session, context) => {
      if (!context.permissions.includes('admin-grants:manage')) {
        if (request.method === 'POST' && (path === this.paths.save || path === this.paths.test)) this.keep(context, path === this.paths.save ? 'save' : 'test', 'denied');
        return accessDeniedPage(this.paths.organizations);
      }
      try {
        if (path === this.paths.test || path === this.paths.save) return await this.change(request, session.csrfToken, context, path === this.paths.test ? 'test' : 'save');
        if (request.method !== 'GET' && request.method !== 'HEAD') return this.refuse('methodNotAllowed', 'GET, HEAD');
        return await this.readPage(session.csrfToken, context);
      } catch {
        request.signal.throwIfAborted();
        // Collaborator errors can contain credentials. Do not pass their causes to the account failure reporter.
        return this.page(unavailable);
      }
    };
  }

  private async change(request: Request, csrfToken: string, context: RequestContext, action: 'save' | 'test'): Promise<Response> {
    if (request.method !== 'POST') return this.refuse('methodNotAllowed', 'POST');
    if (request.headers.get('Origin') !== this.origin) return this.refuse('forgedRequest');
    const body = await readForm(request);
    const form = typeof body === 'string' ? body : loggingForm(body, csrfToken);
    if (typeof form === 'string') return this.refuse(form);
    if (form.tenantId !== context.tenantId) {
      this.keep(context, action, 'stale');
      return this.refuse('changeStale');
    }
    const { tenantId: _, ...settings } = form;
    request.signal.throwIfAborted();
    if (this.options.service === undefined || (action === 'test' && this.options.service.test === undefined)) {
      this.keep(context, action, 'unavailable');
      return this.page(unavailable);
    }
    const saved = await this.saveSettings(request, context, settings);
    if (!('settings' in saved)) return this.saveFailure(saved, csrfToken, context);
    if (action === 'save') return this.page(undefined, saved.settings, csrfToken, context.tenantId, true);
    const tested = await this.testSaved(request, context, saved.settings);
    const notice = loggingTestNotice(tested);
    if (tested.status !== 'tested') return this.readPage(csrfToken, context, notice, saved.settings.revision);
    return this.page(notice, saved.settings, csrfToken, context.tenantId, true);
  }

  private async saveSettings(request: Request, context: RequestContext, settings: DestinationSettingsSaveInput): Promise<DestinationSettingsSaveResult> {
    let result: DestinationSettingsSaveResult;
    try { result = await this.options.service?.save(context.tenantId, settings) ?? { status: 'unavailable' }; }
    catch {
      request.signal.throwIfAborted();
      result = { status: 'unconfirmed' };
    }
    this.keep(context, 'save', result.status);
    return result;
  }

  private async testSaved(request: Request, context: RequestContext, settings: PublicDestinationSettings): Promise<DestinationTestResult> {
    const destination = { endpoint: settings.endpoint, ...(settings.axiomDataset === undefined ? {} : { axiomDataset: settings.axiomDataset }), auth: settings.auth, enabled: settings.enabled };
    request.signal.throwIfAborted();
    let result: DestinationTestResult;
    try { result = await this.options.service?.test?.(context.tenantId, { ...destination, expectedRevision: settings.revision, token: '' }, context.user, request.signal) ?? { status: 'unavailable' }; }
    catch {
      request.signal.throwIfAborted();
      result = { status: 'unconfirmed' };
    }
    this.keep(context, 'test', result.status);
    return result;
  }

  private async saveFailure(result: Exclude<DestinationSettingsSaveResult, { readonly settings: PublicDestinationSettings }>, csrfToken: string, context: RequestContext): Promise<Response> {
    if (result.status === 'conflict') return this.readPage(csrfToken, context, loggingRequestNotice('changeStale'));
    if (result.status === 'invalid') return this.readPage(csrfToken, context, { title: 'Invalid settings', message: 'Check the public HTTPS endpoint, Axiom dataset, authentication, and token. No settings were saved. No Test was sent.', status: 400 });
    if (result.status === 'unconfirmed') return this.page({ title: 'Save unconfirmed', message: 'The Save result is unconfirmed. No Test was sent. Read saved settings before making another change. A pending Save can finish after that read.', status: 503 });
    return this.page(unavailable);
  }

  private async readPage(csrfToken: string, context: RequestContext, notice?: LoggingNotice, savedRevision?: string | null): Promise<Response> {
    const result = await this.options.service?.read(context.tenantId).catch(() => ({ status: 'unavailable' as const }));
    if (result === undefined || result.status === 'unavailable') return this.page(notice === undefined ? unavailable : { ...notice, status: 503, message: `${notice.message} Current saved settings are unavailable. Read saved settings before another change.` });
    return this.page(notice, result.settings, csrfToken, context.tenantId, savedRevision !== undefined && result.settings.revision === savedRevision);
  }

  private page(notice?: LoggingNotice, settings?: PublicDestinationSettings, csrfToken = '', tenantId = '', saved = false): Response {
    return loggingPage({ ...(notice === undefined ? {} : { notice }), ...(settings === undefined ? {} : { settings }), saved, tenantId, csrfToken, action: this.paths.save, testAction: this.paths.test, navigation: this.paths });
  }

  private refuse(name: FormRefusal | 'changeStale' | 'methodNotAllowed', allow?: string): Response {
    const response = this.page(loggingRequestNotice(name));
    if (allow !== undefined) response.headers.set('Allow', allow);
    return response;
  }

  private keep(context: RequestContext, action: DestinationChange['action'], outcome: DestinationChange['outcome']): void {
    try {
      this.options.audit?.destinationChanged({ timestamp: new Date().toISOString(), organizationId: context.tenantId, actor: context.user, action, outcome });
    } catch {
      // Capture failure cannot change Save or Test, and must not expose an export cause.
    }
  }
}
