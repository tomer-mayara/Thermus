import type { RequestContext } from '../../../accounts/identity/access-context.ts';
import type { AuditLog, DestinationChange } from '../../../logs/audit/audit-log.ts';
import { loggingTestAnswer } from './logging-test-page.ts';
import type { DestinationSettingsService, DestinationSettingsSaveResult, DestinationTestResult } from '../../../logs/audit/destination-settings-service.ts';
import type { AdministrationHandler } from './administration-routes.ts';
import { readForm } from './account-form.ts';
import { accessDeniedPage, noticePage, seeOther } from './account-pages.ts';
import { loggingForm } from './logging-form.ts';
import { loggingNotice, loggingPage } from './logging-page.ts';

export interface LoggingRoutesOptions {
  readonly publicBaseUrl: string;
  readonly organizationsPage: string;
  readonly service?: Pick<DestinationSettingsService, 'read' | 'save'> & Partial<Pick<DestinationSettingsService, 'test'>>;
  readonly audit?: Pick<AuditLog, 'destinationChanged'>;
}

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
        if (path === this.paths.test) return await this.test(request, session.csrfToken, context);
        if (path === this.paths.save) return await this.save(request, session.csrfToken, context);
        if (request.method !== 'GET' && request.method !== 'HEAD') return noticePage('methodNotAllowed', { Allow: 'GET, HEAD' });
        const result = await this.options.service?.read(context.tenantId);
        if (result === undefined || result.status === 'unavailable') return this.unavailable();
        return loggingPage({ settings: result.settings, tenantId: context.tenantId, csrfToken: session.csrfToken, action: this.paths.save, testAction: this.paths.test, navigation: this.paths });
      } catch {
        request.signal.throwIfAborted();
        // Collaborator errors can contain credentials. Do not pass their causes to the account failure reporter.
        return this.unavailable();
      }
    };
  }

  private async save(request: Request, csrfToken: string, context: RequestContext): Promise<Response> {
    const { tenantId } = context;
    if (request.method !== 'POST') return noticePage('methodNotAllowed', { Allow: 'POST' });
    if (request.headers.get('Origin') !== this.origin) return noticePage('forgedRequest');
    const body = await readForm(request);
    const form = typeof body === 'string' ? body : loggingForm(body, csrfToken);
    if (typeof form === 'string') return noticePage(form);
    if (form.tenantId !== tenantId) {
      this.keep(context, 'save', 'stale');
      return noticePage('changeStale');
    }
    const { tenantId: _, ...settings } = form;
    request.signal.throwIfAborted();
    if (this.options.service === undefined) {
      this.keep(context, 'save', 'unavailable');
      return this.unavailable();
    }
    let result: DestinationSettingsSaveResult;
    try {
      result = await this.options.service.save(tenantId, settings);
    } catch {
      request.signal.throwIfAborted();
      result = { status: 'unconfirmed' };
    }
    this.keep(context, 'save', result.status);
    return this.saveAnswer(result);
  }

  private async test(request: Request, csrfToken: string, context: RequestContext): Promise<Response> {
    const { tenantId, user: actor } = context;
    if (request.method !== 'POST') return noticePage('methodNotAllowed', { Allow: 'POST' });
    if (request.headers.get('Origin') !== this.origin) return noticePage('forgedRequest');
    const body = await readForm(request);
    const form = typeof body === 'string' ? body : loggingForm(body, csrfToken);
    if (typeof form === 'string') return noticePage(form);
    if (form.tenantId !== tenantId) {
      this.keep(context, 'test', 'stale');
      return noticePage('changeStale');
    }
    const { tenantId: _, ...settings } = form;
    request.signal.throwIfAborted();
    if (this.options.service?.test === undefined) {
      this.keep(context, 'test', 'unavailable');
      return this.unavailable();
    }
    let result: DestinationTestResult;
    try {
      result = await this.options.service.test(tenantId, settings, actor, request.signal);
    } catch {
      request.signal.throwIfAborted();
      result = { status: 'unconfirmed' };
    }
    this.keep(context, 'test', result.status);
    return loggingTestAnswer(result, this.paths.logging);
  }

  private keep(context: RequestContext, action: DestinationChange['action'], outcome: DestinationChange['outcome']): void {
    try {
      this.options.audit?.destinationChanged({ timestamp: new Date().toISOString(), organizationId: context.tenantId, actor: context.user, action, outcome });
    } catch {
      // Capture failure cannot change Save or Test, and must not expose an export cause.
    }
  }

  private saveAnswer(result: DestinationSettingsSaveResult): Response {
    if (result.status === 'saved' || result.status === 'unchanged') return seeOther(new URL(this.paths.logging, this.origin).href);
    if (result.status === 'conflict') return noticePage('changeStale');
    if (result.status === 'unconfirmed') return loggingNotice({ title: 'Save unconfirmed', message: 'The Save result is unconfirmed. Read saved settings before making another change. A pending Save can finish after that read.', status: 503 }, this.paths.logging);
    if (result.status === 'invalid') return loggingNotice({ title: 'Invalid settings', message: 'Check the public HTTPS endpoint, authentication, and token. No settings were saved.', status: 400 }, this.paths.logging);
    return this.unavailable();
  }

  private unavailable(): Response {
    return loggingNotice({ title: 'Audit logs unavailable', message: 'Audit logs settings are unavailable. Read saved settings before making another change.', status: 503 }, this.paths.logging);
  }
}
