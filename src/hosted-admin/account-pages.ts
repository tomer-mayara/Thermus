interface Notice {
  readonly title: string;
  readonly message: string;
}

// Each page shows only this fixed text, so no request value reaches it and it needs no escaping.
const NOTICES = {
  unavailable: {
    title: 'Hosted authentication is not available',
    message: 'Hosted authentication is not available yet. No one can sign in, and no account, organization, billing, or MCP operation is available.',
  },
  signedOut: { title: 'Sign-in required', message: 'Sign in to use this page.' },
  denied: { title: 'Access denied', message: 'Your account has no access to this page in the selected organization.' },
  notFound: { title: 'Page not found', message: 'This page does not exist.' },
} as const satisfies Readonly<Record<string, Notice>>;

const PAGE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

export function authenticationUnavailablePage(): Response {
  return noticePage(503, NOTICES.unavailable);
}

export function signInRequiredPage(): Response {
  return noticePage(401, NOTICES.signedOut);
}

export function accessDeniedPage(): Response {
  return noticePage(403, NOTICES.denied);
}

export function notFoundPage(): Response {
  return noticePage(404, NOTICES.notFound);
}

function noticePage(status: number, notice: Notice): Response {
  const page = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${notice.title}</title>`,
    '</head>',
    '<body>',
    '<main>',
    `<h1>${notice.title}</h1>`,
    `<p>${notice.message}</p>`,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
  return new Response(page, { status, headers: PAGE_HEADERS });
}
