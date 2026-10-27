import { createHash, type KeyObject } from 'node:crypto';
import { SignJWT } from 'jose';

// The access that the control plane resolved for one user. The gateway signs it into each context.
export interface GatewayAccess {
  readonly authority: string;
  readonly subject: string;
  readonly organizationId: string;
  readonly grants: ReadonlyArray<{ readonly role: string; readonly permissions: readonly string[] }>;
  readonly name?: string;
}

// The changes of one context: another organization, another key, another token, or an earlier signature time.
export interface ContextChanges extends Partial<GatewayAccess> {
  readonly key?: KeyObject;
  readonly tokenOfHash?: string;
  readonly issuedAtUnixSeconds?: number;
}

export interface GatewayRequest {
  readonly httpMethod: string;
  readonly rpcMethod: string | undefined;
  readonly context: string;
  readonly status: number;
}

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

const header = 'Thermus-Access';
const lifetimeSeconds = 120;

// The gateway of the control plane, as the tests stand in for it until SO-05 adds it: it signs a new context for each
// request that it forwards, with the header contract of the authentication design. The tests write this contract
// with jose directly, so the tenant check does not rely on the production signer.
export class SignedContextGateway {
  readonly requests: GatewayRequest[] = [];

  constructor(private readonly key: KeyObject, private readonly access: GatewayAccess) {}

  async contextFor(token: string, changes: ContextChanges = {}): Promise<string> {
    const access = { ...this.access, ...changes };
    const issuedAt = changes.issuedAtUnixSeconds ?? Math.floor(Date.now() / 1_000);
    const claims = {
      grants: access.grants,
      tokenHash: createHash('sha256').update(changes.tokenOfHash ?? token).digest('base64url'),
      ...(access.name === undefined ? {} : { name: access.name }),
    };
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'EdDSA', typ: 'thermus-access+jwt' })
      .setIssuer(access.authority)
      .setSubject(access.subject)
      .setAudience(access.organizationId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + lifetimeSeconds)
      .sign(changes.key ?? this.key);
  }

  // The fetch of an MCP client transport: each request gets a new context for the token, as a forward does.
  fetchFor(token: string): FetchLike {
    return async (url, init = {}) => {
      const context = await this.contextFor(token);
      const headers = new Headers(init.headers);
      headers.set(header, context);
      const response = await fetch(url, { ...init, headers });
      this.requests.push({ httpMethod: init.method ?? 'GET', rpcMethod: rpcMethodOf(init.body), context, status: response.status });
      return response;
    };
  }

  // The context of the first forwarded request of a JSON-RPC method, such as tools/call.
  contextOf(rpcMethod: string): string | undefined {
    return this.requests.find((request) => request.rpcMethod === rpcMethod)?.context;
  }
}

function rpcMethodOf(body: RequestInit['body']): string | undefined {
  if (typeof body !== 'string') return undefined;
  try {
    const message: unknown = JSON.parse(body);
    return typeof message === 'object' && message !== null && 'method' in message && typeof message.method === 'string' ? message.method : undefined;
  } catch {
    return undefined;
  }
}
