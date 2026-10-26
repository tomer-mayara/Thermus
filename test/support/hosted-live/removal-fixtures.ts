import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { LiveRun } from './live-run.ts';
import type { FixtureKind } from './fixture-registry.ts';
import { statusOf } from './sdk-errors.ts';
import { connectRedirectUri } from './settings.ts';
import type { LiveOrganization, LiveUser } from './staging-fixtures.ts';

const organizationReadLimitMs = 10_000;
const organizationReadDelayMs = 250;

// This proof owns only the exact IDs it creates. It does not scan or delete old fixtures.
export class RemovalFixtures {
  readonly runId = `s25-02-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  readonly #run: LiveRun;
  readonly #owned: { readonly kind: FixtureKind; readonly id: string }[] = [];
  readonly #memberships: string[] = [];
  readonly #evidenceDirectory: string;

  constructor(run: LiveRun, evidenceDirectory: string) {
    this.#run = run;
    this.#evidenceDirectory = evidenceDirectory;
  }

  async note(event: string, facts: Readonly<Record<string, unknown>> = {}): Promise<void> {
    await mkdir(this.#evidenceDirectory, { recursive: true });
    await appendFile(join(this.#evidenceDirectory, `${this.runId}.jsonl`), `${JSON.stringify({ at: new Date().toISOString(), runId: this.runId, event, ...facts })}\n`);
  }

  async organization(label: string): Promise<LiveOrganization> {
    const organization = await this.#run.workos.organizations.createOrganization({
      name: `Thermus live ${this.runId} ${label}`, externalId: `thermus-live-${this.runId}-${label}`,
    });
    await this.#record('organization', organization.id);
    return { id: organization.id, name: organization.name, externalId: organization.externalId };
  }

  async user(label: string): Promise<LiveUser> {
    const email = `thermus-live-${this.runId}-${label}@example.net`;
    const password = `Tl-${randomBytes(18).toString('base64url')}-9a`;
    const user = await this.#run.workos.userManagement.createUser({ email, password, emailVerified: true, firstName: 'Thermus', lastName: 'Removal proof' });
    await this.#record('user', user.id);
    return { id: user.id, email, password };
  }

  async membership(user: LiveUser, organization: LiveOrganization, role: 'user' | 'admin'): Promise<string> {
    const membership = await this.#run.workos.userManagement.createOrganizationMembership({ userId: user.id, organizationId: organization.id, roleSlug: role });
    this.#memberships.push(membership.id);
    await this.note('membership-created', { id: membership.id, userId: user.id, organizationId: organization.id, role });
    return membership.id;
  }

  async recordReplacementMembership(id: string): Promise<void> {
    this.#memberships.push(id);
    await this.note('replacement-membership-recorded', { id });
  }

  async oauthClient(owner: LiveOrganization): Promise<string> {
    const application = await this.#run.workos.connect.createApplication({
      name: `Thermus live ${this.runId} MCP client`, applicationType: 'oauth', isFirstParty: false,
      organizationId: owner.id, usesPkce: true, redirectUris: [{ uri: connectRedirectUri, default: true }],
    });
    await this.#record('application', application.id);
    return application.clientId;
  }

  async #record(kind: FixtureKind, id: string): Promise<void> {
    // Record cleanup before the journal write, so an IO failure cannot orphan a created resource.
    this.#run.recordFixture(kind, id);
    this.#owned.push({ kind, id });
    await this.note('resource-created', { kind, id });
  }

  // Organization deletion can precede its GET visibility. Repeat only exact-ID reads, never deletion.
  async #organizationAbsent(id: string): Promise<{ readonly status: 404; readonly reads: number }> {
    const deadline = performance.now() + organizationReadLimitMs;
    let reads = 0;
    while (performance.now() < deadline) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let status: number;
      try {
        reads += 1;
        status = await Promise.race([
          this.#run.workos.organizations.getOrganization(id).then(() => 200, (error: unknown) => {
            if (statusOf(error) === 404) return 404;
            throw error;
          }),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error(`Cleanup organization read exceeded ${organizationReadLimitMs} ms for ${id}.`)), Math.max(0, deadline - performance.now()));
          }),
        ]);
      } finally { clearTimeout(timer); }
      if (status === 404) return { status, reads };
      const remaining = deadline - performance.now();
      if (remaining > 0) await sleep(Math.min(organizationReadDelayMs + Math.floor(Math.random() * 51), remaining));
    }
    throw new Error(`Cleanup did not observe HTTP 404 within ${organizationReadLimitMs} ms for the exact test-owned organization ${id}.`);
  }

  async end(): Promise<void> {
    const failures: Error[] = [];
    const attempt = async (step: string, work: () => Promise<void>): Promise<void> => {
      try { await work(); }
      catch (cause) { failures.push(new Error(step, { cause })); }
    };
    const note = (event: string, facts: Readonly<Record<string, unknown>> = {}) => attempt(`Cleanup journal ${event} failed.`, () => this.note(event, facts));
    await note('cleanup-started', { resources: this.#owned });
    // Journal failure must not prevent cleanup or verification of any exact owned ID.
    await attempt('Test-owned resource cleanup failed.', () => this.#run.end());
    await note('cleanup-verification-limit', { scope: 'exact owned organization IDs only', readLimitMs: organizationReadLimitMs, readDelayMs: organizationReadDelayMs, maximumJitterMs: 50, deleteRetries: 0 });
    for (const { kind, id } of this.#owned) {
      await attempt(`Cleanup verification failed for ${kind} ${id}.`, async () => {
        if (kind === 'organization') {
          const result = await this.#organizationAbsent(id);
          await note('cleanup-verified', { kind, id, ...result, readLimitMs: organizationReadLimitMs });
          return;
        }
        const reads: Record<Exclude<FixtureKind, 'organization'>, () => Promise<unknown>> = {
          application: () => this.#run.workos.connect.getApplication({ id }),
          user: () => this.#run.workos.userManagement.getUser(id),
        };
        const status = await reads[kind]().then(() => 200, statusOf);
        assert.equal(status, 404, `Cleanup did not remove the exact test-owned ${kind} ${id}.`);
        await note('cleanup-verified', { kind, id, status });
      });
    }
    for (const id of this.#memberships) {
      await attempt(`Cleanup verification failed for membership ${id}.`, async () => {
        const status = await this.#run.workos.userManagement.getOrganizationMembership(id).then(() => 200, statusOf);
        assert.equal(status, 404, `Cleanup did not remove the exact test-owned membership ${id}.`);
        await note('cleanup-verified', { kind: 'membership', id, status });
      });
    }
    await note(failures.length === 0 ? 'cleanup-complete' : 'cleanup-failed', { failures: failures.map(({ message }) => message) });
    if (failures.length > 0) throw new AggregateError(failures, 'The scoped WorkOS proof had cleanup or journal failures.');
  }
}
