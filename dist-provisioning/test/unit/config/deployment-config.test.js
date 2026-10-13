import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeploymentConfigError, loadDeploymentConfig } from '../../../src/config/deployment-config.js';
const apiKey = 'workos-api-key-placeholder';
const cookiePassword = 'cookie-password-placeholder-0032';
const valid = {
    'self-hosted': { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: 'https://magumagu.example', DATA_DIR: '/var/lib/magumagu' },
    hosted: {
        DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://magumagu.example', WORKOS_AUTHKIT_ISSUER: 'https://magumagu-test.authkit.app',
        WORKOS_CLIENT_ID: 'client_placeholder', WORKOS_API_KEY: apiKey, WORKOS_COOKIE_PASSWORD: cookiePassword,
        WORKOS_REDIRECT_URI: 'https://magumagu.example/auth/callback',
    },
};
const valueSettings = Object.keys({ ...valid['self-hosted'], ...valid.hosted }).filter((name) => name !== 'DEPLOYMENT');
const rootUrls = { publicBaseUrl: 'https://magumagu.example/', mcpResourceUrl: 'https://magumagu.example/mcp',
    resourceMetadataUrl: 'https://magumagu.example/.well-known/oauth-protected-resource/mcp' };
function environment(edition, overrides = {}) {
    return { ...valid[edition], ...overrides };
}
function load(edition, overrides = {}) {
    return loadDeploymentConfig(environment(edition, overrides), 'http');
}
function assignments(settings) {
    return Object.entries(settings).map(([name, value]) => `${name}=${value ?? '(missing)'}`).join(' and ');
}
function rejectionMessage(settings, transport = 'http') {
    let message = '';
    assert.throws(() => loadDeploymentConfig(settings, transport), (error) => {
        assert.ok(error instanceof DeploymentConfigError, `Expected a DeploymentConfigError, got ${String(error)}`);
        message = error.message;
        return true;
    });
    const leaked = valueSettings.map((name) => settings[name] ?? '').filter((value) => value !== '' && message.includes(value));
    assert.deepEqual(leaked, [], 'The message must not contain a setting value.');
    return message;
}
test('Given a valid self-hosted environment, when it loads for HTTP, then it returns the derived URLs and the data directory', () => {
    assert.deepEqual(load('self-hosted'), { deployment: 'self-hosted', ...rootUrls, dataDirectory: '/var/lib/magumagu' });
});
test('Given a valid hosted environment, when it loads for HTTP, then it returns the derived URLs and the WorkOS settings', () => {
    const workos = { authkitIssuer: 'https://magumagu-test.authkit.app', clientId: 'client_placeholder', apiKey, redirectUri: 'https://magumagu.example/auth/callback', cookiePassword };
    assert.deepEqual(load('hosted'), { deployment: 'hosted', ...rootUrls, workos });
});
const derivedUrls = [
    ['self-hosted', 'http://localhost:8080', 'http://localhost:8080/', 'http://localhost:8080/mcp', 'http://localhost:8080/.well-known/oauth-protected-resource/mcp'],
    ['self-hosted', 'http://127.0.0.1:8080', 'http://127.0.0.1:8080/', 'http://127.0.0.1:8080/mcp', 'http://127.0.0.1:8080/.well-known/oauth-protected-resource/mcp'],
    ['self-hosted', 'http://[::1]:8080', 'http://[::1]:8080/', 'http://[::1]:8080/mcp', 'http://[::1]:8080/.well-known/oauth-protected-resource/mcp'],
    ['self-hosted', 'https://example.com/app', 'https://example.com/app/', 'https://example.com/app/mcp', 'https://example.com/.well-known/oauth-protected-resource/app/mcp'],
    ['hosted', 'https://example.com/app', 'https://example.com/app/', 'https://example.com/app/mcp', 'https://example.com/.well-known/oauth-protected-resource/app/mcp'],
    ['hosted', 'https://example.com/app/', 'https://example.com/app/', 'https://example.com/app/mcp', 'https://example.com/.well-known/oauth-protected-resource/app/mcp'],
];
for (const [edition, base, publicBaseUrl, mcpResourceUrl, resourceMetadataUrl] of derivedUrls) {
    test(`Given a ${edition} PUBLIC_BASE_URL of ${base}, when it loads, then it derives the exact MCP resource and metadata URLs`, () => {
        const config = load(edition, { PUBLIC_BASE_URL: base, WORKOS_REDIRECT_URI: 'https://example.com/app/callback' });
        assert.deepEqual([config.publicBaseUrl, config.mcpResourceUrl, config.resourceMetadataUrl], [publicBaseUrl, mcpResourceUrl, resourceMetadataUrl]);
    });
}
for (const edition of ['self-hosted', 'hosted']) {
    for (const deployment of [undefined, '', 'local', 'Hosted', ' hosted', 'self-hosted ']) {
        const selector = deployment === undefined ? 'no DEPLOYMENT' : `DEPLOYMENT=${JSON.stringify(deployment)}`;
        test(`Given ${edition} settings with ${selector}, when it loads, then it rejects the edition selector`, () => {
            assert.match(rejectionMessage(environment(edition, { DEPLOYMENT: deployment })), /^DEPLOYMENT must be set to self-hosted or hosted\./);
        });
    }
}
const ignoredSettings = [
    ['hosted', { DATA_DIR: '/var/lib/magumagu' }], ['hosted', { AUTH_MODE: 'mock' }], ['self-hosted', { AUTH_MODE: 'hosted' }],
    ['self-hosted', { AUTH_MODE: 'mock', ENABLE_PAID_FEATURES: 'true' }],
    ['self-hosted', { WORKOS_AUTHKIT_ISSUER: 'not-a-url', WORKOS_COOKIE_PASSWORD: 'short' }],
];
for (const [edition, extra] of ignoredSettings) {
    test(`Given a valid ${edition} environment with ${assignments(extra)}, when it loads, then those settings change nothing`, () => {
        assert.deepEqual(load(edition, extra), load(edition));
    });
}
const settingsRead = [
    ['self-hosted', 'DATA_DIR DEPLOYMENT PUBLIC_BASE_URL'],
    ['hosted', 'DEPLOYMENT PUBLIC_BASE_URL WORKOS_API_KEY WORKOS_AUTHKIT_ISSUER WORKOS_CLIENT_ID WORKOS_COOKIE_PASSWORD WORKOS_REDIRECT_URI'],
];
for (const [edition, expected] of settingsRead) {
    test(`Given a valid ${edition} environment, when it loads, then it reads only the ${edition} settings`, () => {
        const read = new Set();
        const settings = new Proxy(environment(edition), {
            get: (target, name) => { read.add(String(name)); return Reflect.get(target, name); },
        });
        loadDeploymentConfig(settings, 'http');
        assert.equal([...read].sort().join(' '), expected);
    });
}
test('Given valid hosted settings only in process.env, when it loads an empty environment, then it ignores process.env', (context) => {
    context.mock.property(process, 'env', environment('hosted'));
    assert.match(rejectionMessage({}), /^DEPLOYMENT must be set/);
});
const urlSettings = [
    ['self-hosted', 'PUBLIC_BASE_URL'], ['hosted', 'PUBLIC_BASE_URL'], ['hosted', 'WORKOS_AUTHKIT_ISSUER'], ['hosted', 'WORKOS_REDIRECT_URI'],
];
const brokenUrls = [
    ['must not contain spaces or control characters', (url) => `${url} `],
    ['must be an absolute URL', (url) => url.replace('https://', '')],
    ['must use https', (url) => url.replace('https:', 'ftp:')],
    ['must not contain a username or password', (url) => url.replace('https://', 'https://operator:hunter2@')],
    ['must not contain a fragment', (url) => `${url}#top`],
    ['must not contain a fragment', (url) => `${url}#`],
    ['must not contain a query', (url) => `${url}?tenant=acme`],
    ['must not contain a query', (url) => `${url}?`],
];
for (const [edition, setting] of urlSettings) {
    for (const [rule, breakUrl] of brokenUrls.filter(([rule]) => setting !== 'WORKOS_REDIRECT_URI' || !rule.endsWith('query'))) {
        const value = breakUrl(String(valid[edition][setting]));
        test(`Given a ${edition} ${setting} of ${JSON.stringify(value)}, when it loads, then it rejects the URL because it ${rule}`, () => {
            assert.match(rejectionMessage(environment(edition, { [setting]: value })), new RegExp(`^${setting} ${rule}\\.`));
        });
    }
}
const requiredSettings = [
    ...urlSettings, ['self-hosted', 'DATA_DIR'], ['hosted', 'WORKOS_CLIENT_ID'], ['hosted', 'WORKOS_API_KEY'], ['hosted', 'WORKOS_COOKIE_PASSWORD'],
];
for (const [edition, setting] of requiredSettings) {
    for (const value of [undefined, '']) {
        test(`Given a ${edition} environment with ${value === undefined ? 'no' : 'an empty'} ${setting}, when it loads, then it rejects the missing setting`, () => {
            assert.match(rejectionMessage(environment(edition, { [setting]: value })), new RegExp(`^${setting} is required\\.`));
        });
    }
}
const sameOrigin = /^WORKOS_REDIRECT_URI must have the same origin as PUBLIC_BASE_URL\./;
const settingRules = [
    ['hosted', { PUBLIC_BASE_URL: 'http://localhost:8080', WORKOS_REDIRECT_URI: 'http://localhost:8080/callback' }, /^PUBLIC_BASE_URL must use https\.$/],
    ['hosted', { PUBLIC_BASE_URL: 'http://127.0.0.1:8080', WORKOS_REDIRECT_URI: 'http://127.0.0.1:8080/callback' }, /^PUBLIC_BASE_URL must use https\.$/],
    ['hosted', { PUBLIC_BASE_URL: 'http://[::1]:8080', WORKOS_REDIRECT_URI: 'http://[::1]:8080/callback' }, /^PUBLIC_BASE_URL must use https\.$/],
    ['self-hosted', { PUBLIC_BASE_URL: 'http://magumagu.example' }, /^PUBLIC_BASE_URL must use https\. It can use http only on localhost, 127\.0\.0\.1, or \[::1\]\.$/],
    ['self-hosted', { PUBLIC_BASE_URL: 'http://localhost.magumagu.example' }, /^PUBLIC_BASE_URL must use https\./],
    ['self-hosted', { PUBLIC_BASE_URL: 'http://192.168.1.20:8080' }, /^PUBLIC_BASE_URL must use https\./],
    ['self-hosted', { DATA_DIR: 'relative/magumagu-data' }, /^DATA_DIR must be an absolute path\./],
    ['self-hosted', { DATA_DIR: './magumagu-data' }, /^DATA_DIR must be an absolute path\./],
    ['hosted', { WORKOS_REDIRECT_URI: 'https://other.example/auth/callback' }, sameOrigin],
    ['hosted', { WORKOS_REDIRECT_URI: 'https://magumagu.example:8443/auth/callback' }, sameOrigin],
    ['hosted', { WORKOS_REDIRECT_URI: 'https://auth.magumagu.example/callback' }, sameOrigin],
    ['hosted', { DEPLOYMENT: undefined, AUTH_MODE: 'hosted' }, /^DEPLOYMENT must be set to self-hosted or hosted\./],
    ['hosted', { AUTH_MODE: 'mock', WORKOS_API_KEY: undefined }, /^WORKOS_API_KEY is required\./],
    ['hosted', { AUTH_MODE: 'hosted', PUBLIC_BASE_URL: 'http://localhost:8080' }, /^PUBLIC_BASE_URL must use https\./],
    ['hosted', { ENABLE_PAID_FEATURES: 'true', WORKOS_COOKIE_PASSWORD: 'short' }, /^WORKOS_COOKIE_PASSWORD must have at least 32 characters\./],
    ['hosted', { DATA_DIR: '/var/lib/magumagu', WORKOS_AUTHKIT_ISSUER: undefined }, /^WORKOS_AUTHKIT_ISSUER is required\./],
];
for (const [edition, overrides, rule] of settingRules) {
    test(`Given a ${edition} environment with ${assignments(overrides)}, when it loads, then it rejects the invalid setting by name and rule`, () => {
        assert.match(rejectionMessage(environment(edition, overrides)), rule);
    });
}
test('Given a 31-character cookie password or a base URL with a password, when it loads, then the message names the rule but no secret or URL', () => {
    const password = cookiePassword.slice(1);
    const url = 'https://operator:hunter2@magumagu.example';
    const passwordMessage = rejectionMessage(environment('hosted', { WORKOS_COOKIE_PASSWORD: password }));
    const urlMessage = rejectionMessage(environment('hosted', { PUBLIC_BASE_URL: url }));
    assert.equal(password.length, 31);
    assert.match(passwordMessage, /^WORKOS_COOKIE_PASSWORD must have at least 32 characters\./);
    assert.match(urlMessage, /^PUBLIC_BASE_URL must not contain a username or password\./);
    for (const secret of [password, apiKey, url, 'hunter2'])
        assert.ok(!passwordMessage.includes(secret) && !urlMessage.includes(secret));
});
test('Given a 32-character cookie password, an issuer without a trailing slash, and a redirect query, when hosted settings load, then they stay exact', () => {
    const config = load('hosted', { WORKOS_REDIRECT_URI: 'https://magumagu.example/auth/callback?flow=mcp' });
    assert.ok(config.deployment === 'hosted');
    assert.equal(cookiePassword.length, 32);
    const { authkitIssuer, redirectUri } = config.workos;
    assert.deepEqual([config.workos.cookiePassword, authkitIssuer, redirectUri], [cookiePassword, 'https://magumagu-test.authkit.app', 'https://magumagu.example/auth/callback?flow=mcp']);
});
test('Given a valid hosted environment, when it loads for stdio, then it rejects stdio because hosted MCP uses HTTPS only', () => {
    assert.match(rejectionMessage(environment('hosted'), 'stdio'), /^The hosted DEPLOYMENT serves MCP only over HTTPS, not stdio\./);
});
test('Given a valid self-hosted environment, when it loads for stdio, then it returns the same record as for HTTP', () => {
    assert.deepEqual(loadDeploymentConfig(environment('self-hosted'), 'stdio'), load('self-hosted'));
});
test('Given valid environments, when they load, then each record and its WorkOS settings are frozen', () => {
    const [selfHosted, hosted] = [load('self-hosted'), load('hosted')];
    assert.ok(hosted.deployment === 'hosted');
    assert.deepEqual([Object.isFrozen(selfHosted), Object.isFrozen(hosted), Object.isFrozen(hosted.workos)], [true, true, true]);
});
//# sourceMappingURL=deployment-config.test.js.map