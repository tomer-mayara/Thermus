import dns from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { AUDIT_SEND_LIMITS, AuditSendFailure } from './audit-send.ts';
import type { AuditDestination } from './audit-send.ts';

const excluded = new BlockList();
// Azure's platform virtual IP is not a customer Collector destination.
excluded.addAddress('168.63.129.16', 'ipv4');
for (const network of ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4', '2001::/23', '2001:db8::/32', '2002::/16', '3fff::/20']) {
  const [address, prefix] = network.split('/');
  excluded.addSubnet(address, Number(prefix), isIP(address) === 4 ? 'ipv4' : 'ipv6');
}
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

function publicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6 && !globalV6.check(address, 'ipv6')) return false;
  return !excluded.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export function parseAuditDestination(destination: AuditDestination): { url: URL; authorization?: string } {
  const endpoint = destination.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length > AUDIT_SEND_LIMITS.endpointCharacters || /[\s\\?#]/.test(endpoint) || !/^https:\/\//i.test(endpoint) || /^https:\/\/[^/]*@/i.test(endpoint)) throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'invalid_destination' });
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'invalid_destination' }); }
  if (url.port === '0') throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'invalid_destination' });
  if (destination.auth.type === 'none') return { url };
  const token = destination.auth.token;
  if (destination.auth.type !== 'bearer' || typeof token !== 'string' || token.length > AUDIT_SEND_LIMITS.tokenBytes || !/^[A-Za-z0-9._~+/=-]+$/.test(token)) throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'invalid_auth' });
  return { url, authorization: `Bearer ${token}` };
}

export async function resolveAuditAddress(url: URL, signal: AbortSignal): Promise<LookupAddress> {
  signal.throwIfAborted();
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const family = isIP(hostname);
  // The caller retains admission until this native lookup settles, even after cancellation.
  const addresses = family ? [{ address: hostname, family }] : await dns.lookup(hostname, { all: true, verbatim: true });
  signal.throwIfAborted();
  if (addresses.length > AUDIT_SEND_LIMITS.dnsAnswers) throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'dns_limit' });
  if (addresses.length === 0 || addresses.some(({ address }) => !publicAddress(address))) throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'unsafe_destination' });
  return addresses[0];
}

export function sameAuditAddress(expected: string, actual: string | undefined): boolean {
  if (actual === undefined || !publicAddress(actual)) return false;
  const pinned = new BlockList();
  pinned.addAddress(expected, isIP(expected) === 4 ? 'ipv4' : 'ipv6');
  return pinned.check(actual, isIP(actual) === 4 ? 'ipv4' : 'ipv6');
}
