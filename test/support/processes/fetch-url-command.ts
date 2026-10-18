import type { TestContext } from 'node:test';
import { fetchUrlScript } from './module-paths.ts';
import { runScript, type ScriptResult } from './script-command.ts';

export async function runFetchUrl(t: TestContext, args: readonly string[], options: { credential?: string; input?: string; keepInputOpen?: boolean } = {}): Promise<ScriptResult> {
  return runScript(t, fetchUrlScript, {
    args,
    env: options.credential === undefined ? {} : { THERMUS_API_KEY: options.credential },
    input: options.input,
    keepInputOpen: options.keepInputOpen,
  });
}
