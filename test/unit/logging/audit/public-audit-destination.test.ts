import assert from 'node:assert/strict';
import test from 'node:test';
import dns from 'node:dns/promises';
import { parseAuditDestination, resolveAuditAddress, sameAuditAddress } from '../../../../src/logs/audit/public-audit-destination.ts';

const endpoint = (value: string) => parseAuditDestination({ endpoint: value, auth: { type: 'none' } });
for (const value of ['https://collector.example:0/v1/logs', 'http://collector.example/v1/logs', 'https://user:pass@collector.example/v1/logs', 'https://collector.example/v1/logs?token=x', 'https://collector.example/v1/logs?', 'https://collector.example/v1/logs#secret', 'https://collector.example/v1/logs#', 'https://collector.example/\nsecret', 'https:\\collector.example\\logs', 'https://collector.example/' + 'x'.repeat(2_048)]) {
  test(`Given unsafe URL syntax ${JSON.stringify(value.slice(0, 100))}, when parsed, then it is refused`, () => assert.throws(() => endpoint(value), /Audit send did not complete/));
}
for (const address of ['0.1.2.3', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254', '168.63.129.16', '172.16.0.1', '192.0.0.9', '192.0.2.1', '192.88.99.1', '192.168.0.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1', '255.255.255.255', '::', '::1', '::ffff:8.8.8.8', '64:ff9b::808:808', '64:ff9b:1::1', '100::1', '2001::1', '2001:2::1', '2001:20::1', '2001:db8::1', '2002:808:808::', '3fff::1', 'fc00::1', 'fe80::1', 'ff02::1']) {
  test(`Given special address ${address}, when resolving, then no connection is allowed`, async () => {
    const parsed = endpoint(`https://${address.includes(':') ? `[${address}]` : address}/v1/logs`);
    await assert.rejects(resolveAuditAddress(parsed.url, new AbortController().signal), /Audit send did not complete/);
  });
}
for (const address of ['8.8.8.8', '93.184.216.10', '2606:4700:4700::1111']) {
  test(`Given public address ${address}, when resolving, then the address can be pinned`, async () => {
    const parsed = endpoint(`https://${address.includes(':') ? `[${address}]` : address}/v1/logs`);
    assert.equal((await resolveAuditAddress(parsed.url, new AbortController().signal)).address, address);
  });
}
test('Given a mixture of public and private DNS answers, when resolving, then the whole destination is refused', async (t) => {
  t.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]);
  await assert.rejects(resolveAuditAddress(endpoint('https://collector.example/v1/logs').url, new AbortController().signal), /Audit send did not complete/);
});
test('Given DNS changes between sends, when resolving again, then the new private answer is refused', async (t) => {
  const lookup = t.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  const url = endpoint('https://collector.example/v1/logs').url;
  assert.equal((await resolveAuditAddress(url, new AbortController().signal)).address, '8.8.8.8');
  lookup.mock.mockImplementation(async () => [{ address: '127.0.0.1', family: 4 }]);
  await assert.rejects(resolveAuditAddress(url, new AbortController().signal));
});
test('Given too many DNS answers, when resolving, then bounded destination work is refused', async (t) => {
  t.mock.method(dns, 'lookup', async () => Array.from({ length: 33 }, () => ({ address: '8.8.8.8', family: 4 })));
  await assert.rejects(resolveAuditAddress(endpoint('https://collector.example/v1/logs').url, new AbortController().signal));
});
test('Given no DNS answers, when resolving, then no connection is allowed', async (t) => {
  t.mock.method(dns, 'lookup', async () => []);
  await assert.rejects(resolveAuditAddress(endpoint('https://collector.example/v1/logs').url, new AbortController().signal));
});
test('Given equivalent IPv6 text, when checking the connected peer, then its exact network address matches', () => {
  assert.equal(sameAuditAddress('2606:4700:4700::1111', '2606:4700:4700:0:0:0:0:1111'), true);
  assert.equal(sameAuditAddress('8.8.8.8', '8.8.4.4'), false);
  assert.equal(sameAuditAddress('8.8.8.8', '127.0.0.1'), false);
});
for (const token of ['', 'secret\r\nX: injected', 'x'.repeat(8_193), 'space token', 'ü']) {
  test('Given an invalid Bearer token, when parsing, then no header can be created', () => assert.throws(() => parseAuditDestination({ endpoint: 'https://collector.example/v1/logs', auth: { type: 'bearer', token } })));
}
test('Given a Collector path and valid Bearer token, when parsing, then only that authorization is retained', () => {
  const parsed = parseAuditDestination({ endpoint: 'https://collector.example/custom/logs', auth: { type: 'bearer', token: 'customer/token_+=.' } });
  assert.equal(parsed.url.pathname, '/custom/logs');
  assert.equal(parsed.authorization, 'Bearer customer/token_+=.');
});
