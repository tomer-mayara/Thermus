import { createRequestContext, type RoleGrant } from '../../../../src/accounts/identity/access-context.ts';

export const portalBaseUrl = 'https://thermus.example/team';
export const productUserGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };

export function portalContext(grants: readonly RoleGrant[]) {
  return createRequestContext({
    user: { authority: 'workos:client_test', subject: 'user_01ADA', selectedOrganizationId: 'org_01ACME' },
    tenantId: 'workos:client_test:org_01ACME',
    organizationId: 'org_01ACME',
    grants,
  });
}
