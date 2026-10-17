import { hostedRolePermissions } from '../../fixtures/hosted-roles.ts';
import { roleJson, type WorkOSFake } from './workos-fake.ts';

// Extends the WorkOS HTTP fake with persistent personal organizations and external-ID uniqueness.
export class WorkOSSignupFake {
  readonly organizations: Record<string, unknown>[] = [];
  failOrganizationReads = false;

  constructor(world: WorkOSFake) {
    world.fake.answerEach('GET /organizations/external_id/:id', (_request, id) => {
      if (this.failOrganizationReads) return { status: 503, body: { message: 'private provider error' } };
      const organization = this.organizations.find((saved) => saved.external_id === id);
      return organization === undefined ? { status: 404, body: { message: 'Organization not found' } } : { status: 200, body: organization };
    });
    world.fake.answer('POST /organizations', (request) => {
      const body = request.body as { name: string; external_id: string; metadata: Record<string, string> };
      if (this.organizations.some((saved) => saved.external_id === body.external_id)) {
        return { status: 400, body: { code: 'external_id_already_used', message: 'External ID already exists' } };
      }
      const id = `org_PERSONAL${this.organizations.length + 1}`;
      world.organizationNames = { ...world.organizationNames, [id]: body.name };
      world.organizationExternalIds = { ...world.organizationExternalIds, [id]: body.external_id };
      const organization = { ...world.organizationJson(id), metadata: { ...body.metadata } };
      this.organizations.push(organization);
      world.fake.answer(`GET /organizations/${id}`, { status: 200, body: organization });
      world.fake.answer(`GET /authorization/organizations/${id}/roles`, { status: 200, body: { object: 'list', data: Object.keys(hostedRolePermissions).map(roleJson) } });
      return { status: 201, body: organization };
    });
  }
}
