import { lstat, readdir, readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { parseHTML } from 'linkedom';
import type { Application } from './application.ts';

interface PortalFile {
  readonly body: Buffer<ArrayBuffer>;
  readonly type: string;
}

const contentTypes: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const assetPath = /^\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Production loads the complete build before it owns an application or starts a listener.
export class HostedPortal {
  readonly #files: ReadonlyMap<string, PortalFile>;
  readonly #headers: Readonly<Record<string, string>>;

  private constructor(files: ReadonlyMap<string, PortalFile>, formActionOrigins: readonly string[]) {
    this.#files = files;
    const formActions = ["'self'", ...formActionOrigins.map(formActionOrigin)].join(' ');
    this.#headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': `default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action ${formActions}`,
    };
  }

  static async load(formActionOrigins: readonly string[], directory = new URL('.', import.meta.resolve('#hosted-portal/index.html'))): Promise<HostedPortal> {
    try {
      const index = new URL('index.html', directory);
      const assets = new URL('assets/', directory);
      if (!(await lstat(index)).isFile() || !(await lstat(new URL('assets', directory))).isDirectory()) throw new Error('The build needs regular files.');
      const files = new Map<string, PortalFile>([['/', { body: await readFile(index), type: 'text/html; charset=utf-8' }]]);
      for (const entry of await readdir(assets, { withFileTypes: true })) {
        const path = `/assets/${entry.name}`;
        if (!entry.isFile() || !assetPath.test(path)) throw new Error('The build has an invalid asset.');
        const body = await readFile(new URL(entry.name, assets));
        if (body.length === 0) throw new Error('The build has an empty asset.');
        files.set(path, { body, type: contentTypes[extname(entry.name)] ?? 'application/octet-stream' });
      }
      validateIndex(files);
      return new HostedPortal(files, formActionOrigins);
    } catch {
      throw new Error('The hosted portal build is missing or invalid. Run npm run build:user-portal before startup.');
    }
  }

  withApplication(application: Application): Application {
    return {
      handle: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === '/healthz') return health(request);
        if (!isRead(request) || !isPortalPath(path)) return application.handle(request);
        return this.#portalFile(path, request.method === 'HEAD');
      },
      close: (listenerDrain) => application.close(listenerDrain),
    };
  }

  #portalFile(path: string, head: boolean): Response {
    const file = this.#files.get(path);
    if (file === undefined) return new Response(head ? null : 'Not found\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    return new Response(head ? null : file.body, {
      headers: { ...this.#headers, 'Content-Type': file.type, 'Content-Length': String(file.body.length) },
    });
  }
}

function health(request: Request): Response {
  if (!isRead(request)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  return new Response(request.method === 'HEAD' ? null : 'ok\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function isRead(request: Request): boolean {
  return request.method === 'GET' || request.method === 'HEAD';
}

function isPortalPath(path: string): boolean {
  return path === '/' || path.startsWith('/assets/');
}

function formActionOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('A form destination needs an HTTP origin.');
  return url.origin;
}

function validateIndex(files: ReadonlyMap<string, PortalFile>): void {
  const { document } = parseHTML(files.get('/')?.body.toString('utf8') ?? '');
  const scripts = [...document.querySelectorAll('script')];
  if (!scripts.some((script) => script.getAttribute('type') === 'module')) throw new Error('The build has no portal module.');
  if (!scripts.every((script) => isBuildAsset(files, script.getAttribute('src') ?? '', '.js'))) throw new Error('The build has a missing portal module.');
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')];
  if (!styles.every((style) => isBuildAsset(files, style.getAttribute('href') ?? '', '.css'))) throw new Error('The build has a missing stylesheet.');
}

function isBuildAsset(files: ReadonlyMap<string, PortalFile>, source: string, extension: string): boolean {
  return assetPath.test(source) && source.endsWith(extension) && files.has(source);
}
