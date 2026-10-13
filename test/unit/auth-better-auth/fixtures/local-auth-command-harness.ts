import assert from 'node:assert/strict';
import type { BetterAuthRuntime, LocalAuthSettings } from '../../../../src/auth-better-auth/better-auth-runtime.ts';
import { runLocalAuthCommand, type HiddenInput } from '../../../../src/auth-better-auth/local-auth-command.ts';
import { LocalProviderDouble } from './local-provider-double.ts';

export const environment = {
  DEPLOYMENT: 'self-hosted',
  PUBLIC_BASE_URL: 'http://localhost:8080',
  DATA_DIR: '/var/lib/magumagu',
};
export const loopbackRedirectUri = 'http://127.0.0.1:33418/callback';
export const passwords = ['alice-password-1', 'alice-password-2', 'bob-password-1', 'dana-password-1', 'secret-value'];

export class ScriptedInput implements HiddenInput {
  readonly prompts: string[] = [];
  private readonly lines: (string | undefined)[];

  constructor(...lines: (string | undefined)[]) {
    this.lines = lines;
  }

  async readHiddenLine(prompt: string): Promise<string | undefined> {
    this.prompts.push(prompt);
    return this.lines.shift();
  }
}

export class RuntimeDouble {
  readonly events: string[] = [];
  readonly settings: LocalAuthSettings[] = [];
  readonly provider = new LocalProviderDouble();
  openFailure?: Error;
  closeFailure?: Error;

  readonly open = async (settings: LocalAuthSettings): Promise<BetterAuthRuntime> => {
    this.events.push('open');
    this.settings.push(settings);
    if (this.openFailure) throw this.openFailure;
    return {
      installationId: 'installation-id',
      tenantId: 'local:installation-id',
      auth: this.provider.auth,
      close: async () => {
        this.events.push('close');
        if (this.closeFailure) throw this.closeFailure;
      },
    };
  };
}

export interface Run {
  readonly code: number;
  readonly output: string;
  readonly errors: string;
  readonly prompts: readonly string[];
}

export async function run(args: readonly string[], options: { runtime?: RuntimeDouble; input?: ScriptedInput; environment?: Record<string, string> } = {}): Promise<Run> {
  const runtime = options.runtime ?? new RuntimeDouble();
  const input = options.input ?? new ScriptedInput();
  let output = '';
  const errors: string[] = [];
  const code = await runLocalAuthCommand(args, {
    environment: options.environment ?? environment,
    input,
    output: { write: (text) => { output += text; } },
    logger: { error: (message) => { errors.push(message); } },
    openRuntime: runtime.open,
  });
  return { code, output, errors: errors.join('\n'), prompts: input.prompts };
}

export function assertRevealsNone(result: Run, secrets: readonly string[] = passwords): void {
  for (const secret of secrets) {
    assert.ok(!result.output.includes(secret), 'a password appeared in the command output');
    assert.ok(!result.errors.includes(secret), 'a password appeared in the command log');
    assert.ok(!result.prompts.some((prompt) => prompt.includes(secret)), 'a password appeared in a prompt');
  }
}
