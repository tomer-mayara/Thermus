import { setTimeout as delay } from 'node:timers/promises';
import { WorkOS } from '@workos-inc/node';

export class SignupContractDriver {
  readonly #createdIds = new Set<string>();
  private constructor(readonly workos: WorkOS) {}

  static fromEnvironment(): SignupContractDriver {
    const apiKey = process.env.WORKOS_API_KEY;
    const clientId = process.env.WORKOS_CLIENT_ID;
    if (!apiKey?.startsWith('sk_test_') || clientId !== 'client_01M4VDKB7C7T2GV2NWPS84HADP') {
      throw new Error('FS01 needs the configured Thermus WorkOS Staging key and client. Production keys are refused.');
    }
    return new SignupContractDriver(new WorkOS({ apiKey, clientId, maxRetries: 0, timeout: 5_000 }));
  }

  async createTogether(externalId: string, metadata: Record<string, string>, count: number) {
    if (!externalId.startsWith('FS01-')) throw new Error('FS01 create needs a disposable external ID');
    return Promise.allSettled(Array.from({ length: count }, async () => {
      const organization = await this.workos.organizations.createOrganization({ name: externalId, externalId, metadata });
      this.#createdIds.add(organization.id);
      return organization;
    }));
  }

  readByExternalId(externalId: string) {
    return this.workos.organizations.getOrganizationByExternalId(externalId);
  }

  async roles(organizationId: string): Promise<Record<string, string[]>> {
    const roles = await this.workos.authorization.listOrganizationRoles(organizationId);
    return Object.fromEntries(roles.data.map(({ slug, permissions }) => [slug, permissions.toSorted()]));
  }

  async cleanup(externalId: string): Promise<string[]> {
    // A lost create response can still leave an organization. Resolve only this run's external ID.
    try {
      const saved = await this.readByExternalId(externalId);
      if (saved.name !== externalId || !externalId.startsWith('FS01-')) throw new Error('FS01 cleanup refused an unexpected organization');
      this.#createdIds.add(saved.id);
    } catch (error) {
      if (!(error instanceof Error && 'status' in error && error.status === 404)) throw error;
    }
    const removed = [...this.#createdIds];
    for (const id of removed) {
      await this.workos.organizations.deleteOrganization(id);
      await this.#confirmDeleted(id);
      this.#createdIds.delete(id);
    }
    return removed;
  }

  async #confirmDeleted(id: string): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        await this.workos.organizations.getOrganization(id);
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 404) return;
        throw error;
      }
      await delay(200);
    }
    throw new Error('FS01 cleanup did not confirm organization deletion within 15 seconds');
  }

}
