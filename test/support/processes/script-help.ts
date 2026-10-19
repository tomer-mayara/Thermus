import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import type { TestContext } from 'node:test';
import { repositoryRoot } from './module-paths.ts';
import { runScript } from './script-command.ts';

export async function scriptHelp(t: TestContext, command: string): Promise<string> {
  const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
  const preload = new URL(`./deny-child-processes.${extension}`, import.meta.url).href;
  const result = await runScript(t, fileURLToPath(new URL(command, repositoryRoot)), {
    args: ['--help'], env: { PATH: '', NODE_OPTIONS: `--import=${preload}` },
  });
  assert.equal(result.code, 0, `${command}: help failed\n${result.stderr}`);
  assert.equal(result.stderr, '', `${command}: help wrote a diagnostic`);
  return result.stdout;
}
