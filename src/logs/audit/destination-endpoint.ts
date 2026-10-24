import { isIP } from 'node:net';

export function validDestinationEndpoint(endpoint: string): boolean {
  if (endpoint.length > 2048 || /^https:\/\/[^/]*@/.test(endpoint) || !endpoint.startsWith('https://') || /[\s\p{Cc}?#\\]/u.test(endpoint)) return false;
  const url = URL.parse(endpoint);
  if (!url || url.protocol !== 'https:' || url.username || url.password) return false;
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  if (isIP(hostname) === 4) return publicIpv4(hostname);
  if (isIP(hostname) === 6) return publicIpv6(hostname);
  return !hostname.includes(':');
}

const nonPublicIpv4Ranges = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['100.64.0.0', '100.127.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.0.0.0', '192.0.255.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['198.18.0.0', '198.19.255.255'],
  ['198.51.100.0', '198.51.100.255'],
  ['203.0.113.0', '203.0.113.255'],
  ['224.0.0.0', '255.255.255.255'],
].map(([first = '', last = '']) => [ipv4Value(first), ipv4Value(last)] as const);

function publicIpv4(host: string): boolean {
  const address = ipv4Value(host);
  return !nonPublicIpv4Ranges.some(([first, last]) => address >= first && address <= last);
}

function ipv4Value(host: string): number {
  return host.split('.').reduce((address, octet) => address * 256 + Number(octet), 0);
}

function publicIpv6(host: string): boolean {
  // Only global unicast literals are accepted; mapped and local ranges are excluded.
  return /^[23][0-9a-f]{3}:/.test(host) && !host.startsWith('2001:db8:');
}
