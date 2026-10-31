import type { RequestContext } from '../../../accounts/identity/access-context.ts';
import { UnconfirmedChangeError, type ChangeOutcome, type ChangeResult } from '../../../accounts/organizations/change-records.ts';
import type { AuditLog, AdministrationChange } from '../../../logs/audit/audit-log.ts';
import type {
  Actor,
  AdministrationRefusal,
  OrganizationAdministration,
  InvitationSendRequest,
  InvitationChangeRequest,
  MemberRemovalRequest,
  RemovalResult,
} from '../../../accounts/organizations/organization-administration.ts';
import { invitationChangeIn, invitationIn, memberRemovalIn, readForm, type FormRefusal } from './account-form.ts';
import { accessDeniedPage, changeResultPage, noticePage, removalResultPage, seeOther, unconfirmedInvitationPage } from './account-pages.ts';
import { billingPage, membersPage } from './administration-pages.ts';
import type { SignedInBrowserSession } from '../../../accounts/identity/browser-session.ts';

export type AdministrationService = Pick<
  OrganizationAdministration,
  'memberOverview' | 'invitationOverview' | 'sendInvitation' | 'resendInvitation' | 'revokeInvitation' | 'removeMember' | 'billingState'
>;

export type AdministrationHandler = (request: Request, session: SignedInBrowserSession, context: RequestContext) => Promise<Response>;

export interface AdministrationRoutesOptions {
  // The public base URL as a directory URL, with a final slash.
  readonly publicBaseUrl: string;
  readonly organizations: AdministrationService;
  readonly organizationsPage: string;
  readonly audit?: Pick<AuditLog, 'administrationChanged'>;
}

interface AdministrationScope {
  readonly actor: Actor;
  readonly organizationId: string;
  readonly csrfToken: string;
  readonly tenantId: string;
}

type ScopedRoute = (request: Request, scope: AdministrationScope) => Promise<Response>;

type AuditedChange = { readonly action: AdministrationChange['action']; readonly fields: InvitationSendRequest | InvitationChangeRequest | MemberRemovalRequest };

interface ChangeRoute<Fields extends { readonly organizationId: string }> {
  readonly action: AdministrationChange['action'];
  readonly parse: (form: URLSearchParams, csrfToken: string) => Fields | FormRefusal;
  readonly change: (actor: Actor, fields: Fields) => Promise<ChangeResult>;
}

interface AdministrationPaths {
  readonly product: string;
  readonly members: string;
  readonly invitations: string;
  readonly send: string;
  readonly resend: string;
  readonly revoke: string;
  readonly remove: string;
  readonly login: string;
  readonly billing: string;
  readonly logging: string;
}

// The member, invitation, and billing pages, and the member and invitation changes. Each runs after the account routes
// resolved current access to the organization that the session selected, so that only that organization can be the
// organization of a request. The service then checks the actor and each target again with current reads.
export class AdministrationRoutes {
  private readonly organizations: AdministrationService;
  private readonly publicOrigin: string;
  private readonly organizationsPage: string;
  private readonly paths: AdministrationPaths;
  private readonly routes: ReadonlyMap<string, ScopedRoute>;
  private readonly audit?: Pick<AuditLog, 'administrationChanged'>;

  constructor(options: AdministrationRoutesOptions) {
    this.organizations = options.organizations;
    this.audit = options.audit;
    this.organizationsPage = options.organizationsPage;
    this.publicOrigin = new URL(options.publicBaseUrl).origin;
    this.paths = administrationPaths(options.publicBaseUrl, this.organizationsPage);
    this.routes = new Map<string, ScopedRoute>([
      [this.paths.members, (request, scope) => this.membersPage(request, scope)],
      [this.paths.invitations, (request, scope) => this.invitationsPage(request, scope)],
      [this.paths.send, this.changeRoute({ action: 'invite', parse: invitationIn, change: (actor, fields) => this.organizations.sendInvitation(actor, fields) })],
      [this.paths.resend, this.changeRoute({ action: 'resend-invitation', parse: invitationChangeIn, change: (actor, fields) => this.organizations.resendInvitation(actor, fields) })],
      [this.paths.revoke, this.changeRoute({ action: 'revoke-invitation', parse: invitationChangeIn, change: (actor, fields) => this.organizations.revokeInvitation(actor, fields) })],
      [this.paths.remove, (request, scope) => this.removeMember(request, scope)],
      [this.paths.billing, (request, scope) => this.billingPage(request, scope)],
    ]);
  }

  handlerFor(path: string): AdministrationHandler | undefined {
    const route = this.routes.get(path);
    return route === undefined ? undefined : (request, session, context) => this.withScope(request, { session, context }, route);
  }

  private async withScope(request: Request, { session, context }: { session: SignedInBrowserSession; context: RequestContext }, route: ScopedRoute): Promise<Response> {
    if (context.organizationId === undefined) return accessDeniedPage(this.organizationsPage);
    return route(request, { actor: { user: context.user }, tenantId: context.tenantId, organizationId: context.organizationId, csrfToken: session.csrfToken });
  }

  private membersPage(request: Request, scope: AdministrationScope): Promise<Response> {
    return this.page(request, async () => {
      const members = await this.organizations.memberOverview(scope.actor, scope.organizationId);
      if (typeof members === 'string') return members;
      const invitations = await this.organizations.invitationOverview(scope.actor, scope.organizationId);
      return typeof invitations === 'string' ? invitations : { members, invitations };
    }, (overview) => membersPage({
      ...overview, subject: scope.actor.user.subject, csrfToken: scope.csrfToken,
      actions: { send: this.paths.send, resend: this.paths.resend, revoke: this.paths.revoke, remove: this.paths.remove },
      navigation: { product: this.paths.product, members: this.paths.members, organizations: this.organizationsPage, logging: this.paths.logging, quickStart: new URL('quick-start', this.publicOrigin + this.paths.product).pathname },
    }));
  }

  private invitationsPage(request: Request, scope: AdministrationScope): Promise<Response> {
    return this.page(request, () => this.organizations.memberOverview(scope.actor, scope.organizationId), () => seeOther(new URL(this.paths.members, this.publicOrigin).href));
  }

  private billingPage(request: Request, scope: AdministrationScope): Promise<Response> {
    return this.page(request, () => this.organizations.billingState(scope.actor, scope.organizationId), (state) => billingPage(state));
  }

  private async removeMember(request: Request, scope: AdministrationScope): Promise<Response> {
    const fields = await this.postedFields(request, (form) => memberRemovalIn(form, scope.csrfToken));
    if (fields instanceof Response) return fields;
    let outcome: RemovalResult = 'stale';
    if (fields.organizationId === scope.organizationId) {
      try { outcome = await this.organizations.removeMember(scope.actor, fields); }
      catch { outcome = 'unknown'; }
    }
    this.keep(scope, { action: 'remove-member', fields }, outcome);
    return removalResultPage(outcome, { ...this.paths, organizations: this.organizationsPage });
  }

  private async page<Overview extends object>(request: Request, read: () => Promise<Overview | AdministrationRefusal>, render: (overview: Overview) => Response): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return noticePage('methodNotAllowed', { Allow: 'GET, HEAD' });
    const overview = await read();
    if (typeof overview !== 'string') return render(overview);
    return accessDeniedPage(this.organizationsPage);
  }

  private changeRoute<Fields extends InvitationSendRequest | InvitationChangeRequest>(route: ChangeRoute<Fields>): ScopedRoute {
    return (request, scope) => this.changeOnPost(request, scope, route);
  }

  // A form for another organization than the one of the session is out of date: the session switched after the page
  // was shown. The service gets only the fields of the change, without the form token.
  private async changeOnPost<Fields extends InvitationSendRequest | InvitationChangeRequest>(request: Request, scope: AdministrationScope, route: ChangeRoute<Fields>): Promise<Response> {
    const fields = await this.postedFields(request, (form) => route.parse(form, scope.csrfToken));
    if (fields instanceof Response) return fields;
    const change = { action: route.action, fields };
    if (fields.organizationId !== scope.organizationId) {
      this.keep(scope, change, 'stale');
      return noticePage('changeStale');
    }
    let outcome: ChangeResult;
    try {
      outcome = await route.change(scope.actor, fields);
    } catch (cause) {
      return this.failedChange(scope, change, cause);
    }
    this.keep(scope, change, outcome);
    return changeResultPage(outcome, new URL(this.paths.members, this.publicOrigin).href);
  }

  private failedChange(scope: AdministrationScope, change: AuditedChange, cause: unknown): Response {
    const unconfirmed = cause instanceof UnconfirmedChangeError;
    this.keep(scope, change, unconfirmed ? 'unknown' : 'failed');
    if (unconfirmed) return unconfirmedInvitationPage(this.paths.members);
    throw cause;
  }

  // The origin check comes before the body is read, so that the service reads no form and gets no change from another
  // site.
  private async postedFields<Fields extends object>(request: Request, parse: (form: URLSearchParams) => Fields | FormRefusal): Promise<Fields | Response> {
    if (request.method !== 'POST') return noticePage('methodNotAllowed', { Allow: 'POST' });
    if (request.headers.get('Origin') !== this.publicOrigin) return noticePage('forgedRequest');
    const form = await readForm(request);
    const fields = typeof form === 'string' ? form : parse(form);
    return typeof fields === 'string' ? noticePage(fields) : fields;
  }

  private keep(scope: AdministrationScope, { action, fields }: AuditedChange, outcome: ChangeOutcome): void {
    try {
      this.audit?.administrationChanged({
        timestamp: new Date().toISOString(), organizationId: scope.tenantId, actor: scope.actor.user, action, outcome,
        target: 'email' in fields ? { email: fields.email } : 'invitationId' in fields ? { invitationId: fields.invitationId } : { membershipId: fields.membershipId },
        ...('role' in fields && (fields.role === 'user' || fields.role === 'admin') ? { role: fields.role } : {}),
      });
    } catch {
      // Capture failure must not replace a completed action or cause its write to run again.
    }
  }
}

function administrationPaths(publicBaseUrl: string, organizationsPage: string): AdministrationPaths {
  const pathOf = (relative: string) => new URL(relative, publicBaseUrl).pathname;
  const login = new URL('login', publicBaseUrl);
  login.searchParams.set('return_to', organizationsPage);
  return {
    product: pathOf(''),
    members: pathOf('members'),
    invitations: pathOf('invitations'),
    send: pathOf('invitations/send'),
    resend: pathOf('invitations/resend'),
    revoke: pathOf('invitations/revoke'),
    remove: pathOf('members/remove'),
    login: login.pathname + login.search,
    billing: pathOf('billing'),
    logging: pathOf('logging'),
  };
}
