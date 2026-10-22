import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { workOSSettings } from '../../../support/fixtures/hosted-placeholder.ts';
import type { HostedLiveSettings } from '../../../support/hosted-live/settings.ts';

// These settings reach no WorkOS environment.
export const httpsSettings: HostedLiveSettings = {
  apiKey: workOSSettings.WORKOS_API_KEY,
  clientId: workOSSettings.WORKOS_CLIENT_ID,
  authkitIssuer: workOSSettings.WORKOS_AUTHKIT_ISSUER,
};
export const portalPage = '<!doctype html><title>Portal</title>';

export async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-hosted-live-site-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

export async function writePortalBuild(t: TestContext): Promise<string> {
  const directory = await temporaryDirectory(t);
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), portalPage);
  await writeFile(join(directory, 'assets', 'app.js'), 'document.body.dataset.portal = "ready";\n');
  return directory;
}

export async function beforeDeadline<T>(work: Promise<T>): Promise<T> {
  const finished = new AbortController();
  try {
    return await Promise.race([work, delay(1_000, undefined, { signal: finished.signal }).then(() => {
      throw new Error('The expected result did not arrive within one second');
    })]);
  } finally {
    finished.abort();
  }
}
