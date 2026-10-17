import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { type LookupAddress } from 'node:dns';
import dns from 'node:dns/promises';
import { test, type TestContext } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { syncBuiltinMocks } from '../../support/doubles/website-fetcher/builtin-mocks.ts';
import { RendererChildDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

function stubRenderer(t: TestContext, error: NodeJS.ErrnoException | null = null) {
  const calls: string[][] = [];
  const lookup = t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }]);
  t.mock.method(childProcess, 'execFile', (...args: Parameters<typeof childProcess.execFile>) => {
    assert.equal(args[0], 'lightpanda');
    calls.push([...(args[1] ?? [])]);
    const url = args[1]?.at(-1) ?? 'https://public.test/';
    args[3]?.(error, JSON.stringify({ url, http_status: 200, content: '<html><body>Public page</body></html>', error: null }), '');
    return new RendererChildDouble();
  });
  syncBuiltinMocks(t);
  return { calls, lookup };
}

const forbiddenAddresses = [
  '0.0.0.0', '0.1.2.3', '10.0.0.1', '100.64.0.1', '100.127.255.254',
  '127.0.0.1', '127.255.255.254', '169.254.169.254', '172.16.0.1', '172.31.255.254',
  '192.0.0.1', '192.0.2.1', '192.88.99.1', '192.168.0.1', '198.18.0.1', '198.19.255.254',
  '198.51.100.1', '203.0.113.1', '224.0.0.1', '239.255.255.254', '240.0.0.1', '255.255.255.255',
  '[::]', '[::1]', '[::127.0.0.1]', '[::ffff:127.0.0.1]', '[::ffff:10.0.0.1]',
  '[::ffff:169.254.169.254]', '[64:ff9b::7f00:1]', '[64:ff9b:1::a00:1]',
  '[100::1]', '[2001::1]', '[2001:db8::1]', '[2002:7f00:1::1]',
  '[fc00::1]', '[fdff::1]', '[fe80::1]', '[febf::1]', '[fec0::1]', '[ff02::1]',
];

test('blocks non-public IPv4 and IPv6 destinations before a renderer launch', async (t) => {
  const { calls } = stubRenderer(t);
  const fetcher = new WebsiteFetcherLightpanda();
  for (const address of forbiddenAddresses) {
    await assert.rejects(fetcher.fetchURL(`http://${address}/`), /not a public network address/, address);
  }
  assert.deepEqual(calls, []);
});

test('accepts public IPv4 and IPv6 addresses at private-range boundaries', async (t) => {
  const { calls } = stubRenderer(t);
  const addresses = [
    '1.1.1.1', '8.8.8.8', '100.63.255.254', '100.128.0.1', '172.15.255.254',
    '172.32.0.1', '192.167.255.254', '192.169.0.1',
    '[2001:4860:4860::8888]', '[2606:4700:4700::1111]', '[::ffff:8.8.8.8]',
  ];
  for (const address of addresses) {
    assert.match((await new WebsiteFetcherLightpanda().fetchURL(`https://${address}/`)).html, /Public page/);
  }
  assert.equal(calls.length, addresses.length);
});

test('rejects obfuscated loopback addresses after URL normalization', async (t) => {
  const { calls } = stubRenderer(t);
  for (const address of ['127.1', '2130706433', '0x7f000001', '0177.0.0.1']) {
    await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(`http://${address}/`), /not a public network address/);
  }
  assert.deepEqual(calls, []);
});

test('checks every DNS answer and rejects a mixed public and private result', async (t) => {
  const { calls, lookup } = stubRenderer(t);
  lookup.mock.mockImplementation(async () => [
    { address: '1.1.1.1', family: 4 },
    { address: 'fd00::1', family: 6 },
  ]);
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL('https://mixed.test/'), /not a public network address/);
  assert.deepEqual(lookup.mock.calls[0]?.arguments, ['mixed.test', { all: true }]);
  assert.deepEqual(calls, []);
});

test('blocks private IPv4 addresses in mapped IPv6 DNS answers before launch', async (t) => {
  const { calls, lookup } = stubRenderer(t);
  let address = '';
  lookup.mock.mockImplementation(async () => [{ address, family: 6 }]);
  for (address of ['::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe']) {
    await assert.rejects(new WebsiteFetcherLightpanda().fetchURL('https://mapped.test/'), /not a public network address/);
  }
  assert.deepEqual(calls, []);
});

test('resolves a hostname again for each fetch and blocks a changed address', async (t) => {
  const { calls, lookup } = stubRenderer(t);
  let address = '1.1.1.1';
  lookup.mock.mockImplementation(async () => [{ address, family: 4 }]);
  const fetcher = new WebsiteFetcherLightpanda();
  assert.match((await fetcher.fetchURL('https://changes.test/')).html, /Public page/);
  address = '127.0.0.1';
  await assert.rejects(fetcher.fetchURL('https://changes.test/'), /not a public network address/);
  assert.equal(lookup.mock.callCount(), 2);
  assert.equal(calls.length, 1);
});

test('rejects DNS failure, an empty answer, and invalid addresses without launching', async (t) => {
  const { calls, lookup } = stubRenderer(t);
  lookup.mock.mockImplementation(async (): Promise<LookupAddress[]> => { throw new Error('DNS failed'); });
  const fetcher = new WebsiteFetcherLightpanda();
  await assert.rejects(fetcher.fetchURL('https://missing.test/'), /DNS failed/);
  lookup.mock.mockImplementation(async () => []);
  await assert.rejects(fetcher.fetchURL('https://empty.test/'), /no network addresses/);
  lookup.mock.mockImplementation(async () => [{ address: 'invalid', family: 4 }]);
  await assert.rejects(fetcher.fetchURL('https://invalid.test/'), /not a public network address/);
  assert.deepEqual(calls, []);
});

test('applies the native connection policy and disables proxies on every launch', async (t) => {
  const { calls } = stubRenderer(t);
  const fetcher = new WebsiteFetcherLightpanda();
  await fetcher.fetchURL('https://public.test/one');
  await fetcher.fetchURL('https://public.test/two');
  assert.equal(calls.length, 2);
  for (const args of calls) {
    assert.ok(args.includes('--json'));
    assert.ok(args.includes('--block-private-networks'));
    const cidrs = args[args.indexOf('--block-cidrs') + 1]?.split(',') ?? [];
    assert.ok(cidrs.includes('100.64.0.0/10'));
    assert.ok(cidrs.includes('64:ff9b::/96'));
    assert.ok(cidrs.every((cidr) => !cidr.startsWith('-')));
    assert.ok(args.includes('--http-proxy'));
    assert.equal(args[args.indexOf('--http-proxy') + 1], '');
  }
});

test('URL text cannot supply renderer flags or permit a fixture', async (t) => {
  const { calls } = stubRenderer(t);
  const url = 'https://1.1.1.1/?--block-cidrs=-127.0.0.1/32&allowPrivate=true#--http-proxy=http://127.0.0.1';
  await new WebsiteFetcherLightpanda().fetchURL(url);
  assert.equal(calls[0]?.at(-1), new URL(url).href);
  assert.equal(calls[0]?.filter((arg) => arg === '--block-cidrs').length, 1);
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL('http://127.0.0.1/?allowPrivate=true'), /not a public network address/);
  assert.equal(calls.length, 1);
});

test('rejects unsupported URL schemes and malformed input before launch', async (t) => {
  const { calls } = stubRenderer(t);
  for (const url of ['file:///etc/hosts', 'ftp://1.1.1.1/', 'data:text/html,test', '--block-cidrs=-127.0.0.1/32']) {
    await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url));
  }
  assert.deepEqual(calls, []);
});

test('fails closed when the renderer cannot apply its policy', async (t) => {
  const error = new Error('unknown option: --block-private-networks');
  const { calls } = stubRenderer(t, error);
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL('https://1.1.1.1/'), error);
  assert.equal(calls.length, 1);
});

test('reports a missing renderer executable', async (t) => {
  stubRenderer(t, Object.assign(new Error('missing binary'), { code: 'ENOENT', syscall: 'spawn lightpanda' }));
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL('https://1.1.1.1/'), /Lightpanda executable "lightpanda" was not found.*docs\/lightpanda-runtime\.md/);
});
