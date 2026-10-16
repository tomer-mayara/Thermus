import { createHash } from 'node:crypto';
import { escapeHtml } from '../../../html/html-escape.ts';
import { FORM_HEADERS, NOTICE_HEADERS, hiddenField, htmlDocument, postForm } from '../../../hosted-admin/page-html.ts';
import type { SignupDocuments } from './workos-signup.ts';

const SIGNUP_STYLE = 'body { margin: 0; padding: 1rem; font-family: system-ui, sans-serif; line-height: 1.5; } main { max-width: 72ch; margin: auto; } pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }';
const SIGNUP_STYLE_HASH = createHash('sha256').update(SIGNUP_STYLE).digest('base64');

export function signupClosedPage(status = 200): Response {
  return answer('Activation is closed', ['<p>New account activation is closed.</p>', '<p><a href="/login">Sign in</a></p>', '<p><a href="mailto:legal@thermus.ai">Contact</a></p>'], { status });
}

export function signupSignInPage(documents: SignupDocuments, loginUrl: string): Response {
  return answer('Start free access', [notice(documents), `<p><a href="${escapeHtml(loginUrl)}">Sign in</a> to continue.</p>`]);
}

export function signupFormPage(documents: SignupDocuments, csrfToken: string, action: string): Response {
  return answer('Start free access', [
    '<p>Free access requires no card and creates no automatic charge.</p>',
    `<section id="terms"><h2>Terms</h2><pre>${escapeHtml(documents.terms.text)}</pre></section>`,
    notice(documents),
    ...postForm(action, [hiddenField('csrf_token', csrfToken), hiddenField('document_version', documents.version),
      `<p><label><input type="checkbox" name="agreement" value="accepted" required> ${escapeHtml(documents.agreement.text)}</label> <a href="#terms">Terms</a>. <a href="#privacy-notice">Privacy notice</a>.</p>`,
    ], 'Activate free access'),
  ], { status: 200, headers: FORM_HEADERS });
}

export function signupContinuePage(destination: string): Response {
  return answer('Your access is ready', ['<p>You already have access to a workspace.</p>', `<p><a href="${escapeHtml(destination)}">Continue</a></p>`]);
}

export function signupFailurePage(status: number, message: string, destination?: string): Response {
  return answer('Activation did not complete', [`<p>${escapeHtml(message)}</p>`,
    ...(status === 409 ? ['<p><a href="mailto:legal@thermus.ai">Contact</a></p>'] : []),
    ...(destination === undefined ? [] : [`<p><a href="${escapeHtml(destination)}">Continue to another workspace</a></p>`]),
  ], { status });
}

function notice(documents: SignupDocuments): string {
  return `<section id="privacy-notice"><h2>Privacy notice</h2><pre>${escapeHtml(documents.notice.text)}</pre></section>`;
}

function answer(title: string, content: readonly string[], init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers ?? NOTICE_HEADERS);
  headers.set('Content-Security-Policy', `${headers.get('Content-Security-Policy')}; style-src 'sha256-${SIGNUP_STYLE_HASH}'`);
  const page = htmlDocument(title, content).replace('</head>', `<style>${SIGNUP_STYLE}</style>\n</head>`);
  return new Response(page, { status: 200, ...init, headers });
}
