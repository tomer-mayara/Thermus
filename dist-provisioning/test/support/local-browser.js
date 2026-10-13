import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { publicBaseUrl } from './better-auth-local.js';
const MAX_STEPS = 6;
const HTML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
// A browser on the operator's machine. It reaches the server at its listen address, but each URL and
// Origin it shows the server uses the public base URL, as a browser behind a reverse proxy does.
// node:http keeps the Sec-Fetch headers exactly as written; fetch() replaces Sec-Fetch-Mode.
export class LocalBrowser {
    cookies = new Map();
    server;
    constructor(server) {
        this.server = server;
    }
    async navigate(url, site = 'none') {
        return this.send({ method: 'GET', url: publicUrl(url), headers: { 'Sec-Fetch-Site': site, 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' } });
    }
    async post(url, fields, options = {}) {
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Sec-Fetch-Site': options.site ?? 'same-origin',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Dest': 'document',
        };
        if (options.origin !== null)
            headers.Origin = options.origin ?? publicBaseUrl;
        return this.send({ method: 'POST', url: publicUrl(url), headers, body: new URLSearchParams(fields).toString() });
    }
    // Opens the authorization URL without a browser session and reads the sign-in page that the provider sends it to.
    async openSignIn(authorizationUrl) {
        const redirect = await this.navigate(authorizationUrl);
        assert.equal(redirect.location?.pathname, '/sign-in', `the authorization did not ask for a sign-in: ${redirect.status} ${redirect.body}`);
        const page = await this.navigate(redirect.location, 'same-origin');
        assert.equal(page.status, 200, page.body);
        return { url: redirect.location, oauthQuery: hiddenField(page.body, 'oauth_query') };
    }
    // Follows the provider and the bundled pages until the provider sends the browser to the client's redirect URI.
    async authorize(authorizationUrl, account) {
        const pages = [];
        let response = await this.navigate(authorizationUrl);
        for (let step = 0; step < MAX_STEPS; step += 1) {
            const next = response.location;
            assert.ok(next, `the authorization stopped with ${response.status}: ${response.body}`);
            if (next.origin !== publicBaseUrl)
                return { callback: next, pages };
            const page = await this.navigate(next, 'same-origin');
            assert.equal(page.status, 200, page.body);
            pages.push(next.pathname);
            response = await this.answer(next, page, account);
        }
        assert.fail('the authorization did not reach the client redirect URI');
    }
    async answer(url, page, account) {
        const oauthQuery = hiddenField(page.body, 'oauth_query');
        if (url.pathname === '/sign-in') {
            assert.ok(account, 'the provider asked for a sign-in, but the test gave no account');
            return this.post(url, { email: account.email, password: account.password, oauth_query: oauthQuery });
        }
        assert.equal(url.pathname, '/consent', `unexpected page ${url.pathname}`);
        return this.post(url, { accept: 'yes', oauth_query: oauthQuery });
    }
    send({ method, url, headers, body }) {
        if (this.cookies.size > 0)
            headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
        if (body !== undefined)
            headers['Content-Length'] = String(Buffer.byteLength(body));
        const server = this.server();
        return new Promise((resolve, reject) => {
            const outgoing = httpRequest({
                host: server.hostname,
                port: server.port,
                method,
                path: `${url.pathname}${url.search}`,
                headers: { ...headers, Host: url.host },
            }, (incoming) => {
                let text = '';
                incoming.setEncoding('utf8').on('data', (chunk) => { text += chunk; }).on('error', reject).on('end', () => {
                    this.keepCookies(incoming.headers['set-cookie'] ?? []);
                    const location = incoming.headers.location;
                    resolve({
                        status: incoming.statusCode ?? 0,
                        headers: incoming.headers,
                        body: text,
                        ...(location === undefined ? {} : { location: new URL(location, publicBaseUrl) }),
                    });
                });
            });
            outgoing.on('error', reject);
            outgoing.end(body);
        });
    }
    keepCookies(lines) {
        for (const line of lines) {
            const [pair = ''] = line.split(';');
            const separator = pair.indexOf('=');
            const name = pair.slice(0, separator).trim();
            const value = pair.slice(separator + 1).trim();
            if (value === '' || /max-age=0/i.test(line))
                this.cookies.delete(name);
            else
                this.cookies.set(name, value);
        }
    }
}
export function hiddenField(html, name) {
    const field = new RegExp(`<input type="hidden" name="${name}" value="([^"]*)">`).exec(html);
    assert.ok(field, `the page has no hidden ${name} field:\n${html}`);
    return decodeHtml(field[1] ?? '');
}
// The pages escape five characters in text and attribute values; this decodes only those.
export function decodeHtml(text) {
    return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}
function publicUrl(url) {
    const parsed = new URL(url, publicBaseUrl);
    assert.equal(parsed.origin, publicBaseUrl, `the browser opens only the server: ${parsed.href}`);
    return parsed;
}
// The MCP client reaches the server at its listen address and keeps the public URLs that the server gives it.
export function serverFetch(server) {
    return async (url, init) => {
        const target = new URL(url);
        if (target.origin === publicBaseUrl) {
            const address = server();
            target.protocol = address.protocol;
            target.host = address.host;
        }
        return fetch(target, init);
    };
}
//# sourceMappingURL=local-browser.js.map