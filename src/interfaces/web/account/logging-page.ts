import type { PublicDestinationSettings } from '../../../logs/audit/destination-settings-service.ts';
import { escapeHtml } from '../html-escape.ts';
import { hiddenField } from '../page-html.ts';
import { membersPageLayout } from './members-page-layout.ts';

export interface LoggingNotice { readonly title: string; readonly message: string; readonly status: number }

interface LoggingPage {
  readonly settings?: PublicDestinationSettings;
  readonly notice?: LoggingNotice;
  readonly tenantId: string;
  readonly csrfToken: string;
  readonly action: string;
  readonly testAction: string;
  readonly navigation: { readonly product: string; readonly members: string; readonly organizations: string; readonly logging: string };
}

const destinationScript = `
const destinationChoices = document.querySelector('#logging-destination');
const datasetFields = document.querySelector('#logging-axiom-fields');
const dataset = document.querySelector('#logging-dataset');
function updateDestination() {
  const axiom = destinationChoices.querySelector('input[name="destination"]:checked').value === 'axiom';
  datasetFields.hidden = !axiom;
  dataset.toggleAttribute('disabled', !axiom);
  dataset.toggleAttribute('required', axiom);
}
destinationChoices.addEventListener('change', updateDestination);
updateDestination();
`;

export function loggingPage(page: LoggingPage): Response {
  const notice = page.notice === undefined ? '' : `<section class="logging-result" role="${page.notice.status >= 400 ? 'alert' : 'status'}" aria-labelledby="logging-result-title"><h3 id="logging-result-title">${escapeHtml(page.notice.title)}</h3><p>${escapeHtml(page.notice.message)}</p></section>`;
  const response = membersPageLayout(page.navigation, `<div class="introduction"><p class="eyebrow">Workspace administration</p><h1>Audit logs</h1></div>
<section class="invite-card" aria-labelledby="destination-heading"><h2 id="destination-heading">Audit log destination</h2>
${notice}
<p>Save one destination for your organization's audit logs. Thermus system logs are internal.</p>
<aside class="destination-notice" role="note" aria-label="Organization data"><p>Send organization data only if you have authority to do so. Check destination access and retention. Read our <a href="https://thermus.ai/privacy/">Privacy Policy</a>.</p></aside>
${page.settings === undefined ? `<p><a href="${escapeHtml(page.navigation.logging)}">Read saved settings</a></p>` : destinationForm(page, page.settings)}</section>`, { title: 'Audit logs', current: 'logging', ...(page.settings === undefined ? {} : { script: destinationScript }) });
  return new Response(response.body, { status: page.notice?.status ?? 200, headers: response.headers });
}

function destinationForm(page: LoggingPage, settings: PublicDestinationSettings): string {
  return `<form method="post" action="${escapeHtml(page.action)}">
${hiddenField('csrf_token', page.csrfToken)}${hiddenField('organization_id', page.tenantId)}${hiddenField('expected_revision', settings.revision ?? '')}
<fieldset id="logging-destination"><legend>Destination</legend><label class="role-option"><input type="radio" name="destination" value="axiom" required${settings.axiomDataset ? ' checked' : ''}> Axiom</label>
<label class="role-option"><input type="radio" name="destination" value="custom" required${settings.axiomDataset ? '' : ' checked'}> Custom</label></fieldset>
<label for="logging-endpoint">OTLP logs endpoint</label><input id="logging-endpoint" name="endpoint" type="url" maxlength="2048" required pattern="https://.*" aria-describedby="logging-endpoint-help" value="${escapeHtml(settings.endpoint)}">
<p id="logging-endpoint-help">Use an HTTPS OTLP/HTTP JSON logs endpoint.</p>
<div id="logging-axiom-fields"><label for="logging-dataset">Axiom dataset</label><input id="logging-dataset" name="axiom_dataset" type="text" maxlength="128" pattern="[A-Za-z0-9\\-]{1,128}" aria-describedby="logging-dataset-help" value="${escapeHtml(settings.axiomDataset ?? '')}">
<p id="logging-dataset-help">Required for Axiom: 1–128 letters, digits, or hyphens.</p></div>
<noscript><p>For Axiom, enter a dataset. For Custom, clear the Axiom dataset.</p></noscript>
${hiddenField('auth', 'bearer')}
<label for="logging-token">Bearer token</label><input id="logging-token" name="token" type="password" autocomplete="new-password" maxlength="8192"${settings.tokenPresent ? '' : ' required'} aria-describedby="logging-token-help" value="">
<p id="logging-token-help">${settings.tokenPresent ? 'A token is saved. Leave Token blank to keep it for the same endpoint.' : 'No token is saved. Enter a Bearer token.'} A changed endpoint needs a new token.${settings.revision && settings.auth === 'none' ? ' Enter a Bearer token to Save or Test.' : ''}</p>
<label class="logging-switch"><input type="checkbox" name="enabled" role="switch"${settings.enabled ? ' checked' : ''}><span class="logging-switch-track" aria-hidden="true"></span><span>Enable export</span><span class="logging-switch-off" aria-hidden="true">Off</span><span class="logging-switch-on" aria-hidden="true">On</span></label><div class="logging-actions"><button type="submit">Save</button>
<button type="submit" class="secondary-action" formaction="${escapeHtml(page.testAction)}">Test</button></div></form>
<p>Test saves these settings, then sends one synthetic event, even when export is disabled. Check your destination for receipt.</p>`;
}
