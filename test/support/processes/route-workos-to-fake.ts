// This preload routes the WorkOS API and the AuthKit key set of the hosted settings to the WorkOS fake of the test
// that starts the process, on a loopback port. THERMUS_TEST_WORKOS_ORIGIN gives the origin of the fake. Each other
// request keeps the fetch of Node, so the network preload still refuses a public connection.
const fakeOrigin = process.env.THERMUS_TEST_WORKOS_ORIGIN;
const authkitIssuer = process.env.WORKOS_AUTHKIT_ISSUER;
const actualFetch = globalThis.fetch;

function fakeUrlOf(url: URL): URL | undefined {
  if (fakeOrigin === undefined) return undefined;
  if (url.origin === 'https://api.workos.com') return new URL(`${url.pathname}${url.search}`, fakeOrigin);
  // The fake serves the AuthKit key set of each issuer at /authkit/oauth2/jwks.
  if (url.origin === authkitIssuer) return new URL(`/authkit${url.pathname}`, fakeOrigin);
  return undefined;
}

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const target = fakeUrlOf(new URL(input instanceof Request ? input.url : String(input)));
  if (target === undefined) return actualFetch(input, init);
  return input instanceof Request ? actualFetch(new Request(target, input), init) : actualFetch(target, init);
}) as typeof fetch;
