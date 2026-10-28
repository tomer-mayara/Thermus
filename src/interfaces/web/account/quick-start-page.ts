import { escapeHtml } from '../html-escape.ts';
import { membersPageLayout } from './members-page-layout.ts';
import { quickStartContent, quickStartInstructions, quickStartProviders } from './quick-start-content.ts';
import { QUICK_START_COPY_SCRIPT } from './quick-start-copy.ts';
import { QUICK_START_STYLE } from './quick-start-style.ts';

interface QuickStartPage {
  readonly organizationName: string;
  readonly publicBaseUrl: string;
  readonly mcpResourceUrl: string;
}

export function quickStartPage(page: QuickStartPage): Response {
  const { navigation, markdown } = quickStartContent(page);
  const content = [
    renderHeader(), '<div class="quick-start-steps">',
    renderInternetStep(navigation.product), renderAuditStep(navigation.logging), renderUsersStep(navigation.members),
    `</div><p class="quick-start-verify">${escapeHtml(quickStartInstructions.internet.verify)} Check that an audit event arrives at your destination.</p>`,
    renderManualGuide(markdown),
  ].join('\n');
  return membersPageLayout(navigation, content, {
    title: 'Quick start', current: 'quick-start', organizationName: page.organizationName,
    script: QUICK_START_COPY_SCRIPT, style: QUICK_START_STYLE,
  });
}

function renderHeader(): string {
  return `<div class="quick-start-header"><div><h1>Quick start</h1><p>Set up your organization.</p></div><button id="quick-start-copy" class="quick-start-copy" type="button" hidden><span class="quick-start-copy-icon" aria-hidden="true">⧉</span><span data-copy-label>Copy guide as Markdown</span></button></div>
<p id="quick-start-copy-status" class="quick-start-copy-status" role="status" aria-live="polite" aria-atomic="true"></p>`;
}

function renderInternetStep(connectUrl: string): string {
  const { internet } = quickStartInstructions;
  const providers = quickStartProviders.map(renderProvider).join('');
  return step(1, internet.title, `<p>${escapeHtml(internet.lead)}</p>${action(connectUrl, 'Open Connect setup')}
<details class="quick-start-details"><summary>Agent controls and instructions</summary><p class="quick-start-note">${escapeHtml(internet.scope)}</p><div class="quick-start-providers">${providers}</div><p class="quick-start-note">${escapeHtml(internet.fallback)}</p></details>`);
}

function renderProvider(provider: (typeof quickStartProviders)[number]): string {
  const links = provider.links.map(link =>
    `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`,
  ).join('');
  return `<div><h3>${escapeHtml(provider.name)}</h3><div class="quick-start-provider-links">${links}</div></div>`;
}

function renderAuditStep(loggingUrl: string): string {
  const { audit } = quickStartInstructions;
  const sequence = audit.sequence.map(line => `<li>${escapeHtml(line)}</li>`).join('');
  return step(2, audit.title, `<p>${escapeHtml(audit.lead)}</p><ol class="quick-start-audit-sequence">${sequence}</ol><p class="quick-start-note">${escapeHtml(audit.note)}</p>${action(loggingUrl, 'Open Audit Log')}
<div id="quick-start-audit-details"><p class="quick-start-note">${escapeHtml(audit.effect)}</p><p class="quick-start-note">${escapeHtml(audit.recovery)} consult <a href="${escapeHtml(loggingUrl)}">Audit logs help</a> ${escapeHtml(audit.help)}</p><p class="quick-start-note">${escapeHtml(audit.delivery)}</p></div>`);
}

function renderUsersStep(membersUrl: string): string {
  const { users } = quickStartInstructions;
  return step(3, users.title, `<p>${escapeHtml(users.invite)}</p>${action(membersUrl, 'Invite users', ' quick-start-invite')}<div class="quick-start-planned"><h3>${escapeHtml(users.plannedTitle)}</h3><p>${escapeHtml(users.planned)}</p></div>`);
}

function renderManualGuide(markdown: string): string {
  return `<details id="quick-start-manual" class="quick-start-manual"><summary>Read or copy the complete guide</summary><label for="quick-start-markdown">Complete guide as Markdown</label><textarea id="quick-start-markdown" readonly spellcheck="false">${escapeHtml(markdown)}</textarea></details>`;
}

function step(number: number, title: string, content: string): string {
  return `<section class="quick-start-step" aria-labelledby="quick-start-step-${number}"><span class="quick-start-number" aria-hidden="true">${number}</span><div><h2 id="quick-start-step-${number}">${escapeHtml(title)}</h2>${content}</div></section>`;
}

function action(url: string, label: string, extraClass = ''): string {
  return `<a class="quick-start-action${extraClass}" href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}
