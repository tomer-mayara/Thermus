import type { AccessResolver, RequestContext } from '../auth/access-context.ts';
import { accessDeniedPage, authenticationUnavailablePage, notFoundPage, signInRequiredPage } from './account-pages.ts';
import type { BrowserSession } from './browser-session.ts';

// One protected account, organization, or billing operation. It gets only a request whose current access is
// allowed, with the trusted context of that request, and checks its own permission before work starts.
export type AccountOperation = (request: Request, context: RequestContext) => Promise<Response>;

export interface HostedAccountRoutesOptions {
  readonly session: BrowserSession;
  readonly accessResolver: AccessResolver;
  readonly operation?: AccountOperation;
}

// The browser paths of the hosted edition. Each request needs a verified browser session and current access
// before an operation gets it. Form fields, queries, and other headers cannot choose the user or the organization.
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
    const session = await this.session.authenticate(request);
    if (session.status === 'unavailable') return authenticationUnavailablePage();
    if (session.status === 'signed-out') return signInRequiredPage();
    const decision = await this.accessResolver.resolve(session.user);
    if (decision.allowed !== true) return accessDeniedPage();
    const context = requireTrustedTenant(decision.context);
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
