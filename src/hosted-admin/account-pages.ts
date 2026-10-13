import type { AuthorizedOrganization } from '../organizations/organization-administration.ts';

interface Notice {
  readonly status: number;
  readonly title: string;
  readonly paragraphs: readonly string[];
}

export interface OrganizationSelectionForm {
  readonly action: string;
  readonly csrfToken: string;
  readonly returnTo: string;
  readonly organizations: readonly AuthorizedOrganization[];
}

// Each notice shows only this fixed text, so no request value reaches it and it needs no escaping.
const NOTICES = {
  unavailable: {
    status: 503,
    title: 'Hosted authentication is not available',
    paragraphs: ['Hosted authentication is not available yet. No one can sign in, and no account, organization, billing, or MCP operation is available.'],
  },
  signedOut: { status: 401, title: 'Sign-in required', paragraphs: ['Sign in to use this page.'] },
  denied: { status: 403, title: 'Access denied', paragraphs: ['Your account has no access to this page in the selected organization.'] },
  notFound: { status: 404, title: 'Page not found', paragraphs: ['This page does not exist.'] },
  noOrganization: {
    status: 200,
    title: 'No organization access',
    paragraphs: [
      'Your account has no active access to an organization.',
      'If an administrator of an organization invited you, accept the invitation in the email that you got. Then open this page again.',
      'If you have no invitation, contact the operator of this Magumagu service. Only the operator can set up a new organization.',
    ],
  },
  invalidRequest: { status: 400, title: 'Request not valid', paragraphs: ['The request is not valid. Open the organization page again.'] },
  forgedRequest: {
    status: 403,
    title: 'Request refused',
    paragraphs: ['The form is not from this site or is no longer valid. Open the organization page again.'],
  },
  organizationDenied: { status: 403, title: 'Access denied', paragraphs: ['Your account has no access to this organization.'] },
  methodNotAllowed: { status: 405, title: 'Method not allowed', paragraphs: ['This page does not accept this request method.'] },
  formTooLarge: { status: 413, title: 'Form too large', paragraphs: ['The form data is too large.'] },
  formTypeRefused: { status: 415, title: 'Form not accepted', paragraphs: ['This page accepts only HTML form data.'] },
  requestFailed: { status: 500, title: 'Request failed', paragraphs: ['The request failed. Try again later.'] },
} as const satisfies Readonly<Record<string, Notice>>;

export type NoticeName = keyof typeof NOTICES;

const NOTICE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

// The selection forms post only to this site.
const FORM_HEADERS: Readonly<Record<string, string>> = {
  ...NOTICE_HEADERS,
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

const ESCAPED: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function noticePage(name: NoticeName, headers: Readonly<Record<string, string>> = {}): Response {
  return noticeResponse(NOTICES[name], [], headers);
}

// A user without access to a page often has no organization yet, so the page points to the onboarding guidance.
export function accessDeniedPage(organizationPage: string): Response {
  const link = `<a href="${escapeHtml(organizationPage)}">organization page</a>`;
  return noticeResponse(NOTICES.denied, [`<p>To select another organization, or to see how to get access, open the ${link}.</p>`]);
}

// The provider gives the organization names and IDs, so the page escapes them.
export function organizationSelectionPage(form: OrganizationSelectionForm): Response {
  const items = form.organizations.flatMap((organization) => [
    '<li>',
    `<form method="post" action="${escapeHtml(form.action)}">`,
    hiddenField('csrf_token', form.csrfToken),
    hiddenField('organization_id', organization.organizationId),
    hiddenField('return_to', form.returnTo),
    `<button type="submit">${escapeHtml(organization.organizationName)}${organization.selected ? ' (selected)' : ''}</button>`,
    '</form>',
    '</li>',
  ]);
  const page = htmlDocument('Select an organization', ['<p>Select the organization to use in this browser.</p>', '<ul>', ...items, '</ul>']);
  return new Response(page, { status: 200, headers: FORM_HEADERS });
}

function noticeResponse(notice: Notice, extraContent: readonly string[], headers: Readonly<Record<string, string>> = {}): Response {
  const page = htmlDocument(notice.title, [...notice.paragraphs.map((paragraph) => `<p>${paragraph}</p>`), ...extraContent]);
  return new Response(page, { status: notice.status, headers: { ...NOTICE_HEADERS, ...headers } });
}

function hiddenField(name: string, value: string): string {
  return `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
}

function htmlDocument(title: string, content: readonly string[]): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '</head>',
    '<body>',
    '<main>',
    `<h1>${title}</h1>`,
    ...content,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPED[character] ?? character);
}
