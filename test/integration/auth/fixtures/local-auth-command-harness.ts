import assert from 'node:assert/strict';
import type { LocalAuthSettings, OpenedLocalAdministration } from '../../../../src/accounts/identity/local-user-administration.ts';
import { runLocalAuthCommand, type HiddenInput } from '../../../../src/interfaces/cli/local-auth-command.ts';
import { BetterAuthUserAdministration } from '../../../../src/accounts/providers/better-auth/better-auth-user-administration.ts';
import { SystemLogger } from '../../../../src/logs/system/system-logger.ts';
import { LocalProviderDouble } from '../../../support/doubles/auth/local-provider-double.ts';

export const environment = {
  DEPLOYMENT: 'self-hosted',
  PUBLIC_BASE_URL: 'http://localhost:8080',
  DATA_DIR: '/var/lib/thermus',
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

export class AdministrationOpenerDouble {
  readonly events: string[] = [];
  readonly settings: LocalAuthSettings[] = [];
  readonly provider = new LocalProviderDouble();
  openFailure?: Error;
  closeFailure?: Error;

  readonly open = async (settings: LocalAuthSettings): Promise<OpenedLocalAdministration> => {
    this.events.push('open');
    this.settings.push(settings);
    if (this.openFailure) throw this.openFailure;
    return {
      administration: new BetterAuthUserAdministration(this.provider.auth, this.provider.resourceServerClient),
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

export async function run(args: readonly string[], options: { opener?: AdministrationOpenerDouble; input?: ScriptedInput; environment?: Record<string, string> } = {}): Promise<Run> {
  const opener = options.opener ?? new AdministrationOpenerDouble();
  const input = options.input ?? new ScriptedInput();
  let output = '';
  const errors: string[] = [];
  const code = await runLocalAuthCommand(args, {
    environment: options.environment ?? environment,
    input,
    output: { write: (text) => { output += text; } },
    logger: { error: (failure) => { errors.push(SystemLogger.messageOf(failure)); } },
    openAdministration: opener.open,
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
