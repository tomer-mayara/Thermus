import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { escapeHtml } from '../../../html/html-escape.ts';
import { FORM_HEADERS, NOTICE_HEADERS, hiddenField, postForm } from '../../../hosted-admin/page-html.ts';
import type { SignupDocuments } from './workos-signup.ts';
import { signupDocumentReader } from './workos-signup-document-reader.ts';
import { SIGNUP_STYLE } from './workos-signup-style.ts';

const SIGNUP_STYLE_HASH = createHash('sha256').update(SIGNUP_STYLE).digest('base64');
const FREE_ACCESS = 'Free access requires no card and creates no automatic charge.';

interface SignupPage {
  readonly title: string;
  readonly heading: string;
  readonly description?: string;
  readonly content: readonly string[];
  readonly current?: 1 | 2;
  readonly response?: ResponseInit;
}

export function signupClosedPage(status = 200): Response {
  return notice('Activation is closed', 'New account activation is closed.', {
    actions: [link('/login', 'Sign in', 'primary-action'), link('mailto:legal@thermus.ai', 'Contact', 'secondary-action')], status,
  });
}

export function signupSignInPage(documents: SignupDocuments, loginUrl: string, status = 200): Response {
  return answer({ title: 'Start free access', heading: 'Start free access.', description: 'Connect your AI assistant to Thermus in two steps.', current: 1, content: [
    '<p class="step-caption">STEP 1 OF 2</p><h2>Sign in to continue</h2>',
    '<p class="task-copy">After sign-in, you will return here to review the terms and activate access.</p>',
    signupDocumentReader('privacy-notice', 'Privacy Notice', documents.notice),
    link(loginUrl, 'Sign in to continue', 'primary-action'),
    `<p class="task-copy">${FREE_ACCESS}</p>`,
  ], response: { status } });
}

export function signupFormPage(documents: SignupDocuments, csrfToken: string, action: string): Response {
  return answer({ title: 'Activate free access', heading: 'One step to your workspace.', description: 'Review the terms, then activate your free access.', current: 2, content: [
    '<p class="step-caption">STEP 2 OF 2</p><h2>Activate free access</h2>',
    `<p class="task-copy">${FREE_ACCESS}</p>`,
    signupDocumentReader('terms', 'Terms of Service', documents.terms),
    signupDocumentReader('privacy-notice', 'Privacy Notice', documents.notice),
    ...postForm(action, [hiddenField('csrf_token', csrfToken), hiddenField('document_version', documents.version),
      `<label class="agreement"><input type="checkbox" name="agreement" value="accepted" required><span class="agreement-text">${escapeHtml(documents.agreement.text)}</span></label>`,
      '<p class="agreement-links"><a href="#terms">Terms</a> · <a href="#privacy-notice">Privacy notice</a></p>',
    ], 'Activate free access'),
  ], response: { status: 200, headers: FORM_HEADERS } });
}

export function signupContinuePage(destination: string): Response {
  return notice('Your access is ready', 'You already have access to a workspace.', { actions: [link(destination, 'Continue', 'primary-action')] });
}

export function signupFailurePage(status: number, message: string, destination?: string): Response {
  const recovery = status === 409 ? link('mailto:legal@thermus.ai', 'Contact', 'primary-action')
    : status === 401 || status === 403 ? link('/login?return_to=%2Fsignup', 'Sign in again', 'primary-action')
      : link('/signup', 'Open signup again', 'primary-action');
  return notice('Activation did not complete', message, { actions: [recovery,
    ...(destination === undefined ? [] : [link(destination, 'Continue to another workspace', 'secondary-action')]),
  ], status });
}

export async function signupRequestNotice(response: Response): Promise<Response> {
  const { document } = parseHTML(await response.text());
  const title = document.querySelector('h1')?.textContent ?? 'Request failed';
  const messages = [...document.querySelectorAll('p')].map((paragraph) => `<p class="notice-message">${escapeHtml(paragraph.textContent ?? '')}</p>`);
  return answer({ title, heading: title, content: [...messages, link('/signup', 'Open signup again', 'primary-action')],
    response: { status: response.status, statusText: response.statusText, headers: response.headers },
  });
}

function notice(title: string, message: string, options: { readonly actions: readonly string[]; readonly status?: number }): Response {
  return answer({ title, heading: title, content: [`<p class="notice-message">${escapeHtml(message)}</p>`, ...options.actions], response: { status: options.status ?? 200 } });
}

function link(destination: string, label: string, className: string): string {
  return `<a class="${className}" href="${escapeHtml(destination)}">${label}</a>`;
}

function steps(current: 1 | 2): string {
  return `<ol class="steps" aria-label="Free access steps">
    <li${current === 1 ? ' aria-current="step"' : ''}><span class="step-number" aria-hidden="true">${current === 2 ? '✓' : '1'}</span><span><span class="step-name">${current === 2 ? 'Signed in' : 'Sign in'}</span><span class="step-description">Use your email or Google account.</span></span></li>
    <li${current === 2 ? ' aria-current="step"' : ''}><span class="step-number" aria-hidden="true">2</span><span><span class="step-name">Activate access</span><span class="step-description">Review the terms and open your workspace.</span></span></li>
  </ol><p class="free-note">No card required.<br>No automatic charge.</p>`;
}

function answer({ title, heading, description, content, current, response: init = {} }: SignupPage): Response {
  const headers = new Headers(init.headers ?? NOTICE_HEADERS);
  const policy = (headers.get('Content-Security-Policy') ?? '').split(';').map((directive) => directive.trim()).filter((directive) => !directive.startsWith('style-src '));
  headers.set('Content-Security-Policy', `${policy.join('; ')}; style-src 'sha256-${SIGNUP_STYLE_HASH}'; img-src 'self'; font-src 'self'`);
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Thermus</title><link rel="icon" href="/assets/thermus-favicon.svg" type="image/svg+xml"><style>${SIGNUP_STYLE}</style></head>
<body><a class="skip-link" href="#main-content">Skip to content</a><header class="site-header"><div class="header-content"><a class="brand" href="/" aria-label="Thermus home"><img src="/assets/thermus-logo.svg" alt="thermus" width="166" height="40"></a><a class="back-link" href="/">← Back to Thermus</a></div></header>
<main id="main-content" class="signup-layout ${current === 2 ? 'activation' : current === undefined ? 'notice-layout' : ''}">
  <section class="signup-introduction" aria-labelledby="page-title"><p class="eyebrow">Free access</p><h1 id="page-title">${escapeHtml(heading)}</h1>
  ${description ? `<p class="introduction-copy">${escapeHtml(description)}</p>` : ''}${current === undefined ? '' : steps(current)}</section>
  <section class="task-card">${content.join('\n')}</section>
</main><footer class="site-footer">Thermus AI Inc.</footer></body></html>`;
  return new Response(page, { status: 200, ...init, headers });
}
