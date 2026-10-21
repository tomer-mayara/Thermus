import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { connectRedirectUri, connectScope, mcpResource, requestTimeout } from './settings.ts';

interface ConnectAuthorizationRequest {
  readonly url: string;
  readonly state: string;
  readonly verifier: string;
}

interface TokenBody {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly id_token?: string;
  readonly expires_in?: number;
  readonly scope?: string;
  readonly token_type?: string;
  readonly error?: string;
  readonly error_description?: string;
}

interface TokenAnswer {
  readonly status: number;
  readonly body: TokenBody;
}

export interface IssuedTokens {
  readonly accessToken: string;
  readonly refreshToken: string | undefined;
  readonly body: TokenBody;
}

interface CodeGrant {
  readonly code: string;
  readonly verifier: string;
  readonly resource?: string;
}

interface ClientCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

type FormFields = Readonly<Record<string, string | undefined>>;

// A public OAuth client with PKCE, as an MCP client uses Connect. It requests the MCP resource.
export function connectAuthorizationRequest(issuer: string, clientId: string): ConnectAuthorizationRequest {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(16).toString('base64url');
  const url = new URL(`${issuer}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: connectRedirectUri,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state,
    resource: mcpResource,
    scope: connectScope,
  }).toString();
  return { url: url.href, state, verifier };
}

async function requestTokens(issuer: string, fields: FormFields): Promise<TokenAnswer> {
  const form = new URLSearchParams(Object.entries(fields).flatMap(([name, value]): Array<[string, string]> => (value === undefined ? [] : [[name, value]])));
  const response = await fetch(`${issuer}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form,
    signal: AbortSignal.timeout(requestTimeout),
  });
  const body = (await response.json().catch(() => ({}))) as TokenBody;
  return { status: response.status, body };
}

export function exchangeConnectCode(issuer: string, clientId: string, grant: CodeGrant): Promise<TokenAnswer> {
  const { code, verifier, resource } = grant;
  return requestTokens(issuer, { grant_type: 'authorization_code', code, redirect_uri: connectRedirectUri, client_id: clientId, code_verifier: verifier, resource });
}

export function requestMachineTokens(issuer: string, client: ClientCredentials, resource?: string): Promise<TokenAnswer> {
  return requestTokens(issuer, { grant_type: 'client_credentials', client_id: client.clientId, client_secret: client.clientSecret, resource });
}

export function issuedTokens(answer: TokenAnswer, request: string): IssuedTokens {
  const { status, body } = answer;
  assert.ok(status === 200 && body.access_token, `${request} gave HTTP ${status}: ${body.error ?? 'no error'} ${body.error_description ?? ''}`.trim());
  return { accessToken: body.access_token, refreshToken: body.refresh_token, body };
}
