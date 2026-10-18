import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';

export async function fetchUrlState(t: TestContext): Promise<string> {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'thermus-oauth-state-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
