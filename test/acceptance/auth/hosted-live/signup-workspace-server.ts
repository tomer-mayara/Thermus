import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { nextReload, signUpAtFreeTier } from '../../../support/hosted-live/free-signup.ts';
import { LiveRun } from '../../../support/hosted-live/live-run.ts';
import { serverGet } from '../../../support/hosted-live/portal-visit.ts';
import { localOrigin } from '../../../support/hosted-live/settings.ts';
import { WorkspaceSite } from '../../../support/hosted-live/workspace-site.ts';

const settingUp = 'Setting up your workspace. This takes about two minutes.';
// The provisioner polls a deploy every 5 s, and the fake Render API ends a new deploy after two reads.
const liveWithinMs = 90_000;
// The registry copy refreshes after 10 s, and the portal reloads every 5 s.
const guideWithinMs = 30_000;

// SO-07: the scenario uses its own control plane, with the registry and the provisioner, so it runs after the other
// suites that use the registered localhost callback.
export function describeSignupWorkspaceCases(previous: LiveRun): void {
  describe('Hosted live gate: free signup and the workspace setup state (SO-07)', () => {
    before(() => previous.stopSite());

    test('Given WorkOS Staging and a control plane with MCP_TENANTS_ENABLED on, when a fresh visitor signs up at /signup?tier=free, then the organization exists, its row is requested, and the portal shows the setup state with a refresh until the row is live, then the connection guide', { timeout: 300_000 }, async (t) => {
      const control = new WorkspaceSite(previous.settings);
      const run = new LiveRun(previous.settings, { existingFixtures: previous.fixtures, signupLabel: 'workspace', site: () => control.site() });
      // The run ends first: its site closes before the database stops, and it deletes the user and the organization.
      t.after(() => run.end());
      await control.openDatabase(t);
      await run.site();
      const { user } = await run.signupFixtures();

      const { page, organization } = await signUpAtFreeTier(run, user, 'Acme Workspace');

      assert.equal(organization.name, 'Acme Workspace');
      assert.equal(await control.stateOf(organization.id), 'requested');
      await page.goto(`${localOrigin}/`);
      await page.getByText(settingUp, { exact: true }).waitFor();
      assert.equal(await page.locator('meta[http-equiv="refresh"]').getAttribute('content'), '5');
      assert.equal(await page.locator('.connection-guide').count(), 0);
      assert.deepEqual(JSON.parse((await serverGet(page, 'workspace/status')).body), { state: 'requested', ready: false, message: settingUp });
      await nextReload(page, 10_000);
      await page.getByText(settingUp, { exact: true }).waitFor();

      control.startProvisioning();
      await control.untilState(organization.id, 'live', liveWithinMs);

      await page.getByRole('heading', { name: 'Connect your MCP client' }).waitFor();
      await page.locator('.connection-guide').waitFor({ timeout: guideWithinMs });
      await page.getByText(`MCP endpoint: ${localOrigin}/mcp`, { exact: true }).waitFor();
      assert.equal(await page.locator('meta[http-equiv="refresh"]').count(), 0);
      assert.equal(await page.getByText(settingUp, { exact: true }).count(), 0);
      assert.deepEqual(JSON.parse((await serverGet(page, 'workspace/status')).body), { state: 'live', ready: true });
      const creates = control.render.requestsOf('create service');
      assert.equal(creates.length, 1, 'The provisioner created one tenant service through the Render fake.');
      assert.equal((creates[0]?.body as { name?: string } | undefined)?.name, `thermus-tenant-${organization.id.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`);
    });
  });
}
