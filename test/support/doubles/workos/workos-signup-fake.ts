import type { WorkOSFake } from './workos-fake.ts';

const createdAt = '2026-10-16T12:00:00.000Z';
const roles = [{ slug: 'member', permissions: [] }, { slug: 'user', permissions: ['product:access'] },
  { slug: 'admin', permissions: ['user-grants:manage'] }, { slug: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] }];

// Extends the WorkOS HTTP fake with persistent personal organizations and external-ID uniqueness.
export class WorkOSSignupFake {
  readonly organizations: Record<string, unknown>[] = [];

  constructor(world: WorkOSFake) {
    world.fake.answerEach('GET /organizations/external_id/:id', (_request, id) => {
      const organization = this.organizations.find((saved) => saved.external_id === id);
      return organization === undefined ? { status: 404, body: { message: 'Organization not found' } } : { status: 200, body: organization };
    });
    world.fake.answer('POST /organizations', (request) => {
      const body = request.body as { name: string; external_id: string; metadata: Record<string, string> };
      if (this.organizations.some((saved) => saved.external_id === body.external_id)) {
        return { status: 400, body: { code: 'external_id_already_used', message: 'External ID already exists' } };
      }
      const id = `org_PERSONAL${this.organizations.length + 1}`;
      const organization = { object: 'organization', id, name: body.name, external_id: body.external_id,
        domains: [], metadata: { ...body.metadata }, allow_profiles_outside_organization: false, created_at: createdAt, updated_at: createdAt };
      this.organizations.push(organization);
      world.organizationNames = { ...world.organizationNames, [id]: body.name };
      world.organizationExternalIds = { ...world.organizationExternalIds, [id]: body.external_id };
      world.fake.answer(`GET /organizations/${id}`, { status: 200, body: organization });
      world.fake.answer(`GET /authorization/organizations/${id}/roles`, { status: 200, body: { object: 'list', data: roles.map((role) => ({
        object: 'role', id: `role_${role.slug}`, name: role.slug, ...role, type: 'EnvironmentRole', resource_type_slug: 'organization', created_at: createdAt, updated_at: createdAt,
      })) } });
      return { status: 201, body: organization };
    });
  }
}
