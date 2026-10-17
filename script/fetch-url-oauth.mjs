import { randomBytes } from 'node:crypto';
import { discoverOAuthProtectedResourceMetadata, discoverAuthorizationServerMetadata, startAuthorization, exchangeAuthorization, refreshAuthorization } from '@modelcontextprotocol/client';
import { browserAuthorization } from './fetch-url-browser.mjs';
import { FetchUrlError } from './fetch-url-errors.mjs';

export function readyToken(response, startedAt) {
  if (typeof response.token_type !== 'string' || response.token_type.toLowerCase() !== 'bearer') throw tokenError();
  const ready = { accessToken: requiredCredential(response.access_token), expiresAt: tokenExpiry(response.expires_in, startedAt) };
  if (response.refresh_token !== undefined) ready.refreshToken = requiredCredential(response.refresh_token);
  if (response.scope !== undefined) {
    if (typeof response.scope !== 'string' || response.scope.length > 65_536) throw tokenError();
    ready.scope = response.scope;
  }
  return ready;
}

function tokenError() { return new FetchUrlError('The OAuth token response is not usable. Run --login again.'); }

function requiredCredential(value) {
  if (typeof value !== 'string' || !value || value.length > 65_536 || !/^[A-Za-z0-9._~+/-]+=*$/.test(value)) throw tokenError();
  return value;
}

function tokenExpiry(duration, startedAt) {
  if (!Number.isSafeInteger(duration) || duration <= 0) throw tokenError();
  const expiresAt = startedAt + duration * 1000;
  if (!Number.isSafeInteger(expiresAt) || Math.abs(expiresAt) > 8_640_000_000_000_000) throw tokenError();
  return expiresAt;
}

function issuerMetadataUrl(issuer) {
  const url = new URL(issuer);
  return new URL(`/.well-known/oauth-authorization-server${url.pathname.replace(/\/$/, '')}`, url.origin).href;
}

function oauthFetch(allowed, signal, fetchImpl = fetch) {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (!allowed.includes(url.href)) throw new FetchUrlError('OAuth metadata selected an unexpected endpoint.');
    signal.throwIfAborted();
    try {
      const response = await fetchImpl(input, { ...init, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
      if (!response.ok) { await response.body?.cancel(); throw new FetchUrlError('The OAuth request was refused. Run --login again if needed.'); }
      return response;
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (error instanceof FetchUrlError) throw error;
      throw new FetchUrlError('The OAuth request failed. Check connectivity and run --login again if needed.');
    }
  };
}

export async function discoverHostedAuthorization(profile, signal, fetchImpl) {
  const endpoint = new URL(profile.endpoint);
  const resourceMetadataUrl = new URL(`/.well-known/oauth-protected-resource${endpoint.pathname.replace(/\/$/, '')}`, endpoint.origin).href;
  const metadataFetch = oauthFetch([resourceMetadataUrl, issuerMetadataUrl(profile.issuer)], signal, fetchImpl);
  const resource = await discoverOAuthProtectedResourceMetadata(endpoint, { resourceMetadataUrl }, metadataFetch);
  if (resource.resource !== profile.endpoint || !resource.authorization_servers?.includes(profile.issuer)) throw new FetchUrlError('OAuth resource metadata does not match hosted Thermus.');
  const metadata = await discoverAuthorizationServerMetadata(profile.issuer, { fetchFn: metadataFetch });
  requireAuthorizationMetadata(metadata, profile.issuer);
  return { metadata, fetchFn: oauthFetch([metadata.token_endpoint], signal, fetchImpl) };
}

function requireAuthorizationMetadata(metadata, issuer) {
  if (!metadata || metadata.issuer !== issuer || !metadata.code_challenge_methods_supported?.includes('S256') || !metadata.response_types_supported?.includes('code')) throw new FetchUrlError('OAuth issuer metadata is not complete for hosted Thermus.');
  for (const value of [metadata.authorization_endpoint, metadata.token_endpoint]) {
    requireIssuerEndpoint(value, issuer);
  }
}

function requireIssuerEndpoint(value, issuer) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== new URL(issuer).origin || url.username || url.password || url.hash) throw new FetchUrlError('OAuth issuer metadata selected an unsafe endpoint.');
}

async function freshAuthorization(options, signal) {
  if (!options.interactive) throw new FetchUrlError('No usable hosted credentials. Run --login interactively.');
  const { profile } = options;
  const { metadata, fetchFn } = await discoverHostedAuthorization(profile, signal, options.fetch);
  const redirectUrl = options.redirectUrl ?? 'http://127.0.0.1:46481/callback';
  const state = randomBytes(32).toString('base64url');
  const { authorizationUrl, codeVerifier } = await startAuthorization(profile.issuer, {
    metadata, clientInformation: { client_id: profile.clientId }, redirectUrl, state, scope: 'openid offline_access', resource: profile.endpoint,
  });
  const result = await browserAuthorization({ redirectUrl, state, metadata, authorizationUrl, openBrowser: options.openBrowser }, signal);
  if (result.denied) throw new FetchUrlError('Browser authorization was denied. Run --login when ready.');
  const startedAt = Date.now();
  const response = await exchangeAuthorization(profile.issuer, {
    metadata, clientInformation: { client_id: profile.clientId }, authorizationCode: result.code, iss: result.iss,
    codeVerifier, redirectUri: redirectUrl, resource: profile.endpoint, fetchFn,
  });
  return readyToken(response, startedAt);
}

async function credentialsFromStore(options, store, signal) {
  if (options.operation === 'logout') { store.logout(); return; }
  if (options.operation === 'login') return saveCredentials(store, await freshAuthorization(options, signal), signal);
  const saved = store.read();
  if (saved === null) return saveCredentials(store, await freshAuthorization(options, signal), signal);
  if (saved.status !== 'ready') throw new FetchUrlError('Hosted credentials require recovery. Run --login interactively.');
  if (saved.expiresAt > Date.now() + 30_000) return saved.accessToken;
  if (!saved.refreshToken) throw new FetchUrlError('Hosted credentials have expired without a refresh token. Run --login interactively.');
  const { metadata, fetchFn } = await discoverHostedAuthorization(options.profile, signal, options.fetch);
  signal.throwIfAborted();
  store.markLoginRequired();
  try {
    const startedAt = Date.now();
    const response = await refreshAuthorization(options.profile.issuer, {
      metadata, clientInformation: { client_id: options.profile.clientId }, refreshToken: saved.refreshToken, resource: options.profile.endpoint, fetchFn,
    });
    return saveCredentials(store, readyToken(response, startedAt), signal);
  } catch { throw new FetchUrlError('OAuth refresh did not finish safely. Run --login interactively; the old refresh will not be replayed.'); }
}

function saveCredentials(store, ready, signal) {
  signal.throwIfAborted();
  if (ready.expiresAt <= Date.now() + 30_000) throw new FetchUrlError('The OAuth token response expires too soon. Run --login again.');
  store.saveReady(ready);
  signal.throwIfAborted();
  return ready.accessToken;
}

export async function prepareOAuth(options, signal) {
  if (options.operation === 'login' && !options.interactive) throw new FetchUrlError('Run --login interactively to create hosted credentials.');
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new FetchUrlError('Hosted authorization timed out. Run --login again.')), options.authTimeoutMs ?? 300_000);
  const bounded = AbortSignal.any([signal, timeout.signal]);
  try {
    const { withOAuthStore, OAuthStoreError } = await import('./fetch-url-credentials.mjs');
    try { return await withOAuthStore(options.profile, (store) => { bounded.throwIfAborted(); return credentialsFromStore(options, store, bounded); }); }
    catch (error) { if (error instanceof OAuthStoreError) throw new FetchUrlError(error.message); throw error; }
  } catch (error) {
    if (bounded.aborted) throw bounded.reason;
    if (error instanceof FetchUrlError) throw error;
    throw new FetchUrlError('Hosted OAuth preparation failed. Check connectivity or run --login again.');
  } finally { clearTimeout(timer); }
}
