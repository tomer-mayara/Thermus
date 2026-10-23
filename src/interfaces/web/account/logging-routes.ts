import type { DestinationSettingsService, DestinationSettingsSaveResult } from '../../../logs/audit/destination-settings-service.ts';
import type { AdministrationHandler } from './administration-routes.ts';
import { readForm } from './account-form.ts';
import { accessDeniedPage, noticePage, seeOther } from './account-pages.ts';
import { loggingForm } from './logging-form.ts';
import { loggingNotice, loggingPage } from './logging-page.ts';

export interface LoggingRoutesOptions {
  readonly publicBaseUrl: string;
  readonly organizationsPage: string;
  readonly service?: Pick<DestinationSettingsService, 'read' | 'save'>;
}

// Current access is resolved before this boundary. The tenant and Admin permission come only from that decision.
export class LoggingRoutes {
  private readonly origin: string;
  private readonly paths: { readonly product: string; readonly members: string; readonly organizations: string; readonly logging: string; readonly save: string };
  constructor(private readonly options: LoggingRoutesOptions) {
    this.origin = new URL(options.publicBaseUrl).origin;
    const path = (relative: string) => new URL(relative, options.publicBaseUrl).pathname;
    this.paths = { product: path(''), members: path('members'), organizations: options.organizationsPage, logging: path('logging'), save: path('logging/save') };
  }

  handlerFor(path: string): AdministrationHandler | undefined {
    if (path !== this.paths.logging && path !== this.paths.save) return undefined;
    return async (request, session, context) => {
      if (!context.permissions.includes('admin-grants:manage')) return accessDeniedPage(this.paths.organizations);
      try {
        if (path === this.paths.save) return await this.save(request, session.csrfToken, context.tenantId);
        if (request.method !== 'GET' && request.method !== 'HEAD') return noticePage('methodNotAllowed', { Allow: 'GET, HEAD' });
        const result = await this.options.service?.read(context.tenantId);
        if (result === undefined || result.status === 'unavailable') return this.unavailable();
        return loggingPage({ settings: result.settings, tenantId: context.tenantId, csrfToken: session.csrfToken, action: this.paths.save, navigation: this.paths });
      } catch {
        request.signal.throwIfAborted();
        // Collaborator errors can contain credentials. Do not pass their causes to the account failure reporter.
        return this.unavailable();
      }
    };
  }

  private async save(request: Request, csrfToken: string, tenantId: string): Promise<Response> {
    if (request.method !== 'POST') return noticePage('methodNotAllowed', { Allow: 'POST' });
    if (request.headers.get('Origin') !== this.origin) return noticePage('forgedRequest');
    const body = await readForm(request);
    const form = typeof body === 'string' ? body : loggingForm(body, csrfToken);
    if (typeof form === 'string') return noticePage(form);
    if (form.tenantId !== tenantId) return noticePage('changeStale');
    const { tenantId: _, ...settings } = form;
    request.signal.throwIfAborted();
    if (this.options.service === undefined) return this.unavailable();
    try {
      return this.saveAnswer(await this.options.service.save(tenantId, settings));
    } catch {
      request.signal.throwIfAborted();
      return this.saveAnswer({ status: 'unconfirmed' });
    }
  }

  private saveAnswer(result: DestinationSettingsSaveResult): Response {
    if (result.status === 'saved' || result.status === 'unchanged') return seeOther(new URL(this.paths.logging, this.origin).href);
    if (result.status === 'conflict') return noticePage('changeStale');
    if (result.status === 'unconfirmed') return loggingNotice('Save unconfirmed', 'The Save result is unconfirmed. Read saved settings before making another change. A pending Save can finish after that read.', 503, this.paths.logging);
    if (result.status === 'invalid') return loggingNotice('Invalid settings', 'Check the public HTTPS endpoint, authentication, and token. No settings were saved.', 400, this.paths.logging);
    return this.unavailable();
  }

  private unavailable(): Response {
    return loggingNotice('Logging unavailable', 'Logging settings are unavailable. Read saved settings before making another change.', 503, this.paths.logging);
  }
}
