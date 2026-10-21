import { createRequestContext } from '../../../src/accounts/identity/access-context.ts';
import { InvalidAccessTokenError } from '../../../src/accounts/identity/identity-verifier.ts';
import { WorkOSAuthProvider } from '../../../src/accounts/providers/workos/workos-auth-provider.ts';

// The gate mounts this preload at the same path as emitted tests. It is absent from the image.
// Only the external identity boundary changes; CLI startup, MCP handling and fetching stay real.
WorkOSAuthProvider.prototype.verifyAccessToken = async (token) => {
  if (token !== 'hosted-image-user') throw new InvalidAccessTokenError('Unknown image test credential');
  return {
    user: { authority: 'workos:client_placeholder', subject: 'user_image', selectedOrganizationId: 'org_image' },
    issuer: 'https://thermus-test.authkit.app', clientId: 'image-test-client', scopes: [],
    issuedAtUnixSeconds: Math.floor(Date.now() / 1_000), expiresAtUnixSeconds: Math.floor(Date.now() / 1_000) + 300,
    resource: new URL('https://thermus.example/mcp'),
  };
};
WorkOSAuthProvider.prototype.resolve = async (user) => ({
  allowed: true,
  context: createRequestContext({
    user, tenantId: 'workos:client_placeholder:org_image', organizationId: 'org_image',
    grants: [{ role: 'user', permissions: ['product:access'] }],
  }),
});
