import type { TestContext } from 'node:test';
import { searchScript, searchOAuthEntry } from './module-paths.ts';
import { runScript, type ScriptResult, type ScriptLine } from './script-command.ts';
import { fetchUrlState } from '../isolation/fetch-url-state.ts';

interface SearchOptions {
  readonly credential?: string;
  readonly input?: string;
  readonly keepInputOpen?: boolean;
  readonly stop?: ScriptLine['stop'];
  readonly stateDirectory?: string;
  readonly oauth?: { profile: Record<string, string>; ca?: string; interactive?: boolean; redirectUrl?: string };
}

export async function runSearch(t: TestContext, args: readonly string[], options: SearchOptions = {}): Promise<ScriptResult> {
  const env: Record<string, string> = { XDG_STATE_HOME: options.stateDirectory ?? await fetchUrlState(t) };
  if (options.oauth) {
    env.THERMUS_TEST_OAUTH = JSON.stringify(options.oauth);
    if (options.oauth.ca) env.NODE_EXTRA_CA_CERTS = options.oauth.ca;
  }
  if (options.credential !== undefined) env.THERMUS_API_KEY = options.credential;
  return runScript(t, options.oauth ? searchOAuthEntry : searchScript, { args, env, input: options.input, keepInputOpen: options.keepInputOpen, stop: options.stop });
}
