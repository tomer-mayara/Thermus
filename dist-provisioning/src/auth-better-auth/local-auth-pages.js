import { messagePage, signInPage } from './local-auth-page-html.js';
import { browserRedirect, errorCodeOf, ProviderRoutes, retryAfterSeconds, } from './local-auth-provider-routes.js';
const TEXT = {
    startFromClient: 'Start the sign-in from your MCP client.',
    wrongCredentials: 'The email address or password is not correct.',
    accountDisabled: 'This account is disabled. Ask the operator of this Magumagu installation.',
    signInRefused: 'The sign-in request was refused. Start again from your MCP client.',
    tooManySignIns: 'Too many sign-in attempts. Wait and try again.',
    signInInvalid: 'The sign-in request is not valid or has expired. Start again from your MCP client.',
    signInFailed: 'The sign-in failed. Try again later.',
};
export function localPagePaths(publicBaseUrl) {
    const pathOf = (page) => new URL(page, publicBaseUrl).pathname;
    return { signIn: pathOf('sign-in'), consent: pathOf('consent'), authorizationError: pathOf('authorization-error') };
}
export class LocalAuthPages {
    provider;
    paths;
    constructor(provider, settings) {
        this.provider = new ProviderRoutes(provider, settings.issuer);
        this.paths = settings.paths;
    }
    handles(pathname) {
        return Object.values(this.paths).includes(pathname);
    }
    async handle(request) {
        return request.method === 'POST' ? this.signIn(request) : this.showSignIn(request);
    }
    showSignIn(request) {
        const query = new URL(request.url).search.slice(1);
        if (!isSignedAuthorization(new URLSearchParams(query)))
            return messagePage(400, TEXT.startFromClient);
        return signInPage(200, { action: this.paths.signIn, oauthQuery: query });
    }
    async signIn(request) {
        const credentials = signInCredentials(new URLSearchParams(await request.text()));
        if (credentials === undefined)
            return messagePage(400, TEXT.signInInvalid);
        return this.signInResult(await this.provider.signIn(request, credentials), credentials);
    }
    async signInResult(response, credentials) {
        switch (response.status) {
            case 200: return (await browserRedirect(response)) ?? messagePage(500, TEXT.signInFailed);
            case 400: return messagePage(400, TEXT.signInInvalid);
            case 401: return signInPage(401, { action: this.paths.signIn, oauthQuery: credentials.oauth_query, email: credentials.email, message: TEXT.wrongCredentials });
            case 403: return messagePage(403, (await errorCodeOf(response)) === 'BANNED_USER' ? TEXT.accountDisabled : TEXT.signInRefused);
            case 429: return messagePage(429, TEXT.tooManySignIns, { 'Retry-After': retryAfterSeconds(response) });
            default: return messagePage(500, TEXT.signInFailed);
        }
    }
}
// The provider signs the authorization query that it gives the browser for the sign-in and consent pages.
function isSignedAuthorization(query) {
    return Boolean(query.get('sig')) && Boolean(query.get('client_id'));
}
function hasSignature(oauthQuery) {
    return Boolean(new URLSearchParams(oauthQuery).get('sig'));
}
function signInCredentials(form) {
    const credentials = { email: form.get('email') ?? '', password: form.get('password') ?? '', oauth_query: form.get('oauth_query') ?? '' };
    return credentials.email && credentials.password && hasSignature(credentials.oauth_query) ? credentials : undefined;
}
//# sourceMappingURL=local-auth-pages.js.map