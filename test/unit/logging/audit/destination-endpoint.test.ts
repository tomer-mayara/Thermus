import assert from 'node:assert/strict';
import test from 'node:test';
import { validDestinationEndpoint } from '../../../../src/logs/audit/destination-endpoint.ts';

const base = 'https://collector.example/';

for (const [label, endpoint] of [
  ['a DNS name', 'https://collector.example/v1/logs'],
  ['a mixed-case DNS name with a final dot', 'https://Collector.Example./v1/logs'],
  ['a DNS name with a port', 'https://collector.example:8443/v1/logs'],
  ['an endpoint of exactly 2048 characters', base + 'x'.repeat(2048 - base.length)],
  ['a public IPv4 address', 'https://8.8.8.8/v1/logs'],
  ['the first address after shared address space', 'https://100.128.0.1'],
  ['the first address after the 172.16.0.0/12 private range', 'https://172.32.0.1'],
  ['the first address after benchmark testing', 'https://198.20.0.1'],
  ['the last address before multicast', 'https://223.255.255.255'],
  ['a global IPv6 address', 'https://[2606:4700:4700::1111]/v1/logs'],
]) {
  test(`Given ${label}, when the destination endpoint is checked, then it is accepted`, () => assert.equal(validDestinationEndpoint(endpoint), true));
}

for (const [label, endpoint] of [
  ['an endpoint of 2049 characters', base + 'x'.repeat(2049 - base.length)],
  ['an uppercase scheme', 'HTTPS://collector.example'],
  ['an empty user name', 'https://@collector.example'],
  ['a space', 'https://collector.example/a b'],
  ['a control character', 'https://collector.example/a\u0001b'],
  ['a backslash', 'https://collector.example/a\\b'],
  ['no host', 'https://'],
  ['a host of one dot', 'https://./'],
  ['an uppercase localhost', 'https://LOCALHOST'],
  ['localhost with a final dot', 'https://localhost.'],
  ['a localhost subdomain with a final dot', 'https://a.localhost.'],
  ['an address of this network', 'https://0.0.0.1'],
  ['shared address space', 'https://100.64.0.1'],
  ['benchmark testing', 'https://198.18.0.1'],
  ['multicast', 'https://224.0.0.1'],
  ['the broadcast address', 'https://255.255.255.255'],
  ['IPv6 documentation', 'https://[2001:db8::1]'],
  ['IPv6 link-local', 'https://[fe80::1]'],
  ['IPv6 unique local', 'https://[fc00::1]'],
  ['the IPv6 unspecified address', 'https://[::]'],
  ['IPv6 below global unicast', 'https://[1fff::1]'],
  ['IPv6 above global unicast', 'https://[4000::1]'],
]) {
  test(`Given ${label}, when the destination endpoint is checked, then it is refused`, () => assert.equal(validDestinationEndpoint(endpoint), false));
}
