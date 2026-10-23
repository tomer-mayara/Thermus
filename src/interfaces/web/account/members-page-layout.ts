import { createHash } from 'node:crypto';
import { escapeHtml } from '../html-escape.ts';
import { FORM_HEADERS } from '../page-html.ts';
import { MEMBERS_STYLE } from './members-style.ts';

interface Navigation {
  readonly product: string;
  readonly members: string;
  readonly organizations: string;
}

// Keep the embedded style and its CSP hash in one owner so that they cannot drift.
const styleHash = createHash('sha256').update(MEMBERS_STYLE).digest('base64');
const memberHeaders = {
  ...FORM_HEADERS,
  'Content-Security-Policy': `${FORM_HEADERS['Content-Security-Policy']}; style-src 'sha256-${styleHash}'; img-src 'self'; font-src 'self'`,
};

export function membersPageLayout(navigation: Navigation, content: string): Response {
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Members · Thermus</title><link rel="icon" href="/assets/thermus-favicon.svg" type="image/svg+xml"><style>${MEMBERS_STYLE}</style></head>
<body><a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header"><div class="header-content"><a class="brand" href="${escapeHtml(navigation.product)}" aria-label="Thermus home"><img src="/assets/thermus-logo.svg" alt="thermus" width="166" height="40"></a>
<nav aria-label="Workspace"><a href="${escapeHtml(navigation.product)}">Product / Connect</a><a href="${escapeHtml(navigation.members)}" aria-current="page">Members</a><a href="${escapeHtml(navigation.organizations)}">Switch workspace</a></nav></div></header>
<main id="main-content" class="members-layout">${content}</main><footer class="site-footer">Thermus AI Inc.</footer></body></html>`;
  return new Response(page, { status: 200, headers: memberHeaders });
}
