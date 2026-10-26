import type { TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import type { HostedLoggingStorage } from '../../../src/app/logging-storage.ts';
import type { RevisionBoundAuditSink } from '../../../src/logs/audit/audit-snapshots.ts';
import type { AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { signInThroughServer } from '../dsl/workos-sign-in.ts';
import { formsIn, formLabelled } from '../drivers/browser/hosted-browser.ts';
import { mcpRequest, rpcResult } from '../drivers/mcp/mcp-http-request.ts';
import { SnapshotSettingsStoreSpy } from '../doubles/logging/snapshot-settings-store-spy.ts';
import { hostedConfig } from '../fixtures/hosted-config.ts';
import { serveWorkOSSite } from './workos-site.ts';

export const snapshotOrganizations = ['org_SNAPSHOT_A', 'org_SNAPSHOT_B'] as const;
const admin = { id: 'user_SNAPSHOT_ADMIN', email: 'snapshot-admin@example.com', firstName: 'Admin' };

export async function serveHostedAuditSnapshotSite(t: TestContext, suppliedStore: SnapshotSettingsStoreSpy | false = new SnapshotSettingsStoreSpy(), options: {
  loggingStorage?: HostedLoggingStorage;
  auditSink?: RevisionBoundAuditSink | null;
} = {}) {
  const store = suppliedStore === false ? new SnapshotSettingsStoreSpy() : suppliedStore;
  let now = 0;
  const admitted: { destinationRevision: string; event: AuditEvent }[] = [];
  const site = await serveWorkOSSite(t, {
    organizations: snapshotOrganizations,
    toolOperations: { fetch: async () => 'final page', search: async query => ({ status: 'released', markdown: `final ${query}` }) },
    auditSink: options.auditSink === null ? undefined : options.auditSink ?? { admit: envelope => { admitted.push(envelope); return true; } },
    snapshotOptions: { now: () => now, bounds: { freshMs: 100, backoffMs: 50 } },
    loggingStorage: options.loggingStorage ?? (suppliedStore === false ? undefined : { store, close: async () => { store.close(); } }),
    setUp: world => {
      world.users = [admin];
      world.memberships = snapshotOrganizations.map(organizationId => ({ userId: admin.id, organizationId, roles: ['admin'] }));
    },
  });
  const { browser } = await signInThroughServer(site, admin, snapshotOrganizations[0]);
  const tokens = await Promise.all(snapshotOrganizations.map(org => site.world.authkitKey.sign({ sub: admin.id, client_id: 'client_mcp', sid: `snapshot_${org}`, scope: 'openid', org_id: org }, { issuer: site.world.settings.authkitIssuer, audience: hostedConfig.mcpResourceUrl })));
  const tenant = (organization: string = snapshotOrganizations[0]) => `workos:${site.world.settings.clientId}:${organization}`;
  return {
    site, store, admitted, tenant,
    advance: (milliseconds: number) => { now += milliseconds; },
    drainLoads: () => setImmediate(),
    invite: async (email: string) => {
      const form = formLabelled(formsIn((await browser.open('members')).body), 'Send invitation');
      return browser.submit({ ...form, fields: { ...form.fields, email, role: 'user' } });
    },
    search: async (query: string, organizationIndex = 0) => rpcResult(await site.transport(mcpRequest({ url: hostedConfig.mcpResourceUrl, method: 'tools/call', token: tokens[organizationIndex], params: { name: 'search', arguments: { query, reason: 'Find the requested source' } } }))),
  };
}
