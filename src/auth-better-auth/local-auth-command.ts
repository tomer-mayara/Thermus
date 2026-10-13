import { parseArgs } from 'node:util';
import { loadDeploymentConfig } from '../config/deployment-config.ts';
import { openBetterAuthRuntime, type BetterAuthRuntime, type LocalAuthSettings } from './better-auth-runtime.ts';
import {
  LocalUserAdministration,
  type ApprovedClient,
  type LocalAccount,
  type PasswordSource,
} from './local-user-administration.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export interface HiddenInput {
  // Writes the prompt and reads one line without echo. Gives undefined when the input ends before a line.
  readHiddenLine(prompt: string): Promise<string | undefined>;
}

export interface LocalAuthCommandContext {
  readonly environment: Environment;
  readonly input: HiddenInput;
  readonly output: { write(text: string): void };
  readonly logger: { error(message: string): void };
  readonly openRuntime?: (settings: LocalAuthSettings) => Promise<BetterAuthRuntime>;
}

type LocalAuthCommand =
  | { readonly action: 'users add' | 'users reset-password' | 'users disable'; readonly email: string }
  | { readonly action: 'users list' }
  | { readonly action: 'clients register'; readonly email: string; readonly client: ApprovedClient };

export class LocalCommandUnavailableError extends Error {
  constructor() {
    super('The user and client commands are only for DEPLOYMENT=self-hosted.');
    this.name = 'LocalCommandUnavailableError';
  }
}

// A usage message never repeats the arguments, because an argument can be a mistyped password.
class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

class PasswordEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordEntryError';
  }
}

const USAGE = [
  'Usage:',
  '  magumagu                                Start the server.',
  '  magumagu users add <email>              Add an enabled account. Asks for its password two times.',
  '  magumagu users list                     List the accounts and their state.',
  '  magumagu users reset-password <email>   Set a new password and end the sessions of the account.',
  '  magumagu users disable <email>          Disable the account and end its sessions.',
  '  magumagu clients register --user <email> --name <name> --redirect-uri <uri> [--redirect-uri <uri> ...]',
  '                                          Register a native MCP client. Asks for the password of the account.',
  'Stop the server before you run a command. A command reads passwords from a hidden prompt or from standard input, never from its arguments.',
].join('\n');

const REGISTRATION_OPTIONS = {
  user: { type: 'string', multiple: true },
  name: { type: 'string', multiple: true },
  'redirect-uri': { type: 'string', multiple: true },
} as const;

const ADD_PROMPTS = ['Password for the new account: ', 'Repeat the password: '] as const;
const RESET_PROMPTS = ['New password: ', 'Repeat the new password: '] as const;
const ACCOUNT_PASSWORD_PROMPT = 'Password of the account: ';

// Exit status 2 is a usage error, 1 is a failed command, and 0 is success.
export async function runLocalAuthCommand(args: readonly string[], context: LocalAuthCommandContext): Promise<number> {
  const command = parsedCommand(args, context.logger);
  if (command === undefined) return 2;
  try {
    await runWithRuntime(command, context);
    return 0;
  } catch (error) {
    context.logger.error(failureMessage(error));
    return 1;
  }
}

function parsedCommand(args: readonly string[], logger: LocalAuthCommandContext['logger']): LocalAuthCommand | undefined {
  try {
    return parseCommand(args);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    logger.error(`${error.message}\n${USAGE}`);
    return undefined;
  }
}

function parseCommand(args: readonly string[]): LocalAuthCommand {
  const [group, verb, ...rest] = args;
  const action = `${group} ${verb}`;
  switch (action) {
    case 'users add':
    case 'users reset-password':
    case 'users disable':
      return { action, email: onlyEmailTarget(action, rest) };
    case 'users list':
      if (rest.length > 0) throw new UsageError('users list takes no arguments.');
      return { action };
    case 'clients register':
      return { action, ...registration(rest) };
    default:
      throw new UsageError('Unknown command.');
  }
}

function onlyEmailTarget(action: string, rest: readonly string[]): string {
  const [email, ...others] = rest;
  if (email === undefined || email.startsWith('-') || others.length > 0) {
    throw new UsageError(`${action} needs one email address and no other argument.`);
  }
  return email;
}

function registration(rest: readonly string[]): { email: string; client: ApprovedClient } {
  const { user = [], name = [], 'redirect-uri': redirectUris = [] } = registrationOptions(rest);
  const [email] = user;
  const [clientName] = name;
  if (email === undefined || clientName === undefined || user.length > 1 || name.length > 1 || redirectUris.length === 0) {
    throw new UsageError('clients register needs one --user, one --name, and at least one --redirect-uri.');
  }
  return { email, client: { name: clientName, redirectUris } };
}

function registrationOptions(rest: readonly string[]) {
  try {
    return parseArgs({ args: [...rest], options: REGISTRATION_OPTIONS, strict: true, allowPositionals: false }).values;
  } catch (error) {
    if (!String((error as { code?: unknown }).code).startsWith('ERR_PARSE_ARGS')) throw error;
    throw new UsageError('clients register takes only --user, --name, and --redirect-uri, each with a value.');
  }
}

async function runWithRuntime(command: LocalAuthCommand, context: LocalAuthCommandContext): Promise<void> {
  const config = loadDeploymentConfig(context.environment, 'http');
  if (config.deployment !== 'self-hosted') throw new LocalCommandUnavailableError();
  const openRuntime = context.openRuntime ?? openBetterAuthRuntime;
  await using owned = new AsyncDisposableStack();
  const runtime = owned.adopt(await openRuntime(config), (opened) => opened.close());
  context.output.write(await perform(command, new LocalUserAdministration(runtime.auth), context.input));
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
    case 'clients register': {
      const client = await administration.registerClient(command.email, () => enteredLine(input, ACCOUNT_PASSWORD_PROMPT), command.client);
      return `Registered the client "${client.name}" with client ID ${client.clientId}.\n`;
    }
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
