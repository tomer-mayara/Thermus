import assert from 'node:assert/strict';
import type {
  AssignRoleOptions,
  CreateOrganizationMembershipOptions,
  Organization,
  OrganizationMembership,
  OrganizationMembershipStatus,
  RemoveRoleOptions,
  User,
} from '@workos-inc/node';
import type { RunbookClient } from '../../../support/hosted-live/operator-runbook.ts';

export type RunbookWrite = { readonly create: CreateOrganizationMembershipOptions } | { readonly assignRole: AssignRoleOptions } | { readonly removeRole: RemoveRoleOptions };

const createdAt = '2026-10-14T06:00:00.000Z';
export const acme: Organization = {
  object: 'organization', id: 'org_01ACME', name: 'Acme', allowProfilesOutsideOrganization: false, domains: [], createdAt, updatedAt: createdAt,
  externalId: 'thermus-customer-0042', metadata: {},
};
export const sam: User = {
  object: 'user', id: 'user_01SAM', email: 'sam@acme.example', emailVerified: true, profilePictureUrl: null, name: null, firstName: null,
  lastName: null, lastSignInAt: null, locale: null, createdAt, updatedAt: createdAt, externalId: null, metadata: {},
};

// A stateful double of the SDK calls of the runbook, with one user and at most one membership of it in Acme. A role
// assignment adds one role, and its removal removes one; without another role, the membership gets the default role,
// as the live proofs show for WorkOS. The double records each write.
export class RunbookClientDouble implements RunbookClient {
  readonly writes: RunbookWrite[] = [];
  organization: Organization = acme;
  roles: string[] | undefined;
  status: OrganizationMembershipStatus;
  // Runs each write: by default only its effect. A test can add a change of another person at the same time, or a
  // failure before or after the effect.
  atWrite: (effect: () => void) => void = (effect) => effect();

  readonly organizations = {
    getOrganization: async (organizationId: string) => (organizationId === acme.id ? this.organization : assert.fail(`The runbook read ${organizationId}.`)),
    getOrganizationByExternalId: async () => assert.fail('The runbook located an organization.'),
    createOrganization: async () => assert.fail('The runbook created an organization.'),
  };

  readonly userManagement = {
    listUsers: async () => ({ data: [sam] }),
    listOrganizationMemberships: async () => ({ data: this.roles === undefined ? [] : [this.membership(this.roles)] }),
    createOrganizationMembership: async (options: CreateOrganizationMembershipOptions) => this.write({ create: options }, () => {
      this.roles = [...(options.roleSlugs ?? [])];
    }),
  };

  readonly authorization = {
    assignRole: async (options: AssignRoleOptions) => this.write({ assignRole: options }, () => {
      this.roles = [...(this.roles ?? []), options.roleSlug];
    }),
    removeRole: async (options: RemoveRoleOptions) => this.write({ removeRole: options }, () => {
      const remaining = (this.roles ?? []).filter((role) => role !== options.roleSlug);
      this.roles = remaining.length === 0 ? ['member'] : remaining;
    }),
  };

  constructor(roles: string[] | undefined, status: OrganizationMembershipStatus = 'active') {
    this.roles = roles;
    this.status = status;
  }

  private membership(roles: readonly string[]): OrganizationMembership {
    return {
      object: 'organization_membership', id: 'om_01SAM', organizationId: acme.id, organizationName: acme.name, userId: sam.id, status: this.status,
      directoryManaged: false, createdAt, updatedAt: createdAt, customAttributes: {}, role: { slug: roles[0] ?? 'member' }, roles: roles.map((slug) => ({ slug })),
    };
  }

  private write(write: RunbookWrite, effect: () => void): void {
    this.writes.push(write);
    this.atWrite(effect);
  }
}
