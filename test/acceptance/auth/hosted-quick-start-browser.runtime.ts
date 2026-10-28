import { test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { HostedPortal } from '../../../src/app/hosted-portal.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { QuickStartBrowser } from '../../support/drivers/browser/quick-start-browser.ts';
import { memberRemovalBrowser } from '../../support/drivers/browser/member-removal-browser.ts';
import { removalAdmin, removalOrganization, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';
import { portalBuild } from '../../support/processes/module-paths.ts';

for (const javaScriptEnabled of [true, false]) {
  test(`Given an organization Admin with JavaScript ${javaScriptEnabled ? 'on' : 'off'}, when Quick start is used by keyboard at narrow and wide widths, then expanded instructions fit and copy has a truthful outcome`, async t => {
    const portal = await HostedPortal.load([], pathToFileURL(portalBuild));
    const site = await serveMemberRemovalSite(t, { portal });
    const { browser: session } = await signInThroughServer(site, removalAdmin, removalOrganization);
    const page = await memberRemovalBrowser(t, site.transport, { cookieHeader: session.cookieHeader ?? '', javaScriptEnabled });
    const evidence = javaScriptEnabled ? process.env.THERMUS_BROWSER_EVIDENCE_DIR : undefined;
    if (evidence) await mkdir(evidence, { recursive: true });
    const browser = new QuickStartBrowser(page, evidence);
    await browser.open();
    await browser.checkGuideAndLayout();
    if (javaScriptEnabled) await browser.checkClipboardOutcomes();
    else await browser.checkManualGuide();
    browser.checkNoBrowserErrors();
  });
}
