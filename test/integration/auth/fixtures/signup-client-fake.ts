import { createHash } from 'node:crypto';
import { hostedRolePermissions } from '../../../support/fixtures/hosted-roles.ts';
import type { CreateOrganizationOptions, CreateOrganizationMembershipOptions, ListOrganizationMembershipsOptions } from '@workos-inc/node';
import type { OrganizationMembership } from '../../../../src/accounts/organizations/organization-directory.ts';
import type { SignupDocuments } from '../../../../src/accounts/organizations/signup-activation.ts';
import type { WorkOSSignupOptions } from '../../../../src/accounts/providers/workos/workos-signup.ts';

type Organization = Awaited<ReturnType<WorkOSSignupOptions['workos']['organizations']['getOrganization']>>;
type Membership = Awaited<ReturnType<WorkOSSignupOptions['workos']['userManagement']['createOrganizationMembership']>>;
type Roles = Awaited<ReturnType<WorkOSSignupOptions['workos']['authorization']['listOrganizationRoles']>>['data'];

export const user = { authority: 'workos:staging', subject: 'user_verified' };
export const organizationName = 'Acme Labs';
export const documents: SignupDocuments = { purpose: 'organization-creation', version: 'bundle-v1', terms: { version: 'terms-v1', sha256: createHash('sha256').update('Terms').digest('hex'), text: 'Terms' },
  notice: { version: 'notice-v1', sha256: createHash('sha256').update('Notice').digest('hex'), text: 'Notice' },
  agreement: { version: 'agreement-v1', text: 'TEST ONLY. I have authority to accept these terms for this organization.' } };

export class SignupClientFake {
  readonly organizationWrites: CreateOrganizationOptions[] = [];
  readonly membershipWrites: CreateOrganizationMembershipOptions[] = [];
  readonly membershipReads: ListOrganizationMembershipsOptions[] = [];
  organization: Organization | undefined;
  memberships: Membership[] = [];
  currentUser = { id: user.subject, emailVerified: true };
  existingAccess: readonly OrganizationMembership[] = [];
  roles: Roles = Object.entries(hostedRolePermissions).map(([slug, permissions]) => ({ slug, permissions: [...permissions] }));
  organizationFailure: 'before' | 'after' | undefined;
  membershipFailure: 'before' | 'after' | undefined;
  readFailure = false;
  readAfter: string | undefined;
  afterOrganizationCreate?: () => void;
  afterOrganizationRead?: () => void;
  afterRolesRead?: () => void;
  afterMembershipRead?: () => void;
  roleReads = 0;

  options(): WorkOSSignupOptions {
    return { authority: user.authority, workos: this, directory: { membershipsOf: async () => this.existingAccess }, clock: () => new Date('2026-10-16T12:00:00.000Z') };
  }

  readonly organizations = {
    getOrganizationByExternalId: async (externalId: string) => {
      if (this.readFailure) throw new Error('provider secret');
      if (this.organization?.externalId !== externalId) throw Object.assign(new Error('not found'), { status: 404 });
      return this.organization;
    },
    getOrganization: async (_id: string) => {
      this.afterOrganizationRead?.();
      if (this.organization === undefined) throw new Error('missing organization');
      return this.organization;
    },
    createOrganization: async (options: CreateOrganizationOptions) => {
      this.organizationWrites.push(options);
      if (this.organizationFailure === 'before') throw new Error('provider secret');
      if (this.organization !== undefined) throw Object.assign(new Error('conflict'), { status: 400 });
      this.organization = { id: 'org_personal', name: options.name, externalId: options.externalId ?? null, metadata: { ...options.metadata }, domains: [] };
      this.afterOrganizationCreate?.();
      if (this.organizationFailure === 'after') throw new Error('lost organization response');
      return this.organization;
    },
  };

  readonly userManagement = {
    getUser: async (_id: string) => this.currentUser,
    listOrganizationMemberships: async (options: ListOrganizationMembershipsOptions) => {
      this.membershipReads.push(options);
      this.afterMembershipRead?.();
      return { data: [...this.memberships], listMetadata: { after: this.readAfter } };
    },
    createOrganizationMembership: async (options: CreateOrganizationMembershipOptions) => {
      this.membershipWrites.push(options);
      if (this.membershipFailure === 'before') throw new Error('provider secret');
      const membership = { userId: options.userId, organizationId: options.organizationId, status: 'active', directoryManaged: false, roles: [{ slug: options.roleSlug ?? 'member' }] };
      this.memberships.push(membership);
      if (this.membershipFailure === 'after') throw new Error('lost membership response');
      return membership;
    },
  };

  readonly authorization = {
    listOrganizationRoles: async (_organizationId: string) => {
      this.roleReads++;
      this.afterRolesRead?.();
      return { data: this.roles };
    },
  };
}
