import type { BetterAuthProviderSettings } from '../../../../src/accounts/providers/better-auth/better-auth-provider.ts';
import type { LocalAuth } from '../../../../src/accounts/providers/better-auth/better-auth-runtime.ts';
import { localIssuer, mcpResourceUrl, type PublicSigningKey } from './local-access-tokens.ts';

export const installationId = '0f6c1e9a-4b7d-4e2a-9c35-8d1f2a6b7e40';

export const localSettings: BetterAuthProviderSettings = {
  issuer: localIssuer,
  mcpResourceUrl,
  installationId,
  resourceServerClient: { clientId: 'resource-server', clientSecret: 'resource-server-secret' },
};

export interface StoredAccount {
  readonly name?: string;
  readonly id: string;
  readonly banned: boolean | null;
}

export interface ReceivedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
  readonly form: URLSearchParams;
}

export type ProviderOperation = 'getJwks' | 'findUserById';

interface Answer {
  readonly status: number;
  readonly body: string;
}

export class TokenProviderDouble {
  keySet: unknown;
  readonly accounts = new Map<string, StoredAccount>();
  readonly calls: string[] = [];
  readonly requests: ReceivedRequest[] = [];
  readonly failures = new Map<ProviderOperation, Error>();
  readonly auth: LocalAuth;
  private answer: Answer = { status: 200, body: JSON.stringify({ active: true, token_type: 'Bearer' }) };

  constructor(...keys: PublicSigningKey[]) {
    this.keySet = { keys };
    this.auth = {
      handler: (request: Request) => this.handle(request),
      api: { getJwks: async () => this.readKeySet() },
      $context: Promise.resolve({
        internalAdapter: { findUserById: async (userId: string) => this.findUserById(userId) },
      }),
    } as unknown as LocalAuth;
  }

  answerIntrospection(status: number, body: unknown): void {
    this.answer = { status, body: typeof body === 'string' ? body : JSON.stringify(body) };
  }

  private async handle(request: Request): Promise<Response> {
    this.calls.push(`handler ${request.method} ${request.url}`);
    this.requests.push({ method: request.method, url: request.url, headers: request.headers, form: new URLSearchParams(await request.text()) });
    return new Response(this.answer.body, { status: this.answer.status, headers: { 'Content-Type': 'application/json' } });
  }

  private async readKeySet(): Promise<unknown> {
    this.record('getJwks');
    return structuredClone(this.keySet);
  }

  private async findUserById(userId: string): Promise<StoredAccount | null> {
    this.record('findUserById', userId);
    const account = this.accounts.get(userId);
    return account === undefined ? null : { ...account };
  }

  private record(operation: ProviderOperation, ...details: string[]): void {
    this.calls.push([operation, ...details].join(' '));
    const failure = this.failures.get(operation);
    if (failure) throw failure;
  }
}
