import { createHash } from 'node:crypto';
import { escapeHtml } from '../html-escape.ts';
import type { AuthorizedOrganization } from '../../../accounts/organizations/organization-administration.ts';
import { FORM_HEADERS, hiddenField, postForm } from '../page-html.ts';
import { ORGANIZATION_SELECTION_STYLE } from './organization-selection-style.ts';

interface OrganizationSelectionForm {
  readonly action: string;
  readonly csrfToken: string;
  readonly returnTo: string;
  readonly organizations: readonly AuthorizedOrganization[];
  readonly product: string;
  readonly admin?: boolean;
}

const styleHash = createHash('sha256').update(ORGANIZATION_SELECTION_STYLE).digest('base64');
const headers = {
  ...FORM_HEADERS,
  'Content-Security-Policy': `${FORM_HEADERS['Content-Security-Policy']}; style-src 'sha256-${styleHash}'; img-src 'self'; font-src 'self'`,
};

export function organizationSelectionPage(form: OrganizationSelectionForm): Response {
  const items = form.organizations.flatMap((organization) => [
    `<li${organization.selected ? ' aria-current="true"' : ''}>`,
    ...postForm(form.action, [
      hiddenField('csrf_token', form.csrfToken),
      hiddenField('organization_id', organization.organizationId),
      hiddenField('return_to', form.returnTo),
    ], `${organization.organizationName}${organization.selected ? ' (selected)' : ''}`),
    '</li>',
  ]);
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Select an organization · Thermus</title><link rel="icon" href="/assets/thermus-favicon.svg" type="image/svg+xml"><style>${ORGANIZATION_SELECTION_STYLE}</style></head>
<body><a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header"><div class="header-content"><a class="brand" href="${escapeHtml(form.product)}" aria-label="Thermus home"><img src="/assets/thermus-logo.svg" alt="thermus" width="166" height="40"></a>
<nav aria-label="Workspace"><a href="${escapeHtml(form.product)}">Connect</a><a href="${escapeHtml(`${form.product}organizations`)}" aria-current="page">Switch Workspace</a>${form.admin ? `<a href="${escapeHtml(`${form.product}members`)}">Members</a><a href="${escapeHtml(`${form.product}logging`)}">Audit Log</a>` : ''}</nav></div></header>
<main id="main-content" tabindex="-1" class="organization-layout">
  <section class="organization-introduction" aria-labelledby="page-title"><p class="eyebrow">Your workspace</p><h1 id="page-title">Select an organization</h1><p class="introduction-copy">Select the organization to use in this browser.</p></section>
  <section class="organization-card" aria-labelledby="organizations-heading"><p class="card-caption">Workspace access</p><h2 id="organizations-heading">Your organizations</h2><p class="card-copy">Choose where to continue.</p>
    <ul class="organization-list">${items.join('\n')}</ul>
    <p class="selection-note">Your choice applies to this browser.</p>
  </section>
</main><footer class="site-footer">Thermus AI Inc.</footer></body></html>`;
  return new Response(page, { status: 200, headers });
}
