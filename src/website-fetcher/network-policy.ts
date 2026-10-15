import dns from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';

const DNS_LOOKUP_WAIT_MS = 5_000;

const blockedNetworks = [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
  '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24',
  '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24',
  '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
  '::/96', '::1/128', '64:ff9b::/96', '64:ff9b:1::/48', '100::/64',
  '2001::/32', '2001:db8::/32', '2002::/16',
  'fc00::/7', 'fe80::/10', 'fec0::/10', 'ff00::/8',
];

export const LIGHTPANDA_BLOCKED_CIDRS = blockedNetworks.join(',');

const blockedAddresses = new BlockList();
for (const cidr of blockedNetworks) {
  const [address, prefix] = cidr.split('/');
  blockedAddresses.addSubnet(address, Number(prefix), isIP(address) === 4 ? 'ipv4' : 'ipv6');
}

export class PublicDestinationPolicy {
  private readonly abandonedLookups = new Set<symbol>();

  // The system lookup cannot be cancelled. Refuse further hostname work until
  // every abandoned lookup settles. Keep late success and failure handlers.
  private async lookupAddresses(hostname: string, signal?: AbortSignal): Promise<LookupAddress[]> {
    signal?.throwIfAborted();
    if (this.abandonedLookups.size !== 0) throw new Error('A previous DNS lookup is still pending');
    const lookupId = Symbol();
    let nativePending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    const nativeSettled = () => {
      nativePending = false;
      this.abandonedLookups.delete(lookupId);
    };
    try {
      return await new Promise<LookupAddress[]>((resolve, reject) => {
        const stopWaiting = (error: unknown) => {
          if (nativePending) this.abandonedLookups.add(lookupId);
          reject(error);
        };
        cancel = () => stopWaiting(signal?.reason);
        signal?.addEventListener('abort', cancel, { once: true });
        timer = setTimeout(() => stopWaiting(new Error(`DNS lookup timed out after ${DNS_LOOKUP_WAIT_MS} ms`)), DNS_LOOKUP_WAIT_MS);
        const lookup = dns.lookup(hostname, { all: true });
        nativePending = true;
        lookup.then((addresses) => {
          nativeSettled();
          resolve(addresses);
        }, (error: unknown) => {
          nativeSettled();
          reject(error);
        });
        if (signal?.aborted) cancel();
      });
    } finally {
      clearTimeout(timer);
      if (cancel !== undefined) signal?.removeEventListener('abort', cancel);
    }
  }

  public async assertPublicDestination(url: URL, signal?: AbortSignal): Promise<void> {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(hostname)
      ? [{ address: hostname }]
      : await this.lookupAddresses(hostname, signal);
    if (addresses.length === 0) {
      throw new Error('Fetch hostname has no network addresses');
    }
    for (const { address } of addresses) {
      const family = isIP(address);
      if (family === 0 || blockedAddresses.check(address, family === 4 ? 'ipv4' : 'ipv6')) {
        throw new Error(`Fetch destination is not a public network address: ${address}`);
      }
    }
  }
}
