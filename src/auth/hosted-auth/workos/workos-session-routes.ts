import { waitForRequest } from '../../../http/request-cancellation.ts';
import { sameSecret } from './session-cookies.ts';
import { readSignOutForm } from './sign-out-form.ts';
import type { WorkOSBrowserSession, WorkOSSignedInSession } from './workos-browser-session.ts';
import { jsonAnswer, noticePage, seeOther, signInNotice } from './workos-session-pages.ts';

export type SessionRoutesSession = Pick<WorkOSBrowserSession, 'authenticate' | 'startSignIn' | 'completeSignIn' | 'endSession' | 'csrfTokenOf'>;

export interface SessionRouteFailure {
  readonly path: string;
  readonly cause: unknown;
}

export interface WorkOSSessionRoutesOptions {
  readonly session: SessionRoutesSession;
  readonly publicBaseUrl: string;
  readonly redirectUri: string;
  readonly reportFailure: (report: SessionRouteFailure) => void;
}

interface RoutePaths {
  readonly base: string;
  readonly login: string;
  readonly callback: string;
  readonly session: string;
}

type Route = (request: Request) => Promise<Response>;

const READ_METHODS = 'GET, HEAD';
const RETURN_PATH_LIMIT = 1_024;
// Path characters of RFC 3986. A query, a fragment, a backslash, a space, and a control character are not path
// characters, and a second slash at the start would name another host.
const RETURN_PATH = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/;

// The browser routes of the WorkOS provider: the sign-in, its callback, the sign-out, and the session of the portal.
// They need no signed-in session, so the composition routes them before the account routes. An unexpected failure,
// such as a WorkOS outage, changes no cookie, so that it cannot erase a session that can recover.
export class WorkOSSessionRoutes {
  private readonly session: SessionRoutesSession;
  private readonly reportFailure: (report: SessionRouteFailure) => void;
  private readonly publicBaseUrl: string;
  private readonly publicOrigin: string;
  private readonly paths: RoutePaths;
  private readonly routes: ReadonlyMap<string, Route>;

  constructor(options: WorkOSSessionRoutesOptions) {
    this.session = options.session;
    this.reportFailure = options.reportFailure;
    this.publicBaseUrl = directoryUrl(options.publicBaseUrl);
    this.publicOrigin = new URL(this.publicBaseUrl).origin;
    const pathOf = (relative: string): string => new URL(relative, this.publicBaseUrl).pathname;
    this.paths = { base: pathOf('./'), login: pathOf('login'), callback: new URL(options.redirectUri).pathname, session: pathOf('session') };
    this.routes = new Map<string, Route>([
      [this.paths.login, (request) => this.signIn(request)],
      [this.paths.callback, (request) => this.callback(request)],
      [pathOf('logout'), (request) => this.signOut(request)],
      [this.paths.session, (request) => this.portalSession(request)],
    ]);
  }

  handles(pathname: string): boolean {
    return this.routes.has(pathname);
  }

  async handle(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const route = this.routes.get(path);
    if (route === undefined) return noticePage('notFound');
    try {
      return await waitForRequest(request.signal, () => route(request));
    } catch (cause) {
      if (request.signal.aborted) throw cause;
      this.reportFailure({ path, cause });
      return path === this.paths.session ? jsonAnswer(500, { error: 'unavailable' }) : noticePage('requestFailed');
    }
  }

  // AuthKit also opens this path for a sign-in that starts at AuthKit. Then it has no return path.
  private async signIn(request: Request): Promise<Response> {
    if (!isRead(request)) return noticePage('methodNotAllowed', { Allow: READ_METHODS });
    const returnPaths = new URL(request.url).searchParams.getAll('return_to');
    const returnTo = returnPaths.length === 0 ? this.paths.base : this.returnPath(single(returnPaths));
    if (returnTo === undefined) return signInNotice('signInInvalid', this.paths.login);
    const start = await this.session.startSignIn({ returnTo });
    return seeOther(start.url, start.cookies);
  }

  // The sign-in checked the return path, and the sealed sign-in cookie kept it. The check here only guards the redirect.
  private async callback(request: Request): Promise<Response> {
    if (!isRead(request)) return noticePage('methodNotAllowed', { Allow: READ_METHODS });
    const query = new URL(request.url).searchParams;
    const completion = await this.session.completeSignIn({ query, cookieHeader: request.headers.get('Cookie') });
    if (completion.status === 'refused') return signInNotice('signInFailed', this.paths.login, completion.cookies);
    const returnTo = this.returnPath(completion.returnTo) ?? this.paths.base;
    return seeOther(new URL(returnTo, this.publicOrigin).href, completion.cookies);
  }

  // The origin check comes before the body is read, so that a post from another site causes no work. A browser without
  // a usable session only loses its cookie, so that request needs no token.
  private async signOut(request: Request): Promise<Response> {
    if (request.method !== 'POST') return noticePage('methodNotAllowed', { Allow: 'POST' });
    if (request.headers.get('Origin') !== this.publicOrigin) return noticePage('forgedRequest');
    const form = await readSignOutForm(request);
    if ('refusal' in form) return noticePage(form.refusal);
    request.signal.throwIfAborted();
    const cookieHeader = request.headers.get('Cookie');
    const sessionToken = this.session.csrfTokenOf(cookieHeader);
    if (sessionToken !== undefined && !sameSecret(form.csrfToken, sessionToken)) return noticePage('forgedRequest');
    const end = await this.session.endSession(cookieHeader);
    return seeOther(end.logoutUrl ?? this.publicBaseUrl, end.cookies);
  }

  // The profile and the organization are display data for the portal. They never give access.
  private async portalSession(request: Request): Promise<Response> {
    if (!isRead(request)) return jsonAnswer(405, { error: 'method-not-allowed' }, { headers: { Allow: READ_METHODS } });
    const state = await this.session.authenticate(request.headers.get('Cookie'));
    if (state.status !== 'signed-in') return jsonAnswer(401, { signedIn: false }, { cookies: state.cookies });
    return jsonAnswer(200, portalView(state), { cookies: state.cookies });
  }

  // A return path is a page under the public path, so that the redirect after the sign-in goes only to a page of this
  // service. The URL parser must keep it unchanged, which refuses dot segments. The sign-in paths would start a loop.
  private returnPath(value: string | undefined): string | undefined {
    if (value === undefined || value.length > RETURN_PATH_LIMIT || !RETURN_PATH.test(value) || !value.startsWith(this.paths.base)) return undefined;
    if (value === this.paths.login || value === this.paths.callback) return undefined;
    return new URL(value, this.publicOrigin).pathname === value ? value : undefined;
  }
}

function portalView(session: WorkOSSignedInSession): object {
  const { email, firstName, lastName } = session.profile;
  const name = [firstName, lastName].filter((part) => part !== undefined && part !== '').join(' ');
  const organizationId = session.user.selectedOrganizationId;
  return {
    signedIn: true,
    email,
    ...(name === '' ? {} : { name }),
    ...(organizationId === undefined ? {} : { organizationId }),
    mfaCompleted: session.mfaCompleted,
    csrfToken: session.csrfToken,
  };
}

// The paths of the routes are relative to the public base URL, so it must name a directory.
function directoryUrl(publicBaseUrl: string): string {
  const url = new URL(publicBaseUrl);
  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
  return url.href;
}

function isRead(request: Request): boolean {
  return request.method === 'GET' || request.method === 'HEAD';
}

function single(values: readonly string[]): string | undefined {
  return values.length === 1 ? values[0] : undefined;
}

