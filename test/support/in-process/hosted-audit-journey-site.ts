import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { composeLoggingStorage } from '../../../src/app/logging-storage.ts';
import { createFetchToolServer } from '../../../src/interfaces/mcp/fetch-tool-server.ts';
import { AuditLog } from '../../../src/logs/audit/audit-log.ts';
import { AuditSnapshots } from '../../../src/logs/audit/audit-snapshots.ts';
import { OtlpAuditSender } from '../../../src/logs/audit/otlp-audit-sender.ts';
import type { AuditSendOutcome } from '../../../src/logs/audit/audit-send.ts';
import { signInThroughServer } from '../dsl/workos-sign-in.ts';
import { formsIn, formLabelled } from '../drivers/browser/hosted-browser.ts';
import { mcpRequest, rpcResult } from '../drivers/mcp/mcp-http-request.ts';
import { OperatorLogSpy } from '../doubles/application/operator-log-spy.ts';
import { SnapshotSettingsStoreSpy } from '../doubles/logging/snapshot-settings-store-spy.ts';
import { hostedRootConfig } from '../fixtures/hosted-config.ts';
import { serveWorkOSSite } from './workos-site.ts';

const organizationId = 'org_AUDIT_JOURNEY';
const admin = { id: 'user_AUDIT_JOURNEY_ADMIN', email: 'journey-admin@example.com', firstName: 'Admin' };
const invitedEmail = 'journey-invitee@example.com';
const productText = 'journey-public-result password=journey-private-result-token\n' + '🦎'.repeat(20_000) + '\njourney-product-tail';

export async function runHostedAuditJourney(t: TestContext, destination: { endpoint: string; token: string }) {
  const store = new SnapshotSettingsStoreSpy();
  const sender = new OtlpAuditSender();
  const outcomes: AuditSendOutcome[] = [];
  const storage = composeLoggingStorage({ store, close: async () => { store.close(); } }, Buffer.alloc(32, 7), {
    send: sender.send.bind(sender),
    start: (...args: Parameters<OtlpAuditSender['start']>) => {
      const attempt = sender.start(...args);
      void attempt.outcome.then(outcome => { outcomes.push(outcome); });
      return attempt;
    },
  });
  let now = 0;
  const snapshots = new AuditSnapshots(store, storage.dispatch, { now: () => now, bounds: { freshMs: 100 } });
  t.after(() => snapshots.close());
  const audit = new AuditLog(snapshots);
  const toolLog = new OperatorLogSpy();
  // Both public channels share capture. The page operation itself is controlled.
  const site = await serveWorkOSSite(t, {
    config: hostedRootConfig, organizations: [organizationId], loggingStorage: storage, audit,
    buildServer: (context, lifetime) => createFetchToolServer(context, {
      audit, logger: toolLog,
      operations: { fetch: async () => productText, search: async () => ({ status: 'released', markdown: productText }) },
    }, lifetime),
    setUp: world => {
      world.authenticationMethod = 'Password';
      world.users = [admin];
      world.memberships = [{ userId: admin.id, organizationId, roles: ['admin'] }];
    },
  });
  const tenant = `workos:${site.world.settings.clientId}:${organizationId}`;
  const { browser, callback } = await signInThroughServer(site, admin, organizationId);
  assert.equal(callback.status, 303);
  const session = await browser.open('session', { Accept: 'application/json' });
  const accessBefore = await browser.open('portal/access');
  const form = formLabelled(formsIn((await browser.open('logging')).body), 'Save');
  const saved = await browser.submit({ ...form, fields: { ...form.fields, ...destination, auth: 'bearer' } });
  const disabled = await storage.service.read(tenant);
  await setImmediate();
  const testForm = formLabelled(formsIn((await browser.open('logging')).body), 'Test saved destination');
  const tested = await browser.submit({ ...testForm, fields: { ...testForm.fields, endpoint: destination.endpoint, auth: 'bearer', token: '' } });
  const afterTest = await storage.service.read(tenant);
  const enableForm = formLabelled(formsIn((await browser.open('logging')).body), 'Save');
  const enabled = await browser.submit({ ...enableForm, fields: { ...enableForm.fields, endpoint: destination.endpoint, auth: 'bearer', token: '', enabled: 'on' } });
  const enabledSettings = await storage.service.read(tenant);

  const token = await site.world.connectToken(admin, { org_id: organizationId });
  const search = async (query: string) => rpcResult(await site.transport(mcpRequest({
    url: hostedRootConfig.mcpResourceUrl, method: 'tools/call', token,
    params: { name: 'search', arguments: { query, reason: 'journey reason api_key=journey-private-reason-token' } },
  })));
  now += 100;
  const cold = await search('journey-cold-trigger');
  await setImmediate();
  const product = await search('journey query token=journey-private-query-token');

  const invitationForm = formLabelled(formsIn((await browser.open('members')).body), 'Invite');
  const invited = await browser.submit({ ...invitationForm, fields: { ...invitationForm.fields, email: invitedEmail, role: 'user' } });
  const pending = formsIn((await browser.open('members')).body);
  const resent = await browser.submit(formLabelled(pending, `Resend the invitation to ${invitedEmail}`));
  const revoked = await browser.submit(formLabelled(pending, `Revoke the invitation to ${invitedEmail}`));
  const unchangedForm = formLabelled(formsIn((await browser.open('logging')).body), 'Save');
  const unchanged = await browser.submit({ ...unchangedForm, fields: { ...unchangedForm.fields, endpoint: destination.endpoint, auth: 'bearer', token: '', enabled: 'on' } });

  const deadline = Date.now() + 10_000;
  while (outcomes.length < 5 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  const accessAfter = await browser.open('portal/access');
  return {
    tenant, actor: admin.id, authority: `workos:${site.world.settings.clientId}`, session: JSON.parse(session.body),
    accessBefore: { status: accessBefore.status, body: accessBefore.body }, accessAfter: { status: accessAfter.status, body: accessAfter.body },
    saved: saved.status, disabled, tested: { status: tested.status, body: tested.body }, afterTest,
    enabled: enabled.status, enabledSettings, cold, product, productText,
    administration: [invited.status, resent.status, revoked.status, unchanged.status],
    invitations: site.world.invitations.map(({ id, email, organizationId: org, roleSlug, state }) => ({ id, email, organizationId: org, roleSlug, state })),
    outcomes, settingsWrites: store.writes, systemOutput: [...site.log.lines, ...toolLog.lines].join('\n'),
  };
}

export type HostedAuditJourneyResult = Awaited<ReturnType<typeof runHostedAuditJourney>>;
