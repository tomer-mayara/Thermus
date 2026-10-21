import { createHash } from 'node:crypto';
import { escapeHtml } from '../../html-escape.ts';
import type { CookieEffects } from '../../../../accounts/identity/browser-session.ts';

interface Notice {
  readonly status: number;
  readonly title: string;
  readonly paragraphs: readonly string[];
}

type HeaderValues = Readonly<Record<string, string>>;

const STYLE = [
  'body{margin:0;background:#f4f5f7;color:#1d2125;font:16px/1.5 system-ui,sans-serif}',
  'main{max-width:32rem;margin:3rem auto;padding:1.5rem 2rem;background:#fff;border:1px solid #d5d9de;border-radius:8px}',
  'h1{margin-top:0;font-size:1.4rem}',
].join('');

const ANSWER_HEADERS: HeaderValues = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

// A page has no form, no script, and no other resource, so its policy allows nothing but its own inline style.
const PAGE_HEADERS: HeaderValues = {
  'Content-Type': 'text/html; charset=utf-8',
  ...ANSWER_HEADERS,
  'Content-Security-Policy': `default-src 'none'; style-src 'sha256-${createHash('sha256').update(STYLE).digest('base64')}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  'X-Frame-Options': 'DENY',
};

// Each notice shows only this fixed text, so no request value reaches it and it needs no escaping.
const NOTICES = {
  signInInvalid: { status: 400, title: 'Sign-in request not valid', paragraphs: ['The sign-in request is not valid.'] },
  signInFailed: {
    status: 400,
    title: 'Sign-in did not complete',
    paragraphs: ['The sign-in was cancelled, has expired, or is not valid. You are not signed in.'],
  },
  invalidRequest: { status: 400, title: 'Request not valid', paragraphs: ['The request is not valid.'] },
  forgedRequest: { status: 403, title: 'Request refused', paragraphs: ['The form is not from this site or is no longer valid. Nothing changed.'] },
  notFound: { status: 404, title: 'Page not found', paragraphs: ['This page does not exist.'] },
  methodNotAllowed: { status: 405, title: 'Method not allowed', paragraphs: ['This page does not accept this request method.'] },
  formTooLarge: { status: 413, title: 'Form too large', paragraphs: ['The form data is too large.'] },
  formTypeRefused: { status: 415, title: 'Form not accepted', paragraphs: ['This page accepts only HTML form data.'] },
  requestFailed: { status: 500, title: 'Request failed', paragraphs: ['The request failed. Try again later.'] },
} as const satisfies Readonly<Record<string, Notice>>;

export type NoticeName = keyof typeof NOTICES;

export function noticePage(name: NoticeName, headers: HeaderValues = {}): Response {
  return page(NOTICES[name], [], headers);
}

// A notice of the sign-in with a link that starts a new sign-in. The link path comes from the public URL, not from the
// request, and the page escapes it.
export function signInNotice(name: 'signInInvalid' | 'signInFailed', loginPath: string, cookies: CookieEffects = []): Response {
  return withCookies(page(NOTICES[name], [`<p><a href="${escapeHtml(loginPath)}">Sign in again</a></p>`]), cookies);
}

export function seeOther(location: string, cookies: CookieEffects): Response {
  return withCookies(new Response(null, { status: 303, headers: { Location: location, ...ANSWER_HEADERS } }), cookies);
}

export interface AnswerExtras {
  readonly cookies?: CookieEffects;
  readonly headers?: HeaderValues;
}

export function jsonAnswer(status: number, body: object, extras: AnswerExtras = {}): Response {
  return withCookies(Response.json(body, { status, headers: { ...ANSWER_HEADERS, ...extras.headers } }), extras.cookies ?? []);
}

function withCookies(response: Response, cookies: CookieEffects): Response {
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
  return response;
}

function page(notice: Notice, extraContent: readonly string[], headers: HeaderValues = {}): Response {
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${notice.title}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    '<main>',
    `<h1>${notice.title}</h1>`,
    ...notice.paragraphs.map((paragraph) => `<p>${paragraph}</p>`),
    ...extraContent,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
  return new Response(html, { status: notice.status, headers: { ...PAGE_HEADERS, ...headers } });
}
