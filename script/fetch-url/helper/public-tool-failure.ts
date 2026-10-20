const publicToolFailures = new Set([
  'Page processing failed', 'Page fetch failed', 'Server busy. Try again later.',
  'Request cancelled', 'Invalid tool arguments', 'Access denied',
  ...[
    'HTTP request failed (status unavailable)', 'Renderer readiness timed out', 'DNS lookup timed out',
    'Renderer could not start', ...['ENOENT', 'EACCES', 'ENOEXEC', 'ENOTDIR'].map((code) => `Renderer could not start (${code})`),
    'DNS lookup failed', 'Renderer request timed out', 'Renderer connection failed', 'Renderer TLS failed',
    'Renderer redirect limit exceeded', 'Renderer transfer failed', 'Renderer output limit exceeded',
    'Renderer process was killed', 'Renderer process was interrupted', 'Renderer process failed',
  ].map((detail) => `Page fetch failed: ${detail}`),
]);

export function isPublicToolFailure(message: string): boolean {
  return publicToolFailures.has(message) || /^Page fetch failed: HTTP [45][0-9]{2}$/.exec(message)?.[0] === message;
}
