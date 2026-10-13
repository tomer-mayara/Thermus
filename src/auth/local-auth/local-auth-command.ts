import { loadDeploymentConfig } from '../../config/deployment-config.ts';
import type { LocalUserAdministration, LocalAccount, LocalAuthSettings, PasswordSource, RegisteredClient } from './local-user-administration.ts';
import { parseLocalAuthCommand, USAGE, UsageError, type LocalAuthCommand } from './local-auth-command-line.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export interface HiddenInput {
  // Gives undefined when the input ends before a complete line.
  readHiddenLine(prompt: string): Promise<string | undefined>;
}

export interface OpenedLocalAdministration {
  readonly administration: LocalUserAdministration;
  close(): Promise<void>;
}

type OpenAdministration = (settings: LocalAuthSettings) => Promise<OpenedLocalAdministration>;

export interface LocalAuthCommandContext {
  readonly environment: Environment;
  readonly input: HiddenInput;
  readonly output: { write(text: string): void };
  readonly logger: { error(message: string): void };
  readonly openAdministration: OpenAdministration;
}

class LocalCommandUnavailableError extends Error {
  constructor() {
    super('The user and client commands are only for DEPLOYMENT=self-hosted.');
    this.name = 'LocalCommandUnavailableError';
  }
}

class PasswordEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordEntryError';
  }
}

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;
const ADD_PROMPTS = ['Password for the new account: ', 'Repeat the password: '] as const;
const RESET_PROMPTS = ['New password: ', 'Repeat the new password: '] as const;
const ACCOUNT_PASSWORD_PROMPT = 'Password of the account: ';

export async function runLocalAuthCommand(args: readonly string[], context: LocalAuthCommandContext): Promise<number> {
  const command = parsedCommand(args, context.logger);
  if (command === undefined) return EXIT_USAGE;
  try {
    await runWithAdministration(command, context);
    return EXIT_SUCCESS;
  } catch (error) {
    context.logger.error(failureMessage(error));
    return EXIT_FAILURE;
  }
}

function parsedCommand(args: readonly string[], logger: LocalAuthCommandContext['logger']): LocalAuthCommand | undefined {
  try {
    return parseLocalAuthCommand(args);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    logger.error(`${error.message}\n${USAGE}`);
    return undefined;
  }
}

async function runWithAdministration(command: LocalAuthCommand, context: LocalAuthCommandContext): Promise<void> {
  const config = loadDeploymentConfig(context.environment, 'http');
  if (config.deployment !== 'self-hosted') throw new LocalCommandUnavailableError();
  await using owned = new AsyncDisposableStack();
  const opened = owned.adopt(await context.openAdministration(config), (administration) => administration.close());
  context.output.write(await perform(command, opened.administration, context.input));
}

async function perform(command: LocalAuthCommand, administration: LocalUserAdministration, input: HiddenInput): Promise<string> {
  switch (command.action) {
    case 'users add':
      return addedMessage(await administration.addUser(command.email, newPassword(input, ADD_PROMPTS)));
    case 'users list':
      return accountTable(await administration.listUsers());
    case 'users reset-password':
      return resetMessage(await administration.resetPassword(command.email, newPassword(input, RESET_PROMPTS)));
    case 'users disable':
      return `Disabled ${(await administration.disableUser(command.email)).email} and ended its sessions.\n`;
    case 'clients register':
      return registeredMessage(await administration.registerClient(command.email, () => enteredLine(input, ACCOUNT_PASSWORD_PROMPT), command.client));
  }
}

function newPassword(input: HiddenInput, [prompt, repeatPrompt]: readonly [string, string]): PasswordSource {
  return async () => {
    const password = await enteredLine(input, prompt);
    if (await enteredLine(input, repeatPrompt) !== password) throw new PasswordEntryError('The passwords do not match.');
    return password;
  };
}

async function enteredLine(input: HiddenInput, prompt: string): Promise<string> {
  const line = await input.readHiddenLine(prompt);
  if (line === undefined) throw new PasswordEntryError('No password was entered.');
  return line;
}

function addedMessage(account: LocalAccount): string {
  return `Added ${account.email} with ID ${account.id}.\n`;
}

function registeredMessage(client: RegisteredClient): string {
  const registered = `Registered the client "${client.name}" with client ID ${client.clientId}.\n`;
  if (!client.resourceServerClientRegistered) return registered;
  return `${registered}Registered the resource-server client that the MCP server uses to check access tokens.\n`;
}

function resetMessage(account: LocalAccount): string {
  const disabled = account.disabled ? ' The account stays disabled.' : '';
  return `Reset the password of ${account.email} and ended its sessions.${disabled}\n`;
}

function accountTable(accounts: readonly LocalAccount[]): string {
  if (accounts.length === 0) return 'No local accounts. Add one with: magumagu users add <email>\n';
  const rows = [['EMAIL', 'STATE', 'ID'], ...accounts.map(({ email, disabled, id }) => [email, disabled ? 'disabled' : 'enabled', id])];
  const emailWidth = Math.max(...rows.map(([email = '']) => email.length));
  const stateWidth = Math.max(...rows.map(([, state = '']) => state.length));
  return rows.map(([email = '', state = '', id = '']) => `${email.padEnd(emailWidth)}  ${state.padEnd(stateWidth)}  ${id}\n`).join('');
}

function failureMessage(error: unknown): string {
  if (error instanceof SuppressedError) {
    return `${failureMessage(error.suppressed)} The cleanup after this failure also failed: ${failureMessage(error.error)}`;
  }
  return error instanceof Error ? error.message : String(error);
}
