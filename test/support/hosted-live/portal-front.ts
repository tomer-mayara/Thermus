import { readdir, readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

interface PortalFile {
  readonly body: Buffer;
  readonly type: string;
}

export interface PortalSite {
  readonly files: Map<string, PortalFile>;
  readonly headers: Readonly<Record<string, string>>;
  readonly thermus: URL;
}

const contentTypes: Readonly<Record<string, string>> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const hopHeaders = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'content-length', 'proxy-connection']);
// The portal posts its sign-out form to the server. Chrome applies form-action also to each redirect after the post:
// the server sends the browser to the WorkOS logout URL, WorkOS sends it to the logout of the AuthKit domain, and
// AuthKit sends it to the Sign-out URI of the portal.
export function portalHeaders(authkitIssuer: string): Readonly<Record<string, string>> {
  return {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': `default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.workos.com ${new URL(authkitIssuer).origin}`,
  };
}

export async function portalFiles(directory: string): Promise<Map<string, PortalFile>> {
  const files = new Map<string, PortalFile>();
  const read = async (path: string, file: string): Promise<void> => {
    files.set(path, { body: await readFile(join(directory, file)), type: contentTypes[extname(file)] ?? 'application/octet-stream' });
  };
  try {
    await read('/', 'index.html');
    for (const name of await readdir(join(directory, 'assets'))) await read(`/assets/${name}`, join('assets', name));
  } catch (cause) {
    throw new Error(`The local HTTPS site has no portal build in ${directory}. Run npm run build:user-portal first; npm run test:hosted-live does it.`, { cause });
  }
  return files;
}

export async function answer(request: IncomingMessage, response: ServerResponse, site: PortalSite): Promise<void> {
  const path = request.url ?? '/';
  const file = request.method === 'GET' || request.method === 'HEAD' ? site.files.get(path) : undefined;
  try {
    if (file) {
      response.writeHead(200, { ...site.headers, 'Content-Type': file.type }).end(request.method === 'HEAD' ? undefined : file.body);
      return;
    }
    await forward(request, response, new URL(path, site.thermus));
  } catch {
    if (response.destroyed) return;
    if (response.headersSent) response.destroy();
    else response.writeHead(502).end();
  }
}

async function forward(request: IncomingMessage, response: ServerResponse, target: URL): Promise<void> {
  const method = request.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? {} : { body: Readable.toWeb(request) as ReadableStream, duplex: 'half' as const };
  const disconnected = new AbortController();
  const cancel = (): void => {
    if (!response.writableFinished) disconnected.abort();
  };
  response.once('close', cancel);
  request.once('aborted', cancel);
  try {
    const answer = await fetch(target, { method, headers: forwardedHeaders(request), redirect: 'manual', signal: disconnected.signal, ...body });
    response.writeHead(answer.status, answerHeaders(answer));
    response.flushHeaders();
    if (answer.body === null) response.end();
    else await pipeline(Readable.fromWeb(answer.body), response, { signal: disconnected.signal });
  } finally {
    response.off('close', cancel);
    request.off('aborted', cancel);
  }
}

function forwardedHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || hopHeaders.has(name)) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  return headers;
}

// A flat list keeps each Set-Cookie header separate.
function answerHeaders(answer: Response): string[] {
  const outgoing: string[] = [];
  for (const [name, value] of answer.headers) {
    if (name !== 'set-cookie' && !hopHeaders.has(name)) outgoing.push(name, value);
  }
  for (const cookie of answer.headers.getSetCookie()) outgoing.push('set-cookie', cookie);
  return outgoing;
}
