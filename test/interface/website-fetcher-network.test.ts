import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { permitIPv4Fixture, resolveAsPublic, startFixture } from '../support/network-fixture.ts';

test('blocks literal and DNS loopback targets before any connection', async (t) => {
  const forbidden = await startFixture(t, (_request, response) => response.end('Forbidden fixture'));
  const fetcher = new WebsiteFetcherLightpanda();
  await assert.rejects(fetcher.fetchURL(forbidden.origin));
  await assert.rejects(fetcher.fetchURL(forbidden.hostnameOrigin));
  assert.deepEqual(forbidden.requests, []);
  assert.equal(forbidden.connections, 0);
});

test('blocks IPv6 loopback before any connection', async (t) => {
  const forbidden = await startFixture(t, (_request, response) => response.end('Forbidden fixture'), '::1');
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(forbidden.origin));
  assert.deepEqual(forbidden.requests, []);
  assert.equal(forbidden.connections, 0);
});

test('checks the resolved socket when DNS changes after the initial check', async (t) => {
  const forbidden = await startFixture(t, (_request, response) => response.end('Forbidden fixture'));
  resolveAsPublic(t);
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(forbidden.hostnameOrigin));
  assert.deepEqual(forbidden.requests, []);
  assert.equal(forbidden.connections, 0);
});

test('renders permitted local HTML and JavaScript only in the trusted fixture scope', async (t) => {
  const allowed = await startFixture(t, (request, response) => {
    if (request.url === '/allowed.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end('document.getElementById("result").textContent = "Allowed script ran";');
    } else {
      response.end('<html><body><p id="result">Waiting</p><script src="/allowed.js"></script></body></html>');
    }
  });
  await t.test('the fixture is allowed by the test launcher', async (scope) => {
    permitIPv4Fixture(scope);
    const html = await new WebsiteFetcherLightpanda().fetchURL(allowed.hostnameOrigin);
    assert.match(html, /<p id="result">Allowed script ran<\/p>/);
    assert.deepEqual(allowed.requests, ['/', '/allowed.js']);
  });
  const before = allowed.connections;
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(allowed.hostnameOrigin));
  assert.equal(allowed.connections, before);
});

test('blocks a redirect from an allowed fixture to a forbidden socket', async (t) => {
  const forbidden = await startFixture(t, (_request, response) => response.end('Forbidden redirect'), '::1');
  const allowed = await startFixture(t, (_request, response) => {
    response.writeHead(302, { Location: `${forbidden.origin}/redirect-target` });
    response.end();
  });
  permitIPv4Fixture(t);
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(allowed.hostnameOrigin));
  assert.deepEqual(allowed.requests, ['/']);
  assert.deepEqual(forbidden.requests, []);
  assert.equal(forbidden.connections, 0);
});

test('blocks a script subresource before it reaches a forbidden fixture', async (t) => {
  const forbidden = await startFixture(t, (_request, response) => {
    response.setHeader('Content-Type', 'text/javascript');
    response.end('document.getElementById("result").textContent = "Forbidden script ran";');
  }, '::1');
  const allowed = await startFixture(t, (_request, response) => {
    response.end(`<html><body><p id="result">Waiting</p>
      <script src="${forbidden.origin}/private.js" onerror="document.getElementById('result').textContent='Script blocked'"></script>
      </body></html>`);
  });
  permitIPv4Fixture(t);
  const html = await new WebsiteFetcherLightpanda().fetchURL(allowed.hostnameOrigin);
  assert.match(html, /<p id="result">Script blocked<\/p>/);
  assert.deepEqual(forbidden.requests, []);
  assert.equal(forbidden.connections, 0);
});

test('blocks page JavaScript fetch, XHR, and WebSocket connections', async (t) => {
  const forbidden = await startFixture(t, (_request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.end('Forbidden JavaScript response');
  }, '::1');
  const allowed = await startFixture(t, (_request, response) => {
    response.end(`<html><body><p id="fetch">Waiting</p><p id="xhr">Waiting</p><p id="ws">Waiting</p>
      <script>
        fetch('${forbidden.origin}/fetch').catch(() => document.getElementById('fetch').textContent = 'Fetch blocked');
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '${forbidden.origin}/xhr');
        xhr.onerror = () => document.getElementById('xhr').textContent = 'XHR blocked';
        xhr.send();
        const ws = new WebSocket('${forbidden.origin.replace('http:', 'ws:')}/ws');
        ws.onerror = () => document.getElementById('ws').textContent = 'WebSocket blocked';
      </script></body></html>`);
  });
  permitIPv4Fixture(t);
  const html = await new WebsiteFetcherLightpanda().fetchURL(allowed.hostnameOrigin);
  assert.match(html, /<p id="fetch">Fetch blocked<\/p>/);
  assert.match(html, /<p id="xhr">XHR blocked<\/p>/);
  assert.match(html, /<p id="ws">WebSocket blocked<\/p>/);
  assert.deepEqual(forbidden.requests, []);
  assert.equal(forbidden.connections, 0);
});

test('ignores ambient proxy settings during a fixture fetch', async (t) => {
  const proxy = await startFixture(t, (_request, response) => response.end('<html><body>Unexpected proxy request</body></html>'));
  const allowed = await startFixture(t, (_request, response) => response.end('<html><body>Direct fixture</body></html>'));
  permitIPv4Fixture(t);
  const proxyKeys = ['http_proxy', 'https_proxy', 'all_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY'];
  const original = { ...process.env };
  for (const key of proxyKeys) process.env[key] = proxy.origin;
  process.env.no_proxy = '';
  process.env.NO_PROXY = '';
  try {
    const html = await new WebsiteFetcherLightpanda().fetchURL(allowed.hostnameOrigin);
    assert.match(html, /Direct fixture/);
    assert.deepEqual(proxy.requests, []);
    assert.equal(proxy.connections, 0);
  } finally {
    for (const key of [...proxyKeys, 'no_proxy', 'NO_PROXY']) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
