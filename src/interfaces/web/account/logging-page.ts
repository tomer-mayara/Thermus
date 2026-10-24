import type { PublicDestinationSettings } from '../../../logs/audit/destination-settings-service.ts';
import { escapeHtml } from '../html-escape.ts';
import { hiddenField, htmlDocument, NOTICE_HEADERS } from '../page-html.ts';
import { membersPageLayout } from './members-page-layout.ts';

interface LoggingPage {
  readonly settings: PublicDestinationSettings;
  readonly tenantId: string;
  readonly csrfToken: string;
  readonly action: string;
  readonly testAction: string;
  readonly navigation: { readonly product: string; readonly members: string; readonly organizations: string; readonly logging: string };
}

export function loggingPage(page: LoggingPage): Response {
  const { settings } = page;
  return membersPageLayout(page.navigation, `<div class="introduction"><p class="eyebrow">Workspace administration</p><h1>Audit logs</h1></div>
<section class="invite-card" aria-labelledby="destination-heading"><h2 id="destination-heading">Audit log destination</h2>
<p>Save one destination for your organization's audit logs. Thermus system logs are internal.</p>
<form method="post" action="${escapeHtml(page.action)}">
${hiddenField('csrf_token', page.csrfToken)}${hiddenField('organization_id', page.tenantId)}${hiddenField('expected_revision', settings.revision ?? '')}
<label for="logging-endpoint">Collector endpoint</label><input id="logging-endpoint" name="endpoint" type="url" maxlength="2048" required value="${escapeHtml(settings.endpoint)}">
<p>Connection: HTTPS · OTLP/HTTP JSON</p>
<fieldset><legend>Authentication</legend><label><input type="radio" name="auth" value="none"${settings.auth === 'none' ? ' checked' : ''}> None</label>
<label><input type="radio" name="auth" value="bearer"${settings.auth === 'bearer' ? ' checked' : ''}> Bearer token</label></fieldset>
<label for="logging-token">Token</label><input id="logging-token" name="token" type="password" autocomplete="new-password" maxlength="8192" value="">
<p>${settings.tokenPresent ? 'A token is saved.' : 'No token is saved.'} Leave Token blank to keep a saved Bearer token only when the endpoint and authentication stay the same. A changed endpoint with Bearer needs a new token. None removes the saved token.</p>
<label><input type="checkbox" name="enabled"${settings.enabled ? ' checked' : ''}> Enable export</label><button type="submit">Save</button>
<button type="submit" formaction="${escapeHtml(page.testAction)}" formnovalidate>Test saved destination</button></form>
<p>Test is optional and sends one synthetic event to the saved destination, even when export is disabled. Save edits before Test. Test does not save settings or enable export.</p>
<p>Test proves neither continued delivery nor durable storage. Test is not required to enable export.</p></section>`, { title: 'Audit logs', current: 'logging' });
}

export function loggingNotice(notice: { readonly title: string; readonly message: string; readonly status: number }, loggingPath: string): Response {
  return new Response(htmlDocument(notice.title, [`<p>${notice.message}</p>`, `<p><a href="${escapeHtml(loggingPath)}">Read saved settings</a></p>`]), { status: notice.status, headers: NOTICE_HEADERS });
}
