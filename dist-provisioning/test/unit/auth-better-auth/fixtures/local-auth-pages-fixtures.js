import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LocalAuthPages, localPagePaths } from '../../../../src/auth-better-auth/local-auth-pages.js';
import { CLIENT_ADDRESS_HEADER } from '../../../../src/http/server.js';
export const publicBaseUrl = 'http://localhost:8080/';
export const publicOrigin = 'http://localhost:8080';
export const issuer = 'http://localhost:8080/api/auth';
export const paths = localPagePaths(publicBaseUrl);
export const clientId = 'native-client-1';
export const clientRedirectUri = 'http://127.0.0.1:33418/callback';
export const sessionCookie = 'better-auth.session_token=session-1.signature; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax';
// The signed query that the provider gives the browser for the sign-in and consent pages.
export const signedQuery = new URLSearchParams([
    ['response_type', 'code'],
    ['client_id', clientId],
    ['redirect_uri', clientRedirectUri],
    ['scope', 'openid profile email'],
    ['state', 'client-state'],
    ['code_challenge', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'],
    ['code_challenge_method', 'S256'],
    ['resource', 'http://localhost:8080/mcp'],
    ['exp', '1760000600'],
    ['ba_iat', '1760000000'],
    ['ba_param', 'client_id'],
    ['ba_param', 'scope'],
    ['sig', 'c2lnbmF0dXJlLW9mLXRoZS1xdWVyeQ'],
]).toString();
// Takes the place of auth.handler: it records each request and answers a route with the configured response.
export class ProviderDouble {
    calls = [];
    answers = new Map();
    handler = async (request) => {
        this.calls.push({
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(request.headers),
            body: request.method === 'POST' ? await request.json() : undefined,
            signal: request.signal,
        });
        const answer = this.answers.get(`${request.method} ${new URL(request.url).pathname}`);
        return answer?.() ?? new Response(null, { status: 404 });
    };
    answer(route, response) {
        this.answers.set(route, response);
        return this;
    }
    pages() {
        return new LocalAuthPages(this.handler, { issuer, paths });
    }
}
export function providerJson(status, body, headers = {}) {
    return () => Response.json(body, { status, headers });
}
// A provider refusal with the text, code, and cookie that a page must not copy.
export function providerRefusal(status, code, headers = {}) {
    return providerJson(status, { code, message: 'Provider message text' }, { ...headers, 'Set-Cookie': 'better-auth.session_token=refused; Path=/' });
}
// A browser request as the HTTP bridge gives it: the public URL and the client address from the socket.
export function browserRequest(target, init = {}) {
    const headers = new Headers(init.headers);
    headers.set(CLIENT_ADDRESS_HEADER, '127.0.0.1');
    return new Request(new URL(target, publicBaseUrl), { ...init, headers });
}
export function formPost(target, fields, headers = {}) {
    const sent = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded', Origin: publicOrigin, 'Sec-Fetch-Site': 'same-origin' });
    for (const [name, value] of Object.entries(headers))
        sent.set(name, value);
    return browserRequest(target, { method: 'POST', headers: sent, body: new URLSearchParams(fields).toString() });
}
const HTML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
// The acceptance browser reads the field with this exact pattern.
export function hiddenOauthQuery(html) {
    const field = /<input type="hidden" name="oauth_query" value="([^"]*)">/.exec(html);
    assert.ok(field, `the page has no hidden oauth_query field:\n${html}`);
    return (field[1] ?? '').replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}
export function tagWith(html, element, attribute) {
    const tag = new RegExp(`<${element}\\b[^>]*\\b${attribute}[^>]*>`).exec(html);
    assert.ok(tag, `the page has no ${element} with ${attribute}:\n${html}`);
    return tag[0];
}
export function assertPageHeaders(response, html) {
    const styles = [...html.matchAll(/<style>([^<]*)<\/style>/g)];
    assert.equal(styles.length, 1, 'the page must have exactly one inline style');
    const styleHash = createHash('sha256').update(styles[0]?.[1] ?? '').digest('base64');
    assert.deepEqual(Object.fromEntries([...response.headers].filter(([name]) => name !== 'allow' && name !== 'retry-after')), {
        'cache-control': 'no-store',
        'content-security-policy': `default-src 'none'; style-src 'sha256-${styleHash}'; base-uri 'none'; frame-ancestors 'none'`,
        'content-type': 'text/html; charset=utf-8',
        'referrer-policy': 'same-origin',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
    });
}
export function assertLoadsNothing(html) {
    assert.doesNotMatch(html, /<(?:script|link|img|iframe|object|embed|base|a)\b|\b(?:src|href)=|url\(|@import|@font-face|https?:\/\//i);
}
// A refused or failed step shows only the page text: no provider text or code, no cookie, and no redirect.
export function assertNothingCopied(response, html, code = 'NO_CODE') {
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(response.headers.get('Location'), null);
    assert.ok(!html.includes('Provider message text'), html);
    assert.ok(!html.includes(code), html);
}
//# sourceMappingURL=local-auth-pages-fixtures.js.map