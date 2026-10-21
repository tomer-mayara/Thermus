import type { TestContext } from 'node:test';
import { fetchUrlScript } from './module-paths.ts';
import { runScript, type ScriptResult } from './script-command.ts';
import { fetchUrlState } from '../isolation/fetch-url-state.ts';

interface FetchUrlOptions {
  readonly credential?: string;
  readonly input?: string;
  readonly keepInputOpen?: boolean;
  readonly stateDirectory?: string;
}

export async function runFetchUrl(t: TestContext, args: readonly string[], options: FetchUrlOptions = {}): Promise<ScriptResult> {
  const env: Record<string, string> = { XDG_STATE_HOME: options.stateDirectory ?? await fetchUrlState(t) };
  if (options.credential !== undefined) env.THERMUS_API_KEY = options.credential;
  return runScript(t, fetchUrlScript, { args, env, input: options.input, keepInputOpen: options.keepInputOpen });
}
