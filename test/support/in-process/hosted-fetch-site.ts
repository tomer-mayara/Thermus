import type { TestContext } from 'node:test';
import '../processes/use-hosted-portal-fixture.ts';
import { openWorkOSApplication } from '../../../src/app/hosted-workos-application.ts';
import { hostedRootConfig } from '../fixtures/hosted-config.ts';
import { hostedFetchSettings, workOSSettings } from '../fixtures/hosted-placeholder.ts';
import { WorkOSFake, type FakeUser } from '../doubles/workos/workos-fake.ts';
import { completionRecordsIn } from '../drivers/operator-log.ts';

const hostedFetchUser: FakeUser = { id: 'user_fetch', email: 'fetch@example.com', firstName: 'Fetch' };
const hostedFetchOrganization = 'org_fetch';

// The production composition runs unchanged. The fetch seam routes only WorkOS and AuthKit to the local fake.
// The settings add to the hosted test settings, for example OPERATION_CAPACITY.
export async function openHostedFetchSite(t: TestContext, settings: Readonly<Record<string, string>> = {}) {
  const world = await WorkOSFake.start(t, hostedRootConfig.publicBaseUrl, [hostedFetchOrganization]);
  world.users = [hostedFetchUser];
  world.memberships = [{ userId: hostedFetchUser.id, organizationId: hostedFetchOrganization, roles: ['user'] }];
  const actualFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === 'https://api.workos.com') return actualFetch(new URL(`${url.pathname}${url.search}`, world.fake.origin), init);
    if (url.origin === workOSSettings.WORKOS_AUTHKIT_ISSUER) return actualFetch(world.fake.authkitKeySetUrl, init);
    throw new Error('Unexpected outbound request');
  }) as typeof fetch);
  const lines: string[] = [];
  const logger = { info: (line: string) => { lines.push(line); }, error: (line: string) => { lines.push(line); } };
  const application = await openWorkOSApplication(hostedRootConfig, logger, { ...workOSSettings, ...hostedFetchSettings, ...settings });
  t.after(() => application.close());
  const token = await world.authkitKey.sign({ sub: hostedFetchUser.id, client_id: 'client_mcp', sid: 'app_consent_fetch', scope: 'openid', org_id: hostedFetchOrganization }, {
    issuer: workOSSettings.WORKOS_AUTHKIT_ISSUER, audience: hostedRootConfig.mcpResourceUrl,
  });
  return { application, config: hostedRootConfig, world, token, lines, completions: (operationId?: string) => completionRecordsIn(lines.join('\n'), operationId) };
}
