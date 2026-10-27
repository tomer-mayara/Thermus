import type { Organization, OrganizationMembership, User } from '@workos-inc/node';
import { query } from './calls.ts';
import type { WorkOSCall } from './workos-client.ts';

// The WorkOS calls of the probe, through @workos-inc/node. The path is the REST call that the SDK sends.
const PAGE_SIZE = 100;
const MEMBER_ROLES = ['user'];

export function createOrganizationCall(name: string): WorkOSCall<Organization> {
  const params = { name };
  return { method: 'POST', path: '/organizations', sdk: 'workos.organizations.createOrganization', params, send: (workos) => workos.organizations.createOrganization(params) };
}

export function setStripeCustomerCall(organization: string, stripeCustomerId: string): WorkOSCall<Organization> {
  const params = { organization, stripeCustomerId };
  return { method: 'PUT', path: `/organizations/${organization}`, sdk: 'workos.organizations.updateOrganization', params, send: (workos) => workos.organizations.updateOrganization(params) };
}

export function organizationCall(id: string): WorkOSCall<Organization> {
  return { method: 'GET', path: `/organizations/${id}`, sdk: 'workos.organizations.getOrganization', send: (workos) => workos.organizations.getOrganization(id) };
}

export function deleteOrganizationCall(id: string): WorkOSCall<void> {
  return { method: 'DELETE', path: `/organizations/${id}`, sdk: 'workos.organizations.deleteOrganization', send: (workos) => workos.organizations.deleteOrganization(id) };
}

export function createUserCall(email: string): WorkOSCall<User> {
  const params = { email, emailVerified: true, firstName: 'Thermus', lastName: 'Spike' };
  return { method: 'POST', path: '/user_management/users', sdk: 'workos.userManagement.createUser', params, send: (workos) => workos.userManagement.createUser(params) };
}

export function userCall(id: string): WorkOSCall<User> {
  return { method: 'GET', path: `/user_management/users/${id}`, sdk: 'workos.userManagement.getUser', send: (workos) => workos.userManagement.getUser(id) };
}

export function deleteUserCall(id: string): WorkOSCall<void> {
  return { method: 'DELETE', path: `/user_management/users/${id}`, sdk: 'workos.userManagement.deleteUser', send: (workos) => workos.userManagement.deleteUser(id) };
}

export function addMemberCall(organizationId: string, userId: string): WorkOSCall<OrganizationMembership> {
  const params = { organizationId, userId, roleSlugs: MEMBER_ROLES };
  const sdk = 'workos.userManagement.createOrganizationMembership';
  return { method: 'POST', path: '/user_management/organization_memberships', sdk, params, send: (workos) => workos.userManagement.createOrganizationMembership(params) };
}

export function removeMemberCall(id: string): WorkOSCall<void> {
  const sdk = 'workos.userManagement.deleteOrganizationMembership';
  return { method: 'DELETE', path: `/user_management/organization_memberships/${id}`, sdk, send: (workos) => workos.userManagement.deleteOrganizationMembership(id) };
}

// The active memberships of the organization, from every page.
export function activeMembershipsCall(organizationId: string): WorkOSCall<readonly OrganizationMembership[]> {
  const params = { organizationId, statuses: ['active' as const], limit: PAGE_SIZE };
  return {
    method: 'GET', path: `/user_management/organization_memberships?${query({ organization_id: organizationId, statuses: 'active', limit: PAGE_SIZE })}`,
    sdk: 'workos.userManagement.listOrganizationMemberships', params,
    send: async (workos) => (await workos.userManagement.listOrganizationMemberships(params)).autoPagination(),
  };
}

export function organizationsCall(): WorkOSCall<readonly Organization[]> {
  const params = { limit: PAGE_SIZE };
  return {
    method: 'GET', path: `/organizations?${query(params)}`, sdk: 'workos.organizations.listOrganizations', params,
    send: async (workos) => (await workos.organizations.listOrganizations(params)).autoPagination(),
  };
}

export function usersCall(): WorkOSCall<readonly User[]> {
  const params = { limit: PAGE_SIZE };
  return {
    method: 'GET', path: `/user_management/users?${query(params)}`, sdk: 'workos.userManagement.listUsers', params,
    send: async (workos) => (await workos.userManagement.listUsers(params)).autoPagination(),
  };
}
