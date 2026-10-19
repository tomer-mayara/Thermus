import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { validateAuthorizationResponseIssuer } from '@modelcontextprotocol/client';
import { FetchUrlError } from './errors.ts';

export type BrowserOpener = (url: URL, signal: AbortSignal) => Promise<void>;
type CallbackExpected = { state: string; metadata: { issuer: string; authorization_response_iss_parameter_supported?: boolean } };
export type CallbackResult = { denied: true; code?: never; iss?: never } | { denied?: never; code: string; iss: string | undefined };
type PendingAuthorization = CallbackExpected & { redirectUrl: string; authorizationUrl: URL; openBrowser?: BrowserOpener };

function callbackResult(parameters: URLSearchParams, expected: CallbackExpected): CallbackResult {
  const single = ['state', 'code', 'error', 'iss', 'error_description', 'error_uri'];
  if (single.some((key) => parameters.getAll(key).length > 1)) throw new FetchUrlError('Invalid OAuth callback.');
  const state = parameters.get('state') ?? '';
  const received = Buffer.from(state);
  const wanted = Buffer.from(expected.state);
  if (!state || received.length !== wanted.length || !timingSafeEqual(received, wanted)) throw new FetchUrlError('Invalid OAuth callback state.');
  const code = parameters.get('code');
  const error = parameters.get('error');
  const choice = requireCallbackChoice(parameters, code, error);
  const iss = parameters.get('iss') ?? undefined;
  try {
    validateAuthorizationResponseIssuer({ iss, expectedIssuer: expected.metadata.issuer, issParameterSupported: expected.metadata.authorization_response_iss_parameter_supported === true });
  } catch { throw new FetchUrlError('Invalid OAuth callback issuer.'); }
  return 'code' in choice ? { code: choice.code, iss } : choice;
}

function requireCallbackChoice(parameters: URLSearchParams, code: string | null, error: string | null): { denied: true } | { code: string } {
  if (parameters.has('code') === parameters.has('error') || !(code || error)) throw new FetchUrlError('Invalid OAuth callback.');
  if ([...parameters.values()].some((value) => /[\u0000-\u001f\ufffd]/u.test(value))) throw new FetchUrlError('Invalid OAuth callback.');
  return code ? { code } : { denied: true };
}

function launchBrowser(url: URL, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, [url.href], { stdio: 'ignore' });
    const finish = (error?: unknown) => { signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(); };
    const abort = () => { child.unref(); finish(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    child.once('error', finish);
    child.once('close', (code) => finish(code === 0 ? undefined : new FetchUrlError('The browser opener failed.')));
    child.once('spawn', () => child.unref());
    if (signal.aborted) abort();
  });
}

export async function browserAuthorization(pending: PendingAuthorization, signal: AbortSignal): Promise<CallbackResult> {
  signal.throwIfAborted();
  const redirect = new URL(pending.redirectUrl);
  const answer = Promise.withResolvers<CallbackResult>();
  answer.promise.catch(() => undefined);
  const server = createServer((request, response) => {
    try {
      if ((request.url?.length ?? 0) > 8192 || /%(?![\da-f]{2})/i.test(request.url ?? '')) throw new FetchUrlError('Invalid callback.');
      const url = new URL(request.url ?? '/', redirect.origin);
      if (request.method !== 'GET' || url.pathname !== redirect.pathname) { response.writeHead(404).end('Not found.'); return; }
      const result = callbackResult(url.searchParams, pending);
      response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Authorization received. Return to the terminal.');
      answer.resolve(result);
    } catch { response.writeHead(400).end('Invalid callback. Return to the terminal.'); }
  });
  const launch = new AbortController();
  let launched: Promise<void> | undefined;
  const abort = () => { server.closeAllConnections(); answer.reject(signal.reason); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(Number(redirect.port), '127.0.0.1', resolve); });
    signal.throwIfAborted();
    launched = Promise.resolve().then(() => (pending.openBrowser ?? launchBrowser)(pending.authorizationUrl, launch.signal)).catch(() => {
      if (!launch.signal.aborted) process.stderr.write(`Open this URL in a browser on this machine:\n${pending.authorizationUrl.href}\n`);
    });
    return await answer.promise;
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EADDRINUSE') throw new FetchUrlError('The OAuth callback port 46481 is busy. Close its owner and run --login again.');
    throw new FetchUrlError('Browser authorization failed. Run --login again.');
  } finally {
    launch.abort(new FetchUrlError('Browser observation ended.'));
    signal.removeEventListener('abort', abort);
    await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await launched;
  }
}
