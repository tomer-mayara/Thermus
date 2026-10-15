import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { LiveRun } from '../../../support/hosted-live/live-run.ts';
import {
  applicationPermissionsOf,
  browserRedirectUri,
  hostedRolePermissions,
  mcpResource,
} from '../../../support/hosted-live/settings.ts';
import { field, queryWidgetGraph, readWorkOSList } from '../../../support/hosted-live/workos-api.ts';

const readOptions = { timeout: 30_000 };
const fixtureOptions = { timeout: 120_000 };
const browserOptions = { timeout: 90_000 };
const authenticationSettingsQuery = 'query { authenticationSettings { mfaEnabled mfaRequired passkeyAuthEnabled passwordAuthEnabled } authkitSettings { origin } }';
const choiceNames = /^\s*- (?:button|link) "([^"]+)"/gm;
const socialChoice = /^(?:continue|sign in|log in) with (?!email$)/i;

export function describeConfigurationProofs(run: LiveRun): void {
  const { settings, workos } = run;

  describe('Hosted live proofs: the configuration of the WorkOS staging environment', () => {
    test('Given the staging environment, when its redirect URIs are read, then exactly https://localhost:46443/callback is saved, and it is the default', readOptions, async (t) => {
      const saved = (await readWorkOSList(settings, '/user_management/redirect_uris')).map(({ uri, default: isDefault }) => ({ uri, default: isDefault }));
      t.diagnostic(`redirect URIs: ${JSON.stringify(saved)}`);

      assert.deepEqual(saved, [{ uri: browserRedirectUri, default: true }]);
    });

    test('Given the staging environment, when its CORS origins are read, then none is saved', readOptions, async (t) => {
      const origins = await readWorkOSList(settings, '/user_management/cors_origins');
      t.diagnostic(`CORS origins: ${JSON.stringify(origins)}`);

      assert.deepEqual(origins, []);
    });

    test('Given the staging environment, when its MCP resource indicators are read, then https://localhost:46443/mcp is saved', readOptions, async (t) => {
      const resources = (await readWorkOSList(settings, '/user_management/authkit_oauth_resources')).map(({ uri }) => uri);
      t.diagnostic(`MCP resource indicators: ${JSON.stringify(resources)}`);

      assert.ok(resources.includes(mcpResource), `${mcpResource} is not a saved MCP resource indicator.`);
    });

    test('Given the hosted role mapping, when the environment roles are read, then user, admin, super-admin, and member have exactly their mapped permissions, and no other role has an application permission', readOptions, async (t) => {
      const { data: roles } = await workos.authorization.listEnvironmentRoles();
      for (const { slug, permissions } of roles) t.diagnostic(`role ${slug}: ${JSON.stringify(permissions.toSorted())}`);
      const permissionsOf = new Map(roles.map(({ slug, permissions }) => [slug, permissions.toSorted()]));

      for (const [slug, permissions] of Object.entries(hostedRolePermissions)) {
        assert.deepEqual(permissionsOf.get(slug), permissions.toSorted(), `The environment role ${slug} does not have exactly ${JSON.stringify(permissions)}.`);
      }
      const others = roles.filter(({ slug, permissions }) => !Object.hasOwn(hostedRolePermissions, slug) && applicationPermissionsOf(permissions).length > 0);
      assert.deepEqual(others.map(({ slug }) => slug), [], 'Another environment role has an application permission.');
    });

    test('Given a member of a staging organization, when a widget token of that member reads the authentication settings, then MFA is required, password sign-in is on, and passkey sign-in is off', fixtureOptions, async (t) => {
      const { twoOrganizationUser, organizationA } = await run.fixtures();
      const { token } = await workos.widgets.createToken({ organizationId: organizationA.id, userId: twoOrganizationUser.id, scopes: ['widgets:users-table:manage'] });

      const data = await queryWidgetGraph(token, authenticationSettingsQuery);

      const authentication = field(data, 'authenticationSettings');
      t.diagnostic(`authenticationSettings: ${JSON.stringify(authentication)}`);
      t.diagnostic(`authkitSettings: ${JSON.stringify(data.authkitSettings)}`);
      assert.equal(authentication.mfaRequired, true);
      assert.equal(authentication.passwordAuthEnabled, true);
      assert.equal(authentication.passkeyAuthEnabled, false);
    });

    test('Given the hosted sign-in page, when a browser opens it, then it offers email sign-in and Google as its only social provider', browserOptions, async (t) => {
      const page = await run.browser.newPage();
      try {
        const { url } = await workos.userManagement.getAuthorizationUrlWithPKCE({ provider: 'authkit', redirectUri: browserRedirectUri, clientId: settings.clientId });
        await page.goto(url);
        await page.locator('input[name=email]').waitFor();
        const choices = [...(await page.locator('body').ariaSnapshot()).matchAll(choiceNames)].map(([, name]) => name ?? '');
        t.diagnostic(`buttons and links: ${JSON.stringify(choices)}`);

        const offered = choices.filter((name) => socialChoice.test(name));
        assert.deepEqual(offered, ['Continue with Google'], [
          `The hosted sign-in page offers these social providers: ${JSON.stringify(offered)}. It must offer only "Continue with Google".`,
          'The owner turned Google sign-in on for the auth WorkOS MCP URL fetch slice, and no other social provider may be on.',
          'Change the social providers of the staging environment under Authentication in the WorkOS dashboard, or with updateAuthkitSettings of the WorkOS connector.',
        ].join(' '));
      } finally {
        await page.context().close();
      }
    });
  });
}
