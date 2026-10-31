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

type WorkspacePage = 'members' | 'logging' | 'quick-start';

interface LayoutOptions {
  readonly title: string;
  readonly current: WorkspacePage;
  readonly script?: string;
  readonly style?: string;
  readonly organizationName?: string;
}

const layoutClasses: Readonly<Record<WorkspacePage, string>> = { members: '', logging: ' logging-layout', 'quick-start': ' quick-start-layout' };

// Keep the embedded style and its CSP hash in one owner so that they cannot drift.
const styleHash = sha256(MEMBERS_STYLE);
const memberHeaders = {
  ...FORM_HEADERS,
  'Content-Security-Policy': `${FORM_HEADERS['Content-Security-Policy']}; style-src 'sha256-${styleHash}'; img-src 'self'; font-src 'self'`,
};

export function membersPageLayout(navigation: Navigation, content: string, options: LayoutOptions = { title: 'Members', current: 'members' }): Response {
  const extraStyle = options.style === undefined ? '' : `<style>${options.style}</style>`;
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)} · Thermus</title><link rel="icon" href="/assets/thermus-favicon.svg" type="image/svg+xml"><style>${MEMBERS_STYLE}</style>${extraStyle}</head>
<body><a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header"><div class="header-content"><a class="brand" href="${escapeHtml(navigation.product)}" aria-label="Thermus home"><img src="/assets/thermus-logo.svg" alt="thermus" width="166" height="40"></a>
${workspaceContext(options.organizationName)}
${workspaceNavigation(navigation, options.current)}</div></header>
<main id="main-content" tabindex="-1" class="members-layout${layoutClasses[options.current]}">${content}</main><footer class="site-footer">Thermus AI Inc.</footer>${options.script === undefined ? '' : `<script>${options.script}</script>`}</body></html>`;
  return new Response(page, { status: 200, headers: pageHeaders(options) });
}

function workspaceContext(organizationName: string | undefined): string {
  return organizationName === undefined ? '' : `<div class="workspace-context"><span class="workspace-name">${escapeHtml(organizationName)}</span></div>`;
}

function workspaceNavigation(navigation: Navigation, current: WorkspacePage): string {
  const quickStart = navigation.quickStart === undefined ? '' : pageLink(navigation.quickStart, 'Quick start', current === 'quick-start');
  const logging = navigation.logging === undefined ? '' : pageLink(navigation.logging, 'Audit Log', current === 'logging');
  return `<nav aria-label="Workspace">${quickStart}<a href="${escapeHtml(navigation.product)}">Connect</a><a href="${escapeHtml(navigation.organizations)}">Switch Workspace</a>${pageLink(navigation.members, 'Members', current === 'members')}${logging}</nav>`;
}

function pageLink(href: string, label: string, current: boolean): string {
  return `<a href="${escapeHtml(href)}" ${current ? 'aria-current="page"' : ''}>${label}</a>`;
}

function pageHeaders(options: LayoutOptions): Headers {
  const headers = new Headers(memberHeaders);
  let policy = memberHeaders['Content-Security-Policy'];
  if (options.style !== undefined) policy = policy.replace(`style-src 'sha256-${styleHash}'`, `style-src 'sha256-${styleHash}' 'sha256-${sha256(options.style)}'`);
  if (options.script !== undefined) policy += `; script-src 'sha256-${sha256(options.script)}'`;
  headers.set('Content-Security-Policy', policy);
  return headers;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('base64');
}
