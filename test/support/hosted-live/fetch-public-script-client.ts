import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { completeAuthKit } from './authkit-driver.ts';
import type { LiveBrowser } from './live-browser.ts';
import type { LiveUser } from './staging-fixtures.ts';
import { fetchPublicScriptEntry } from '../processes/module-paths.ts';

interface BrowserCommand {
  readonly directory: string;
  readonly browser: LiveBrowser;
  readonly user: LiveUser;
  readonly organizationName: string;
  readonly profile: { readonly endpoint: string; readonly issuer: string; readonly clientId: string };
}

function childEnvironment(parts: BrowserCommand): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    XDG_STATE_HOME: join(parts.directory, 'state'),
    NODE_EXTRA_CA_CERTS: join(parts.directory, 'certificate.pem'),
    THERMUS_FETCH_PROOF_PROFILE: JSON.stringify(parts.profile),
  };
}

async function authorizeBrowser(url: string, parts: BrowserCommand): Promise<readonly string[]> {
  const page = await parts.browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'commit' });
    return await completeAuthKit(page, { user: parts.user, organizationName: parts.organizationName,
      authkitHost: new URL(parts.profile.issuer).host });
  } finally {
    await page.context().close();
  }
}

export async function runPublicFetchCommand(args: readonly string[], parts: BrowserCommand) {
  const child = spawn(process.execPath, [fetchPublicScriptEntry, ...args], { env: childEnvironment(parts), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stdout = '';
  let stderr = '';
  let browserCalls = 0;
  let browserFailed = false;
  const pages: string[] = [];
  const browserTasks: Promise<void>[] = [];
  assert.ok(child.stdout);
  assert.ok(child.stderr);
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
  child.on('message', (message: unknown) => {
    const input = message as { kind?: string; url?: string };
    if (input.kind !== 'authorization' || typeof input.url !== 'string') return;
    browserCalls += 1;
    browserTasks.push(authorizeBrowser(input.url, parts)
      .then((visited) => { pages.push(...visited); })
      .catch(() => { browserFailed = true; child.kill('SIGTERM'); }));
  });
  const status = await new Promise<number | null>((resolve, reject) => { child.once('error', () => reject(new Error('The private script process did not start.'))); child.once('close', resolve); });
  await Promise.all(browserTasks);
  assert.equal(browserFailed, false, 'The script proof browser did not complete authorization.');
  assert.equal(stdout.includes(parts.user.password) || stderr.includes(parts.user.password), false, 'The script printed the owned password.');
  return { status, stdout, stderr, browserCalls, pages };
}
