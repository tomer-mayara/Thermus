import { signupClosedPage, signupFailurePage } from './workos-signup-pages.ts';

/** The place under the free-tenant cap for a new organization. unavailable: the registry cannot say. */
export type SignupPlace = 'open' | 'full' | 'unavailable';

/** The result of the tenant request of a new organization (SO-04). */
export type SignupTenantRequest = 'requested' | 'present' | 'full' | 'unavailable';

/** The tenant registry as signup needs it (SO-07). App composes this port on the tenants owner, so web imports no registry module. */
export interface SignupTenants {
  /** Whether the free-tenant cap has a place for a new organization. Signup asks before the notice. */
  place(): Promise<SignupPlace>;
  /** Requests the tenant of a new organization after its confirmed first Admin membership. */
  request(organizationId: string): Promise<SignupTenantRequest>;
}

/** One provider operation of a signup request. It stops at the abort of the request; a POST holds its slot until it settles. */
export type RequestOperation = <T>(start: () => Promise<T>) => Promise<T>;

const CAP_UNREADABLE = 'Hosted signup could not read the free-tenant cap.';
const TENANT_NOT_REQUESTED = 'Hosted signup could not request the tenant of the new organization. Its first workspace status read requests it again.';

/**
 * The handoff of signup to the tenant of a new organization (plan section 4.2): the free-tenant cap after the switch
 * and before the notice, and the tenant request after the confirmed first Admin membership.
 */
export class SignupTenantHandoff {
  /** The port that app composes on the tenants owner. */
  private readonly tenants: SignupTenants;
  /** One fixed error line for the operator; it holds no request value. */
  private readonly reportFailure: (message: string) => void;

  constructor(tenants: SignupTenants, reportFailure: (message: string) => void) {
    this.tenants = tenants;
    this.reportFailure = reportFailure;
  }

  /**
   * At a full cap, signup is closed as with the switch off: 200 for GET and HEAD, 403 for a POST. A cap that the
   * registry cannot read stops the request. With a free place, the answer is undefined.
   */
  async closedAnswer(request: Request, run: RequestOperation): Promise<Response | undefined> {
    const place = await run(() => this.tenants.place()).catch((error: unknown) => {
      if (request.signal.aborted) throw error;
      return 'unavailable' as const;
    });
    if (place === 'full') return signupClosedPage(request.method === 'POST' ? 403 : 200);
    if (place === 'open') return undefined;
    this.reportFailure(CAP_UNREADABLE);
    return signupFailurePage(503, 'Activation is temporarily unavailable. Try again later.');
  }

  /** A failed request does not stop signup: the first workspace status read of the organization requests the tenant again. */
  async requestTenant(request: Request, organizationId: string, run: RequestOperation): Promise<void> {
    const result = await run(() => this.tenants.request(organizationId)).catch((error: unknown) => {
      if (request.signal.aborted) throw error;
      return 'unavailable' as const;
    });
    request.signal.throwIfAborted();
    if (result === 'unavailable') this.reportFailure(TENANT_NOT_REQUESTED);
  }
}
