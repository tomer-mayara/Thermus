import { escapeHtml } from '../../../html/html-escape.ts';
import { FORM_HEADERS, NOTICE_HEADERS, hiddenField, htmlDocument, postForm } from '../../../hosted-admin/page-html.ts';
import type { SignupDocuments } from './workos-signup.ts';

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

export function signupFailurePage(status: number, message: string): Response {
  return answer('Activation did not complete', [`<p>${escapeHtml(message)}</p>`,
    ...(status === 409 ? ['<p><a href="mailto:legal@thermus.ai">Contact</a></p>'] : []),
  ], { status });
}

function notice(documents: SignupDocuments): string {
  return `<section id="privacy-notice"><h2>Privacy notice</h2><pre>${escapeHtml(documents.notice.text)}</pre></section>`;
}

function answer(title: string, content: readonly string[], init: ResponseInit = {}): Response {
  return new Response(htmlDocument(title, content), { status: 200, headers: NOTICE_HEADERS, ...init });
}
