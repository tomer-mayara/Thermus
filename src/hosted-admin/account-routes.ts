import type { AccessResolver, RequestContext } from '../auth/access-context.ts';
import { accessDeniedPage, authenticationUnavailablePage, notFoundPage, signInRequiredPage } from './account-pages.ts';
import type { BrowserSession } from './browser-session.ts';

// The routes check the session and current access, but not the permission of an operation: each operation checks
// its own permission before work starts.
export type AccountOperation = (request: Request, context: RequestContext) => Promise<Response>;

export interface HostedAccountRoutesOptions {
  readonly session: BrowserSession;
  readonly accessResolver: AccessResolver;
  readonly operation?: AccountOperation;
}

export class HostedAccountRoutes {
  private readonly session: BrowserSession;
  private readonly accessResolver: AccessResolver;
  private readonly operation?: AccountOperation;

  constructor(options: HostedAccountRoutesOptions) {
    this.session = options.session;
    this.accessResolver = options.accessResolver;
    this.operation = options.operation;
  }

  async handle(request: Request): Promise<Response> {
    const session = await this.session.authenticate(request.headers.get('Cookie'));
    if (session.status === 'unavailable') return authenticationUnavailablePage();
    if (session.status === 'signed-out') return signInRequiredPage();
    const decision = await this.accessResolver.resolve(session.user);
    if (decision.allowed !== true) return accessDeniedPage();
    const context = requireTrustedTenant(frozenCopy(decision.context));
    if (this.operation === undefined) return notFoundPage();
    return this.operation(request, context);
  }
}

function requireTrustedTenant(context: RequestContext): RequestContext {
  if (typeof context.tenantId !== 'string' || context.tenantId === '') {
    throw new Error('The access decision has no trusted tenant');
  }
  return context;
}

// The copy keeps later changes to the resolver's records out of a running operation.
function frozenCopy<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
