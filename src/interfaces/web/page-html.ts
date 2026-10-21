import { escapeHtml } from './html-escape.ts';

// The headers of each account page. A notice posts no form.
export const NOTICE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

// The forms of a page post only to this site.
export const FORM_HEADERS: Readonly<Record<string, string>> = {
  ...NOTICE_HEADERS,
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

export function htmlDocument(title: string, content: readonly string[]): string {
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

// The button text is escaped here; the fields are complete HTML.
export function postForm(action: string, fields: readonly string[], button: string): string[] {
  return [`<form method="post" action="${escapeHtml(action)}">`, ...fields, `<button type="submit">${escapeHtml(button)}</button>`, '</form>'];
}

export function hiddenField(name: string, value: string): string {
  return `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
}
