# Renderer network policy

The renderer can open network connections while it loads a page. The fetcher checks the destination before it starts Lightpanda. Lightpanda checks each connection before it opens a socket.

## Destination checks

`src/website-fetcher/network-policy.ts` holds the blocked CIDR list. The fetcher passes this list to Lightpanda with `--block-cidrs` on every launch. It also passes `--block-private-networks` on every launch.

For a hostname, the fetcher runs a new DNS lookup with all answers before each render. It rejects the request if any answer is in a blocked range. It checks an IP address directly when the URL contains one.

Lightpanda applies its IP filter to the resolved socket address before it opens the socket. This check covers DNS changes between the initial check and connection. It also covers redirects, page resources and scripts, `fetch`, XHR, and WebSocket connections. Lightpanda uses an empty `--http-proxy` value to disable proxy environment settings.

The reviewed Lightpanda build is `1.1.0-nightly.10257+c3dfbaab3`. Its source at [commit c3dfbaab3](https://github.com/lightpanda-io/browser/tree/c3dfbaab3bc112c1780d798a4306905f7a166dcb) implements `--block-private-networks` and `--block-cidrs`. See [the IP filter](https://github.com/lightpanda-io/browser/blob/c3dfbaab3bc112c1780d798a4306905f7a166dcb/src/network/IpFilter.zig), [the socket callback](https://github.com/lightpanda-io/browser/blob/c3dfbaab3bc112c1780d798a4306905f7a166dcb/src/network/http.zig), and [network setup](https://github.com/lightpanda-io/browser/blob/c3dfbaab3bc112c1780d798a4306905f7a166dcb/src/network/Network.zig).

The fetcher fails when Lightpanda is missing or rejects a required option. It does not retry without the network policy. Keep the tested options enabled on every renderer launch.

## Local network fixtures

The production fetcher has no request option or constructor that allows private addresses. `test/support/network-fixture.ts` contains the test-only fixture seam. It can mock the initial `localhost` lookup as public, then wrap the renderer launch to allow only `127.0.0.1/32`. This permits the fixture on any port at that one IPv4 address for the test scope. IPv6 loopback stays blocked. The helper restores the mocks after the scope ends.

Security probes use local fixtures. The existing public-site smoke tests remain separate. Run the focused network tests with:

```bash
pnpm exec tsc && node --test dist/test/unit/website-fetcher-network.test.js
pnpm exec tsc && node --test dist/test/interface/website-fetcher-network.test.js
```
