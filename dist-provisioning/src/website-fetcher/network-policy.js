import dns from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
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
export async function assertPublicDestination(url) {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(hostname)
        ? [{ address: hostname }]
        : await dns.lookup(hostname, { all: true });
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
//# sourceMappingURL=network-policy.js.map