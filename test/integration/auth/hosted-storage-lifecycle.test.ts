import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeHostedApplication } from '../../../src/app/application.ts';
import { BillingFree } from '../../../src/accounts/billing/billing-free.ts';
import { BrowserSessionDouble } from '../../support/doubles/auth/browser-session-double.ts';
import { MembershipDirectoryDouble } from '../../support/doubles/organizations/membership-directory-double.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';

test('Given held hosted MCP cleanup and a listener drain, when shutdown starts twice, then storage cleanup starts at once and runs once', async () => {
  const directory = new MembershipDirectoryDouble('hosted-provider-double', []);
  const work = Promise.withResolvers<void>();
  const listener = Promise.withResolvers<void>();
  let storageCloses = 0;
  const application = composeHostedApplication(hostedConfig, {
    session: new BrowserSessionDouble(new Map()), accessResolver: directory, organizations: directory,
    mcp: { fetch: async () => new Response('MCP remains available'), close: () => work.promise },
  }, { reportFailure: () => {}, changeRecords: { record: () => {} }, billing: new BillingFree() }, {
    close: async () => { storageCloses++; },
  });
  assert.equal(await (await application.handle(new Request(hostedConfig.mcpResourceUrl))).text(), 'MCP remains available');
  const closing = application.close(listener.promise);
  assert.equal(application.close(), closing);
  assert.equal(storageCloses, 1);
  work.resolve();
  listener.resolve();
  await closing;
  assert.equal(storageCloses, 1);
});

test('Given hosted MCP cleanup that throws before returning, when shutdown starts, then storage still closes and the failure is reported', async () => {
  const directory = new MembershipDirectoryDouble('hosted-provider-double', []);
  const failure = new Error('MCP cleanup failed');
  let storageCloses = 0;
  const application = composeHostedApplication(hostedConfig, {
    session: new BrowserSessionDouble(new Map()), accessResolver: directory, organizations: directory,
    mcp: { fetch: async () => new Response(), close: () => { throw failure; } },
  }, { reportFailure: () => {}, changeRecords: { record: () => {} }, billing: new BillingFree() }, {
    close: async () => { storageCloses++; },
  });
  await assert.rejects(application.close(), (error) => error instanceof AggregateError && error.errors.includes(failure));
  assert.equal(storageCloses, 1);
});
