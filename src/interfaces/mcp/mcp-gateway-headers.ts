import { ACCESS_CONTEXT_HEADER } from '../../accounts/identity/signed-access-context.ts';

// The hop-by-hop headers of RFC 9110, section 7.6.1, and the names that the Connection header lists: none of them may
// cross a proxy, and the fetch of Node refuses some of them (record SO-01d).
const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization'];
// fetch sets the host and the length itself, and the signed context replaces each client value. A cookie of the
// control plane is one of its credentials, so it never reaches a tenant.
const SET_BY_GATEWAY = ['host', 'content-length', 'cookie', ACCESS_CONTEXT_HEADER.toLowerCase()];
// The fetch of Node decodes a compressed answer, so its length and its encoding no longer describe the body.
const SET_BY_BRIDGE = ['content-length', 'content-encoding'];

export function tenantHeaders(headers: Headers, context: string): Headers {
  const forwarded = withoutHeaders(headers, [...HOP_BY_HOP, ...SET_BY_GATEWAY]);
  forwarded.set(ACCESS_CONTEXT_HEADER, context);
  return forwarded;
}

export function answerHeaders(headers: Headers): Headers {
  return withoutHeaders(headers, [...HOP_BY_HOP, ...SET_BY_BRIDGE]);
}

function withoutHeaders(headers: Headers, names: readonly string[]): Headers {
  const listed = (headers.get('connection') ?? '').split(',').map((name) => name.trim().toLowerCase());
  const dropped = new Set([...names, ...listed]);
  const kept = new Headers();
  for (const [name, value] of headers) if (!dropped.has(name)) kept.append(name, value);
  return kept;
}
