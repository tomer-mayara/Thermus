import type { IncomingMessage } from 'node:http';
import type { RoleGrant } from '../../../../src/accounts/identity/access-context.ts';
import type { AccessContextVerification } from '../../../../src/accounts/identity/signed-access-context.ts';

export interface VerifiedContextRecord {
  readonly authority: string;
  readonly subject: string;
  readonly name?: string;
  readonly organizationId: string;
  readonly grants: readonly RoleGrant[];
}

export interface UpstreamRequest {
  readonly method: string;
  readonly path: string;
  // Lower-case header names, as the tenant received them.
  readonly headers: Readonly<Record<string, string>>;
  readonly bearerToken?: string;
  readonly rpcMethod?: string;
  readonly toolName?: string;
  readonly context?: VerifiedContextRecord;
  answerStatus?: number;
  signalAt?: number;
}

export function bearerTokenOf(request: Request): string | undefined {
  return /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
}

export function upstreamRecordOf(request: Request, body: string, verification: AccessContextVerification): UpstreamRequest {
  const bearerToken = bearerTokenOf(request);
  return {
    method: request.method, path: new URL(request.url).pathname, headers: Object.fromEntries(request.headers), ...messageOf(body),
    ...(bearerToken === undefined ? {} : { bearerToken }),
    ...(verification.status === 'verified' ? { context: contextRecordOf(verification.context) } : {}),
  };
}

export function failedCallRecordOf(incoming: IncomingMessage): UpstreamRequest {
  return { method: incoming.method ?? '', path: incoming.url ?? '', headers: headersOf(incoming), rpcMethod: 'tools/call' };
}

function contextRecordOf(context: VerifiedContextRecord & { readonly expiresAtUnixSeconds: number }): VerifiedContextRecord {
  const { expiresAtUnixSeconds: _expiry, ...record } = context;
  return record;
}

function headersOf(incoming: IncomingMessage): Record<string, string> {
  return Object.fromEntries(Object.entries(incoming.headers).map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value ?? '']));
}

function messageOf(body: string): { readonly rpcMethod?: string; readonly toolName?: string } {
  try {
    const message = JSON.parse(body) as { method?: unknown; params?: { name?: unknown } };
    return {
      ...(typeof message.method === 'string' ? { rpcMethod: message.method } : {}),
      ...(typeof message.params?.name === 'string' ? { toolName: message.params.name } : {}),
    };
  } catch {
    return {};
  }
}
