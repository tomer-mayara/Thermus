import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { formLabelled, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedConfig, hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { serveWorkspaceSelectionSite, workspaceSelectionUser } from '../../support/in-process/hosted-workspace-selection-site.ts';

for (const config of [hostedRootConfig, hostedConfig]) {
  const base = new URL(config.publicBaseUrl.endsWith('/') ? config.publicBaseUrl : `${config.publicBaseUrl}/`);

  for (const [label, organizationId] of [['Acme (selected)', 'org_ACME'], ['Globex', 'org_GLOBEX']] as const) {
    test(`Given Acme is selected at ${base.pathname}, when the user chooses ${label} without a return destination, then the response opens Connect at the public base and the session uses that workspace`, async (t) => {
      const site = await serveWorkspaceSelectionSite(t, config);
      const { browser } = await signInThroughServer(site, workspaceSelectionUser, 'org_ACME');
      const picker = await browser.open('organizations');
      assert.equal(picker.status, 200, picker.body);
      const form = formLabelled(formsIn(picker.body), label);
      const selected = await browser.submit(form);
      assert.equal(selected.status, 303, selected.body);
      const access = await browser.open('portal/access');
      assert.equal(access.status, 200, access.body);
      const current = JSON.parse(access.body) as { organizationId: string };
      assert.equal(current.organizationId, organizationId);
      assert.equal(selected.location?.href, base.href, 'A normal workspace choice must leave the picker for Connect');
      assert.equal(form.fields.return_to, base.pathname);
    });
  }

  for (const [selectedOrganization, admin] of [['org_ACME', false], ['org_GLOBEX', true], [undefined, false]] as const) {
    test(`Given ${selectedOrganization ?? 'no workspace'} is selected at ${base.pathname}, when the user opens Switch Workspace, then its header menu marks the picker and uses only that workspace's current role`, async (t) => {
      const site = await serveWorkspaceSelectionSite(t, config);
      const { browser } = await signInThroughServer(site, workspaceSelectionUser, selectedOrganization);
      const picker = await browser.open('organizations');
      assert.equal(picker.status, 200, picker.body);
      const { document } = parseHTML(picker.body);
      const navigation = document.querySelector('header nav[aria-label="Workspace"]');
      assert.ok(navigation, 'The workspace picker must retain the compact header menu');
      assert.equal(document.querySelectorAll('nav[aria-label="Workspace"]').length, 1);
      const links = [...navigation.querySelectorAll('a')];
      assert.deepEqual(links.map(link => [link.textContent, link.getAttribute('href')]), [
        ...(admin ? [['Quick start', new URL('quick-start', base).pathname]] : []),
        ['Connect', base.pathname], ['Switch Workspace', new URL('organizations', base).pathname],
        ...(admin ? [['Members', new URL('members', base).pathname], ['Audit Log', new URL('logging', base).pathname]] : []),
      ]);
      assert.deepEqual(links.filter(link => link.hasAttribute('aria-current')).map(link => [link.textContent, link.getAttribute('aria-current')]), [['Switch Workspace', 'page']]);
      assert.equal(document.querySelector('header .brand')?.getAttribute('href'), base.pathname);
      for (const link of links) assert.equal(link.getAttribute('tabindex'), null, 'Menu links must retain native keyboard navigation');
      assert.deepEqual(formsIn(picker.body).map(form => form.label), selectedOrganization === 'org_ACME'
        ? ['Acme (selected)', 'Globex'] : selectedOrganization === 'org_GLOBEX' ? ['Acme', 'Globex (selected)'] : ['Acme', 'Globex']);
    });
  }

  test(`Given an explicit safe return destination at ${base.pathname}, when the user selects an authorized workspace, then that destination is preserved instead of the default Connect page`, async (t) => {
    const site = await serveWorkspaceSelectionSite(t, config);
    for (const path of ['members', 'organizations']) {
      const { browser } = await signInThroughServer(site, workspaceSelectionUser, 'org_ACME');
      const returnTo = new URL(path, base);
      const picker = await browser.open(`organizations?return_to=${encodeURIComponent(returnTo.pathname)}`);
      assert.equal(picker.status, 200, picker.body);
      const form = formLabelled(formsIn(picker.body), 'Globex');
      assert.equal(form.fields.return_to, returnTo.pathname);
      const selected = await browser.submit(form);
      assert.equal(selected.status, 303, selected.body);
      assert.equal(selected.location?.href, returnTo.href);
      const destination = await browser.follow(selected);
      assert.equal(destination.status, 200, destination.body);
      const access = await browser.open('portal/access');
      assert.equal(access.status, 200, access.body);
      assert.equal((JSON.parse(access.body) as { organizationId: string }).organizationId, 'org_GLOBEX');
    }
  });
}
