import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BetterAuthRuntime, LocalAuthSettings } from '../../../src/auth-better-auth/better-auth-runtime.ts';
import { runLocalAuthCommand, type HiddenInput } from '../../../src/auth-better-auth/local-auth-command.ts';
import { LocalProviderDouble } from './fixtures/local-provider-double.ts';

const environment = {
  DEPLOYMENT: 'self-hosted',
  PUBLIC_BASE_URL: 'http://localhost:8080',
  DATA_DIR: '/var/lib/magumagu',
};
const loopbackRedirectUri = 'http://127.0.0.1:33418/callback';
const passwords = ['alice-password-1', 'alice-password-2', 'bob-password-1', 'dana-password-1', 'secret-value'];

class ScriptedInput implements HiddenInput {
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

class RuntimeDouble {
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

interface Run {
  readonly code: number;
  readonly output: string;
  readonly errors: string;
  readonly prompts: readonly string[];
}

async function run(args: readonly string[], options: { runtime?: RuntimeDouble; input?: ScriptedInput; environment?: Record<string, string> } = {}): Promise<Run> {
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

function assertRevealsNone(result: Run, secrets: readonly string[] = passwords): void {
  for (const secret of secrets) {
    assert.ok(!result.output.includes(secret), 'a password appeared in the command output');
    assert.ok(!result.errors.includes(secret), 'a password appeared in the command log');
    assert.ok(!result.prompts.some((prompt) => prompt.includes(secret)), 'a password appeared in a prompt');
  }
}

describe('runLocalAuthCommand', () => {
  describe('command line', () => {
    test('Given an unknown command, when it runs, then it exits with status 2, prints the usage without the arguments, and opens no data', async () => {
      for (const args of [['users'], ['users', 'promote', 'alice@example.com'], ['clients', 'list'], ['serve', 'immediately'], ['--help']]) {
        const runtime = new RuntimeDouble();

        const result = await run(args, { runtime });

        assert.equal(result.code, 2, args.join(' '));
        assert.match(result.errors, /^Unknown command\./);
        assert.match(result.errors, /magumagu users add <email>/);
        assert.doesNotMatch(result.errors, /promote|alice@example\.com|immediately/);
        assert.deepEqual([result.output, runtime.events, result.prompts], ['', [], []]);
      }
    });

    test('Given a user command without exactly one email target, or with an option, when it runs, then it exits with status 2 without the arguments in the message, opens no data, and asks for no password', async () => {
      const refused = [
        ['users', 'add'],
        ['users', 'add', 'alice@example.com', 'secret-value'],
        ['users', 'add', '--password=secret-value', 'alice@example.com'],
        ['users', 'add', '--password', 'secret-value'],
        ['users', 'reset-password'],
        ['users', 'reset-password', 'alice@example.com', 'secret-value'],
        ['users', 'disable'],
        ['users', 'disable', 'alice@example.com', 'bob@example.com'],
        ['users', 'list', 'secret-value'],
      ];

      for (const args of refused) {
        const runtime = new RuntimeDouble();

        const result = await run(args, { runtime });

        assert.equal(result.code, 2, args.join(' '));
        assert.match(result.errors, /Usage:/);
        assert.doesNotMatch(result.errors, /alice@example\.com|bob@example\.com/);
        assertRevealsNone(result);
        assert.deepEqual([result.output, runtime.events, result.prompts], ['', [], []]);
      }
    });

    test('Given client registration without exactly one user and one name, without a redirect URI, or with other arguments, when it runs, then it exits with status 2 without the arguments in the message and opens no data', async () => {
      const complete = ['--user', 'alice@example.com', '--name', 'Native MCP client', '--redirect-uri', loopbackRedirectUri];
      const refused = [
        ['--name', 'Native MCP client', '--redirect-uri', loopbackRedirectUri],
        ['--user', 'alice@example.com', '--redirect-uri', loopbackRedirectUri],
        ['--user', 'alice@example.com', '--name', 'Native MCP client'],
        [...complete, '--user', 'bob@example.com'],
        [...complete, '--name', 'Other client'],
        [...complete, '--password', 'secret-value'],
        [...complete, '--password=secret-value'],
        [...complete, 'secret-value'],
        ['--user'],
      ];

      for (const options of refused) {
        const runtime = new RuntimeDouble();

        const result = await run(['clients', 'register', ...options], { runtime });

        assert.equal(result.code, 2, options.join(' '));
        assert.match(result.errors, /Usage:/);
        assert.doesNotMatch(result.errors, /alice@example\.com|bob@example\.com|127\.0\.0\.1:33418/);
        assertRevealsNone(result);
        assert.deepEqual([result.output, runtime.events], ['', []]);
      }
    });
  });

  describe('configuration and lifecycle', () => {
    test('Given the self-hosted settings, when a command runs, then it opens the runtime for the configured data directory and public URLs and closes it after the command', async () => {
      const runtime = new RuntimeDouble();

      const result = await run(['users', 'list'], { runtime });

      assert.equal(result.code, 0);
      assert.deepEqual(runtime.settings.map(({ dataDirectory, publicBaseUrl, mcpResourceUrl }) => ({ dataDirectory, publicBaseUrl, mcpResourceUrl })), [{
        dataDirectory: '/var/lib/magumagu',
        publicBaseUrl: 'http://localhost:8080/',
        mcpResourceUrl: 'http://localhost:8080/mcp',
      }]);
      assert.deepEqual(runtime.events, ['open', 'close']);
    });

    test('Given missing settings or the hosted deployment, when a command runs, then it exits with status 1 and a safe message and opens no data', async () => {
      const cases: { readonly settings: Record<string, string>; readonly message: RegExp }[] = [
        { settings: { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: 'http://localhost:8080' }, message: /DATA_DIR is required/ },
        { settings: { PUBLIC_BASE_URL: 'http://localhost:8080', DATA_DIR: '/var/lib/magumagu' }, message: /DEPLOYMENT must be set/ },
        {
          settings: {
            DEPLOYMENT: 'hosted',
            PUBLIC_BASE_URL: 'https://magumagu.example',
            WORKOS_AUTHKIT_ISSUER: 'https://magumagu-test.authkit.app',
            WORKOS_CLIENT_ID: 'client_placeholder',
            WORKOS_API_KEY: 'workos-api-key-placeholder',
            WORKOS_REDIRECT_URI: 'https://magumagu.example/auth/callback',
            WORKOS_COOKIE_PASSWORD: 'cookie-password-placeholder-0032',
          },
          message: /only for DEPLOYMENT=self-hosted/,
        },
      ];

      for (const { settings, message } of cases) {
        const runtime = new RuntimeDouble();

        const result = await run(['users', 'list'], { runtime, environment: settings });

        assert.equal(result.code, 1);
        assert.match(result.errors, message);
        assert.doesNotMatch(result.errors, /workos-api-key-placeholder|cookie-password-placeholder/);
        assert.deepEqual([result.output, runtime.events], ['', []]);
      }
    });

    test('Given a data directory that another process holds, when any command runs, then it exits with status 1 and the lock message before it asks for a password', async () => {
      const commands = [
        ['users', 'add', 'alice@example.com'],
        ['users', 'list'],
        ['users', 'reset-password', 'alice@example.com'],
        ['users', 'disable', 'alice@example.com'],
        ['clients', 'register', '--user', 'alice@example.com', '--name', 'Native MCP client', '--redirect-uri', loopbackRedirectUri],
      ];

      for (const args of commands) {
        const runtime = new RuntimeDouble();
        runtime.openFailure = Object.assign(new Error('The data directory is in use by another Magumagu process. Stop that process, then try again.'), { name: 'DataDirectoryInUseError' });

        const result = await run(args, { runtime, input: new ScriptedInput('alice-password-1', 'alice-password-1') });

        assert.equal(result.code, 1, args.join(' '));
        assert.equal(result.errors, 'The data directory is in use by another Magumagu process. Stop that process, then try again.');
        assert.deepEqual([result.output, result.prompts, runtime.events], ['', [], ['open']]);
      }
    });

    test('Given a command that fails, when it runs, then the runtime still closes and the command exits with status 1', async () => {
      const runtime = new RuntimeDouble();

      const result = await run(['users', 'disable', 'carol@example.com'], { runtime });

      assert.equal(result.code, 1);
      assert.deepEqual(runtime.events, ['open', 'close']);
    });

    test('Given a runtime that fails to close after the command, when the command runs, then the command result and the close failure are both reported and it exits with status 1', async () => {
      const runtime = new RuntimeDouble();
      runtime.closeFailure = new Error('The database did not close.');
      runtime.provider.addUser('alice@example.com', 'alice-password-1');

      const result = await run(['users', 'disable', 'alice@example.com'], { runtime });

      assert.equal(result.code, 1);
      assert.match(result.output, /^Disabled alice@example\.com/);
      assert.equal(result.errors, 'The database did not close.');
    });

    test('Given a command failure and a runtime that fails to close, when the command runs, then the message names both failures', async () => {
      const runtime = new RuntimeDouble();
      runtime.closeFailure = new Error('The database did not close.');

      const result = await run(['users', 'disable', 'carol@example.com'], { runtime });

      assert.equal(result.code, 1);
      assert.equal(result.errors, 'No local account has this email address. The cleanup after this failure also failed: The database did not close.');
    });
  });

  describe('users', () => {
    test('Given a new email, when users add runs, then it asks for the password two times with hidden prompts, adds the account, and prints its email and ID without the password', async () => {
      const runtime = new RuntimeDouble();
      const input = new ScriptedInput('alice-password-1', 'alice-password-1');

      const result = await run(['users', 'add', 'Alice@Example.com'], { runtime, input });

      const alice = runtime.provider.userByEmail('alice@example.com');
      assert.equal(result.code, 0);
      assert.deepEqual(result.prompts, ['Password for the new account: ', 'Repeat the password: ']);
      assert.equal(result.output, `Added alice@example.com with ID ${alice?.id}.\n`);
      assert.equal(runtime.provider.credentials.get(alice?.id ?? ''), LocalProviderDouble.hashOf('alice-password-1'));
      assertRevealsNone(result);
    });

    test('Given passwords that do not match or input that ends, when users add runs, then it exits with status 1, adds no account, and reveals no password', async () => {
      const cases = [
        { input: new ScriptedInput('alice-password-1', 'alice-password-2'), message: 'The passwords do not match.' },
        { input: new ScriptedInput(undefined), message: 'No password was entered.' },
        { input: new ScriptedInput('alice-password-1', undefined), message: 'No password was entered.' },
      ];

      for (const { input, message } of cases) {
        const runtime = new RuntimeDouble();

        const result = await run(['users', 'add', 'alice@example.com'], { runtime, input });

        assert.equal(result.code, 1);
        assert.equal(result.errors, message);
        assert.equal(runtime.provider.users.size, 0);
        assertRevealsNone(result);
      }
    });

    test('Given an existing email, when users add runs for it, then it exits with status 1 before it asks for a password', async () => {
      const runtime = new RuntimeDouble();
      runtime.provider.addUser('alice@example.com', 'alice-password-1');

      const result = await run(['users', 'add', 'ALICE@example.com'], { runtime, input: new ScriptedInput('alice-password-2', 'alice-password-2') });

      assert.equal(result.code, 1);
      assert.equal(result.errors, 'An account with this email address already exists.');
      assert.deepEqual([result.output, result.prompts], ['', []]);
    });

    test('Given enabled and disabled accounts, when users list runs, then it prints a table of email, state, and ID without credentials and asks for no password', async () => {
      const runtime = new RuntimeDouble();
      const bob = runtime.provider.addUser('bob@example.com', 'bob-password-1', true);
      const alice = runtime.provider.addUser('alice@example.com', 'alice-password-1');

      const result = await run(['users', 'list'], { runtime });

      assert.equal(result.code, 0);
      assert.equal(result.output, [
        `EMAIL              STATE     ID`,
        `alice@example.com  enabled   ${alice.id}`,
        `bob@example.com    disabled  ${bob.id}`,
        '',
      ].join('\n'));
      assert.deepEqual(result.prompts, []);
      assertRevealsNone(result, [...passwords, 'provider-hash']);
    });

    test('Given no account, when users list runs, then it says how to add the first account', async () => {
      const result = await run(['users', 'list']);

      assert.equal(result.code, 0);
      assert.equal(result.output, 'No local accounts. Add one with: magumagu users add <email>\n');
    });

    test('Given two users with sessions, when users reset-password targets one, then it asks for the new password two times, ends only that user\'s sessions, keeps its ID and state, and reveals no password', async () => {
      const runtime = new RuntimeDouble();
      const alice = runtime.provider.addUser('alice@example.com', 'alice-password-1');
      const bob = runtime.provider.addUser('bob@example.com', 'bob-password-1');
      for (const user of [alice, bob]) runtime.provider.startSession(user.id);

      const result = await run(['users', 'reset-password', 'alice@example.com'], { runtime, input: new ScriptedInput('alice-password-2', 'alice-password-2') });

      assert.equal(result.code, 0);
      assert.deepEqual(result.prompts, ['New password: ', 'Repeat the new password: ']);
      assert.equal(result.output, 'Reset the password of alice@example.com and ended its sessions.\n');
      assert.equal(runtime.provider.credentials.get(alice.id), LocalProviderDouble.hashOf('alice-password-2'));
      assert.deepEqual([runtime.provider.sessionsOf(alice.id).length, runtime.provider.sessionsOf(bob.id).length], [0, 1]);
      assert.deepEqual([...runtime.provider.users.values()].map(({ id, banned }) => ({ id, banned })), [{ id: alice.id, banned: null }, { id: bob.id, banned: null }]);
      assertRevealsNone(result);
    });

    test('Given a disabled user, when users reset-password targets it, then it says that the account stays disabled', async () => {
      const runtime = new RuntimeDouble();
      const dana = runtime.provider.addUser('dana@example.com', 'dana-password-1', true);

      const result = await run(['users', 'reset-password', 'dana@example.com'], { runtime, input: new ScriptedInput('dana-password-2', 'dana-password-2') });

      assert.equal(result.code, 0);
      assert.equal(result.output, 'Reset the password of dana@example.com and ended its sessions. The account stays disabled.\n');
      assert.equal(runtime.provider.users.get(dana.id)?.banned, true);
    });

    test('Given two users with sessions, when users disable targets one, then only that user is disabled and loses its sessions, without a password prompt', async () => {
      const runtime = new RuntimeDouble();
      const alice = runtime.provider.addUser('alice@example.com', 'alice-password-1');
      const bob = runtime.provider.addUser('bob@example.com', 'bob-password-1');
      for (const user of [alice, bob]) runtime.provider.startSession(user.id);

      const result = await run(['users', 'disable', 'bob@example.com'], { runtime });

      assert.equal(result.code, 0);
      assert.equal(result.output, 'Disabled bob@example.com and ended its sessions.\n');
      assert.deepEqual(result.prompts, []);
      assert.deepEqual([runtime.provider.users.get(alice.id)?.banned, runtime.provider.users.get(bob.id)?.banned], [null, true]);
      assert.deepEqual([runtime.provider.sessionsOf(alice.id).length, runtime.provider.sessionsOf(bob.id).length], [1, 0]);
    });

    test('Given an unknown email, when users reset-password or users disable targets it, then it exits with status 1, asks for no password, and does not repeat the email', async () => {
      for (const action of ['reset-password', 'disable']) {
        const runtime = new RuntimeDouble();
        runtime.provider.addUser('alice@example.com', 'alice-password-1');

        const result = await run(['users', action, 'carol@example.com'], { runtime, input: new ScriptedInput('carol-password-1', 'carol-password-1') });

        assert.equal(result.code, 1);
        assert.equal(result.errors, 'No local account has this email address.');
        assert.deepEqual([result.output, result.prompts], ['', []]);
      }
    });
  });

  describe('clients', () => {
    test('Given an enabled account, when clients register runs with its exact redirect URIs, then it asks for the account password one time, registers the approved native client, deletes the registration session, and prints the client ID', async () => {
      const runtime = new RuntimeDouble();
      const alice = runtime.provider.addUser('alice@example.com', 'alice-password-1');
      const secondRedirectUri = 'http://localhost:6274/oauth/callback';

      const result = await run([
        'clients', 'register',
        '--user', 'alice@example.com',
        '--name', 'Native MCP client',
        '--redirect-uri', loopbackRedirectUri,
        `--redirect-uri=${secondRedirectUri}`,
      ], { runtime, input: new ScriptedInput('alice-password-1') });

      const [client] = runtime.provider.clients;
      assert.equal(result.code, 0);
      assert.deepEqual(result.prompts, ['Password of the account: ']);
      assert.equal(result.output, `Registered the client "Native MCP client" with client ID ${client?.clientId}.\n`);
      assert.deepEqual(client?.metadata.redirect_uris, [loopbackRedirectUri, secondRedirectUri]);
      assert.equal(client?.metadata.token_endpoint_auth_method, 'none');
      assert.deepEqual(runtime.provider.sessionsOf(alice.id), []);
      assertRevealsNone(result);
    });

    test('Given a redirect URI outside the approved loopback form, when clients register runs, then it exits with status 1, asks for no password, registers nothing, and does not repeat the URI', async () => {
      const runtime = new RuntimeDouble();
      runtime.provider.addUser('alice@example.com', 'alice-password-1');

      const result = await run([
        'clients', 'register', '--user', 'alice@example.com', '--name', 'Native MCP client', '--redirect-uri', 'https://client.example/callback',
      ], { runtime, input: new ScriptedInput('alice-password-1') });

      assert.equal(result.code, 1);
      assert.doesNotMatch(result.errors, /client\.example/);
      assert.match(result.errors, /redirect URI/);
      assert.deepEqual([result.output, result.prompts, runtime.provider.clients], ['', [], []]);
    });

    test('Given a wrong password or end of input, when clients register runs, then it exits with status 1, registers nothing, and leaves no session', async () => {
      const cases = [
        { input: new ScriptedInput('wrong-password-1'), message: 'The password is not correct.' },
        { input: new ScriptedInput(undefined), message: 'No password was entered.' },
      ];

      for (const { input, message } of cases) {
        const runtime = new RuntimeDouble();
        runtime.provider.addUser('alice@example.com', 'alice-password-1');

        const result = await run([
          'clients', 'register', '--user', 'alice@example.com', '--name', 'Native MCP client', '--redirect-uri', loopbackRedirectUri,
        ], { runtime, input });

        assert.equal(result.code, 1);
        assert.equal(result.errors, message);
        assert.deepEqual([runtime.provider.clients.length, runtime.provider.sessions.size], [0, 0]);
        assertRevealsNone(result, [...passwords, 'wrong-password-1']);
      }
    });
  });
});
