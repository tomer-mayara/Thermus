import type { RequestContext } from '../auth/access-context.ts';
import type {
  Actor,
  AdministrationRefusal,
  ChangeResult,
  OrganizationAdministration,
} from '../organizations/organization-administration.ts';
import { grantChangeIn, invitationChangeIn, invitationIn, readForm, type FormRefusal } from './account-form.ts';
import { accessDeniedPage, invitationsPage, membersPage, noticePage, seeOther, type NoticeName } from './account-pages.ts';
import type { SignedInBrowserSession } from './browser-session.ts';

export type AdministrationService = Pick<
  OrganizationAdministration,
  'memberOverview' | 'changeGrant' | 'invitationOverview' | 'sendInvitation' | 'resendInvitation' | 'revokeInvitation'
>;

export type AdministrationHandler = (request: Request, session: SignedInBrowserSession, context: RequestContext) => Promise<Response>;

export interface AdministrationRoutesOptions {
  // The public base URL as a directory URL, with a final slash.
  readonly publicBaseUrl: string;
  readonly organizations: AdministrationService;
  readonly organizationsPage: string;
}

// The actor and the organization of one administration request, and the form token of its session.
interface AdministrationScope {
  readonly actor: Actor;
  readonly organizationId: string;
  readonly csrfToken: string;
}

type ScopedRoute = (request: Request, scope: AdministrationScope) => Promise<Response>;

interface ChangeRoute<Fields extends { readonly organizationId: string }> {
  readonly parse: (form: URLSearchParams, csrfToken: string) => Fields | FormRefusal;
  readonly change: (actor: Actor, fields: Fields) => Promise<ChangeResult>;
  // The page that shows the current state after the change.
  readonly page: string;
}

interface AdministrationPaths {
  readonly members: string;
  readonly grants: string;
  readonly invitations: string;
  readonly send: string;
  readonly resend: string;
  readonly revoke: string;
}

const REFUSAL_NOTICES: Readonly<Record<Exclude<ChangeResult, 'applied' | 'unchanged'>, NoticeName>> = {
  denied: 'changeDenied',
  'mfa-required': 'mfaRequired',
  stale: 'changeStale',
  'not-pending': 'invitationNotPending',
  unsupported: 'changeUnsupported',
};

// The member and invitation pages and their changes. Each runs after the account routes resolved current access to the
// organization that the session selected, so that only that organization can be the organization of a request. The
// service then checks the actor and each target again with current reads.
export class AdministrationRoutes {
  private readonly organizations: AdministrationService;
  private readonly publicOrigin: string;
  private readonly organizationsPage: string;
  private readonly paths: AdministrationPaths;
  private readonly routes: ReadonlyMap<string, ScopedRoute>;

  constructor(options: AdministrationRoutesOptions) {
    this.organizations = options.organizations;
    this.organizationsPage = options.organizationsPage;
    this.publicOrigin = new URL(options.publicBaseUrl).origin;
    const pathOf = (relative: string) => new URL(relative, options.publicBaseUrl).pathname;
    this.paths = {
      members: pathOf('members'),
      grants: pathOf('members/grants'),
      invitations: pathOf('invitations'),
      send: pathOf('invitations/send'),
      resend: pathOf('invitations/resend'),
      revoke: pathOf('invitations/revoke'),
    };
    this.routes = new Map<string, ScopedRoute>([
      [this.paths.members, (request, scope) => this.membersPage(request, scope)],
      [this.paths.grants, (request, scope) => this.changeGrant(request, scope)],
      [this.paths.invitations, (request, scope) => this.invitationsPage(request, scope)],
      [this.paths.send, (request, scope) => this.sendInvitation(request, scope)],
      [this.paths.resend, (request, scope) => this.resendInvitation(request, scope)],
      [this.paths.revoke, (request, scope) => this.revokeInvitation(request, scope)],
    ]);
  }

  handlerFor(path: string): AdministrationHandler | undefined {
    const route = this.routes.get(path);
    return route === undefined ? undefined : (request, session, context) => this.withScope(request, { session, context }, route);
  }

  // The organization comes from the decided context, and the MFA evidence from the browser session.
  private async withScope(request: Request, signedIn: { session: SignedInBrowserSession; context: RequestContext }, route: ScopedRoute): Promise<Response> {
    const { session, context } = signedIn;
    if (context.organizationId === undefined) return accessDeniedPage(this.organizationsPage);
    return route(request, { actor: { user: context.user, mfaCompleted: session.mfaCompleted }, organizationId: context.organizationId, csrfToken: session.csrfToken });
  }

  private membersPage(request: Request, scope: AdministrationScope): Promise<Response> {
    return this.page(request, () => this.organizations.memberOverview(scope.actor, scope.organizationId), (overview) => membersPage({
      overview,
      csrfToken: scope.csrfToken,
      grantAction: this.paths.grants,
      invitationsPage: this.paths.invitations,
    }));
  }

  private invitationsPage(request: Request, scope: AdministrationScope): Promise<Response> {
    return this.page(request, () => this.organizations.invitationOverview(scope.actor, scope.organizationId), (overview) => invitationsPage({
      overview,
      csrfToken: scope.csrfToken,
      actions: { send: this.paths.send, resend: this.paths.resend, revoke: this.paths.revoke },
      membersPage: this.paths.members,
    }));
  }

  private changeGrant(request: Request, scope: AdministrationScope): Promise<Response> {
    return this.changeOnPost(request, scope, { parse: grantChangeIn, change: (actor, fields) => this.organizations.changeGrant(actor, fields), page: this.paths.members });
  }

  private sendInvitation(request: Request, scope: AdministrationScope): Promise<Response> {
    return this.changeOnPost(request, scope, { parse: invitationIn, change: (actor, fields) => this.organizations.sendInvitation(actor, fields), page: this.paths.invitations });
  }

  private resendInvitation(request: Request, scope: AdministrationScope): Promise<Response> {
    return this.changeOnPost(request, scope, { parse: invitationChangeIn, change: (actor, fields) => this.organizations.resendInvitation(actor, fields), page: this.paths.invitations });
  }

  private revokeInvitation(request: Request, scope: AdministrationScope): Promise<Response> {
    return this.changeOnPost(request, scope, { parse: invitationChangeIn, change: (actor, fields) => this.organizations.revokeInvitation(actor, fields), page: this.paths.invitations });
  }

  private async page<Overview>(request: Request, read: () => Promise<Overview | AdministrationRefusal>, render: (overview: Overview) => Response): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return noticePage('methodNotAllowed', { Allow: 'GET, HEAD' });
    const overview = await read();
    if (overview === 'denied') return accessDeniedPage(this.organizationsPage);
    if (overview === 'mfa-required') return noticePage('mfaRequired');
    return render(overview as Overview);
  }

  // The origin check comes before the body is read, so that a post from another site causes no work. A form for
  // another organization than the one of the session is out of date: the session switched after the page was shown.
  // The service gets only the fields of the change, without the form token.
  private async changeOnPost<Fields extends { readonly organizationId: string }>(request: Request, scope: AdministrationScope, route: ChangeRoute<Fields>): Promise<Response> {
    if (request.method !== 'POST') return noticePage('methodNotAllowed', { Allow: 'POST' });
    if (request.headers.get('Origin') !== this.publicOrigin) return noticePage('forgedRequest');
    const form = await readForm(request);
    const fields = typeof form === 'string' ? form : route.parse(form, scope.csrfToken);
    if (typeof fields === 'string') return noticePage(fields);
    if (fields.organizationId !== scope.organizationId) return noticePage('changeStale');
    const outcome = await route.change(scope.actor, fields);
    if (outcome === 'applied' || outcome === 'unchanged') return seeOther(new URL(route.page, this.publicOrigin).href);
    return noticePage(REFUSAL_NOTICES[outcome]);
  }
}
