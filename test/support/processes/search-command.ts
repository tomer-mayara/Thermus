import type { TestContext } from 'node:test';
import { searchScript } from './module-paths.ts';
import { runScript, type ScriptResult } from './script-command.ts';
import { fetchUrlState } from '../isolation/fetch-url-state.ts';

interface SearchOptions {
  readonly credential?: string;
  readonly input?: string;
}

export async function runSearch(t: TestContext, args: readonly string[], options: SearchOptions = {}): Promise<ScriptResult> {
  const env: Record<string, string> = { XDG_STATE_HOME: await fetchUrlState(t) };
  if (options.credential !== undefined) env.THERMUS_API_KEY = options.credential;
  return runScript(t, searchScript, { args, env, input: options.input });
}
