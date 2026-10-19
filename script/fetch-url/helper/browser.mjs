import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { validateAuthorizationResponseIssuer } from '@modelcontextprotocol/client';
import { FetchUrlError } from './errors.mjs';

export function callbackResult(parameters, expected) {
  const single = ['state', 'code', 'error', 'iss', 'error_description', 'error_uri'];
  if (single.some((key) => parameters.getAll(key).length > 1)) throw new FetchUrlError('Invalid OAuth callback.');
  const state = parameters.get('state') ?? '';
  const received = Buffer.from(state);
  const wanted = Buffer.from(expected.state);
  if (!state || received.length !== wanted.length || !timingSafeEqual(received, wanted)) throw new FetchUrlError('Invalid OAuth callback state.');
  const code = parameters.get('code');
  const error = parameters.get('error');
  requireCallbackChoice(parameters, code, error);
  const iss = parameters.get('iss') ?? undefined;
  try {
    validateAuthorizationResponseIssuer({ iss, expectedIssuer: expected.metadata.issuer, issParameterSupported: expected.metadata.authorization_response_iss_parameter_supported === true });
  } catch { throw new FetchUrlError('Invalid OAuth callback issuer.'); }
  return error ? { denied: true } : { code, iss };
}

function requireCallbackChoice(parameters, code, error) {
  if (parameters.has('code') === parameters.has('error') || !(code || error)) throw new FetchUrlError('Invalid OAuth callback.');
  if ([...parameters.values()].some((value) => /[\u0000-\u001f\ufffd]/u.test(value))) throw new FetchUrlError('Invalid OAuth callback.');
}

export function launchBrowser(url, signal) {
  signal.throwIfAborted();
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  return new Promise((resolve, reject) => {
    const child = spawn(command, [url.href], { stdio: 'ignore' });
    const finish = (error) => { signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(); };
    const abort = () => { child.unref(); finish(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    child.once('error', finish);
    child.once('close', (code) => finish(code === 0 ? undefined : new FetchUrlError('The browser opener failed.')));
    child.once('spawn', () => child.unref());
    if (signal.aborted) abort();
  });
}

export async function browserAuthorization(pending, signal) {
  signal.throwIfAborted();
  const redirect = new URL(pending.redirectUrl);
  const answer = Promise.withResolvers();
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
  let launched;
  const abort = () => { server.closeAllConnections(); answer.reject(signal.reason); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(redirect.port), '127.0.0.1', resolve); });
    signal.throwIfAborted();
    launched = Promise.resolve().then(() => (pending.openBrowser ?? launchBrowser)(pending.authorizationUrl, launch.signal)).catch(() => {
      if (!launch.signal.aborted) process.stderr.write(`Open this URL in a browser on this machine:\n${pending.authorizationUrl.href}\n`);
    });
    return await answer.promise;
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error?.code === 'EADDRINUSE') throw new FetchUrlError('The OAuth callback port 46481 is busy. Close its owner and run --login again.');
    throw new FetchUrlError('Browser authorization failed. Run --login again.');
  } finally {
    launch.abort(new FetchUrlError('Browser observation ended.'));
    signal.removeEventListener('abort', abort);
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    await launched;
  }
}
