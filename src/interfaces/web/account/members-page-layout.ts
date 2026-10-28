import { createHash } from 'node:crypto';
import { escapeHtml } from '../html-escape.ts';
import { FORM_HEADERS } from '../page-html.ts';
import { MEMBERS_STYLE } from './members-style.ts';

interface Navigation {
  readonly product: string;
  readonly members: string;
  readonly organizations: string;
  readonly logging?: string;
  readonly quickStart?: string;
}

// Keep the embedded style and its CSP hash in one owner so that they cannot drift.
const styleHash = createHash('sha256').update(MEMBERS_STYLE).digest('base64');
const memberHeaders = {
  ...FORM_HEADERS,
  'Content-Security-Policy': `${FORM_HEADERS['Content-Security-Policy']}; style-src 'sha256-${styleHash}'; img-src 'self'; font-src 'self'`,
};

export function membersPageLayout(navigation: Navigation, content: string, options: { readonly title: string; readonly current: 'members' | 'logging' | 'quick-start'; readonly script?: string; readonly style?: string; readonly organizationName?: string } = { title: 'Members', current: 'members' }): Response {
  const extraStyle = options.style === undefined ? '' : `<style>${options.style}</style>`;
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)} · Thermus</title><link rel="icon" href="/assets/thermus-favicon.svg" type="image/svg+xml"><style>${MEMBERS_STYLE}</style>${extraStyle}</head>
<body><a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header"><div class="header-content"><a class="brand" href="${escapeHtml(navigation.product)}" aria-label="Thermus home"><img src="/assets/thermus-logo.svg" alt="thermus" width="166" height="40"></a>
${options.organizationName === undefined ? '' : `<div class="workspace-context"><span class="workspace-name">${escapeHtml(options.organizationName)}</span></div>`}
<nav aria-label="Workspace">${navigation.quickStart === undefined ? '' : `<a href="${escapeHtml(navigation.quickStart)}" ${options.current === 'quick-start' ? 'aria-current="page"' : ''}>Quick start</a>`}<a href="${escapeHtml(navigation.product)}">Connect</a><a href="${escapeHtml(navigation.organizations)}">Switch Workspace</a><a href="${escapeHtml(navigation.members)}" ${options.current === 'members' ? 'aria-current="page"' : ''}>Members</a>${navigation.logging === undefined ? '' : `<a href="${escapeHtml(navigation.logging)}" ${options.current === 'logging' ? 'aria-current="page"' : ''}>Audit Log</a>`}</nav></div></header>
<main id="main-content" tabindex="-1" class="members-layout${options.current === 'logging' ? ' logging-layout' : ''}${options.current === 'quick-start' ? ' quick-start-layout' : ''}">${content}</main><footer class="site-footer">Thermus AI Inc.</footer>${options.script === undefined ? '' : `<script>${options.script}</script>`}</body></html>`;
  const headers = new Headers(memberHeaders);
  let policy = memberHeaders['Content-Security-Policy'];
  if (options.style !== undefined) policy = policy.replace(`style-src 'sha256-${styleHash}'`, `style-src 'sha256-${styleHash}' 'sha256-${createHash('sha256').update(options.style).digest('base64')}'`);
  if (options.script !== undefined) policy += `; script-src 'sha256-${createHash('sha256').update(options.script).digest('base64')}'`;
  headers.set('Content-Security-Policy', policy);
  return new Response(page, { status: 200, headers });
}
