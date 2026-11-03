import { createHash } from 'node:crypto';
import { hostedRolePermissions } from '../../../support/fixtures/hosted-roles.ts';
import type { CreateOrganizationOptions, CreateOrganizationMembershipOptions, ListOrganizationMembershipsOptions, ListUsersOptions } from '@workos-inc/node';
import type { OrganizationMembership } from '../../../../src/accounts/organizations/organization-directory.ts';
import type { RemovedMemberStore } from '../../../../src/accounts/organizations/removal-operation-store.ts';
import type { SignupDocuments } from '../../../../src/accounts/organizations/signup-activation.ts';
import type { WorkOSSignupOptions } from '../../../../src/accounts/providers/workos/workos-signup.ts';

type Organization = Awaited<ReturnType<WorkOSSignupOptions['workos']['organizations']['getOrganization']>>;
type Membership = Awaited<ReturnType<WorkOSSignupOptions['workos']['userManagement']['createOrganizationMembership']>>;
type Roles = Awaited<ReturnType<WorkOSSignupOptions['workos']['authorization']['listOrganizationRoles']>>['data'];
type Identity = Parameters<RemovedMemberStore['readRemovedMember']>[0];
type RemovedMemberAnswer = Awaited<ReturnType<RemovedMemberStore['readRemovedMember']>>['status'];

export const user = { authority: 'workos:staging', subject: 'user_verified' };
export const organizationName = 'Acme Labs';
export const documents: SignupDocuments = { purpose: 'organization-creation', version: 'bundle-v1', terms: { version: 'terms-v1', sha256: createHash('sha256').update('Terms').digest('hex'), text: 'Terms' },
  notice: { version: 'notice-v1', sha256: createHash('sha256').update('Notice').digest('hex'), text: 'Notice' },
  agreement: { version: 'agreement-v1', text: 'TEST ONLY. I have authority to accept these terms for this organization.' } };

// A spy of the removed-member read of signup: it gives one scripted answer and records each identity that it reads.
export class RemovedMemberStoreSpy implements Pick<RemovedMemberStore, 'readRemovedMember'> {
  readonly reads: Identity[] = [];
  answer: RemovedMemberAnswer;
  afterRead?: () => void;

  constructor(answer: RemovedMemberAnswer) {
    this.answer = answer;
  }

  async readRemovedMember(identity: Identity): ReturnType<RemovedMemberStore['readRemovedMember']> {
    this.reads.push(identity);
    this.afterRead?.();
    return { status: this.answer };
  }
}

export class SignupClientFake {
  readonly organizationWrites: CreateOrganizationOptions[] = [];
  readonly membershipWrites: CreateOrganizationMembershipOptions[] = [];
  readonly membershipReads: ListOrganizationMembershipsOptions[] = [];
  readonly userReads: ListUsersOptions[] = [];
  organization: Organization | undefined;
  memberships: Membership[] = [];
  currentUser = { id: user.subject, emailVerified: true };
  // The users of the user list. A read by email gives the users of that address.
  users: { readonly id: string; readonly email: string }[] = [];
  userReadFailure = false;
  afterUserRead?: () => void;
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
  // Without a store, signup gets no removed-member read, as in a composition without hosted storage.
  removedMembers: RemovedMemberStoreSpy | undefined;

  options(): WorkOSSignupOptions {
    return { authority: user.authority, workos: this, directory: { membershipsOf: async () => this.existingAccess }, clock: () => new Date('2026-10-16T12:00:00.000Z'),
      ...(this.removedMembers === undefined ? {} : { removedMembers: this.removedMembers }) };
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
    // WorkOS compares addresses without letter case and gives at most the limit.
    listUsers: async (options: ListUsersOptions) => {
      this.userReads.push(options);
      this.afterUserRead?.();
      if (this.userReadFailure) throw new Error('provider secret');
      return { data: this.users.filter((record) => record.email.toLowerCase() === options.email?.toLowerCase()).slice(0, options.limit) };
    },
    // A read for one user gives only the records of that user, as WorkOS does.
    listOrganizationMemberships: async (options: ListOrganizationMembershipsOptions) => {
      this.membershipReads.push(options);
      this.afterMembershipRead?.();
      const data = options.userId === undefined ? [...this.memberships] : this.memberships.filter((record) => record.userId === options.userId);
      return { data, listMetadata: { after: this.readAfter } };
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
