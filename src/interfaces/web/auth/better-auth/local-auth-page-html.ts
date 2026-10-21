import { createHash } from 'node:crypto';
import { escapeHtml } from '../../html-escape.ts';

export interface SignInForm {
  readonly action: string;
  readonly oauthQuery: string;
  readonly email?: string;
  readonly message?: string;
}

const STYLE = [
  'body{margin:0;background:#f4f5f7;color:#1d2125;font:16px/1.5 system-ui,sans-serif}',
  'main{max-width:28rem;margin:3rem auto;padding:1.5rem 2rem;background:#fff;border:1px solid #d5d9de;border-radius:8px}',
  'h1{margin-top:0;font-size:1.4rem}',
  'label{display:block;margin-top:1rem;font-weight:600}',
  'input{box-sizing:border-box;width:100%;margin-top:.25rem;padding:.5rem;font:inherit}',
  'button{margin:1.5rem .5rem 0 0;padding:.5rem 1.25rem;font:inherit}',
  '.message{padding:.75rem;border-left:4px solid #c9372c;background:#ffeceb}',
].join('');

const PAGE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  // No form-action directive: Chrome applies it also to the redirect after the consent post, which goes to the
  // loopback redirect URI of the MCP client.
  'Content-Security-Policy': `default-src 'none'; style-src 'sha256-${createHash('sha256').update(STYLE).digest('base64')}'; base-uri 'none'; frame-ancestors 'none'`,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  // Not no-referrer: with it, browsers send Origin: null with a form post, and the provider refuses a post
  // that has a session cookie and a null origin.
  'Referrer-Policy': 'same-origin',
};

export function signInPage(status: number, form: SignInForm): Response {
  return htmlResponse(status, htmlDocument('Sign in to Thermus', [
    form.message === undefined ? '' : `<p class="message">${escapeHtml(form.message)}</p>`,
    `<form method="post" action="${escapeHtml(form.action)}">`,
    oauthQueryField(form.oauthQuery),
    '<label for="email">Email address</label>',
    `<input id="email" name="email" type="email" autocomplete="username" required value="${escapeHtml(form.email ?? '')}">`,
    '<label for="password">Password</label>',
    '<input id="password" name="password" type="password" autocomplete="current-password" required>',
    '<button type="submit">Sign in</button>',
    '</form>',
  ]));
}

export function consentPage(action: string, oauthQuery: string, details: { readonly clientName: string; readonly email: string; readonly scopes: string }): Response {
  return htmlResponse(200, htmlDocument('Allow Thermus access', [
    `<p>Allow ${escapeHtml(details.clientName)} to use this Thermus workspace as ${escapeHtml(details.email)}?</p>`,
    `<p>Requested scopes: ${escapeHtml(details.scopes)}</p>`,
    `<form method="post" action="${escapeHtml(action)}">`,
    oauthQueryField(oauthQuery),
    '<button type="submit" name="accept" value="yes">Allow</button>',
    '<button type="submit" name="accept" value="no">Deny</button>',
    '</form>',
  ]));
}

export function messagePage(status: number, message: string, headers: Readonly<Record<string, string>> = {}): Response {
  return htmlResponse(status, htmlDocument('Thermus sign-in', [`<p>${escapeHtml(message)}</p>`]), headers);
}

// The acceptance browser and the tests read the field with this exact attribute order.
function oauthQueryField(oauthQuery: string): string {
  return `<input type="hidden" name="oauth_query" value="${escapeHtml(oauthQuery)}">`;
}

function htmlDocument(title: string, content: readonly string[]): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    '<main>',
    `<h1>${escapeHtml(title)}</h1>`,
    ...content.filter((line) => line !== ''),
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function htmlResponse(status: number, html: string, headers: Readonly<Record<string, string>> = {}): Response {
  return new Response(html, { status, headers: { ...PAGE_HEADERS, ...headers } });
}
