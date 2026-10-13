import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { workOSSettings } from '../../support/hosted-placeholder.ts';
import { assertRevealsNone, loopbackRedirectUri, run, AdministrationOpenerDouble, ScriptedInput } from './fixtures/local-auth-command-harness.ts';

describe('runLocalAuthCommand with configuration and administration', () => {
  describe('command line', () => {
    test('Given an unknown command, when it runs, then it exits with status 2, prints the usage without the arguments, and opens no data', async () => {
      for (const args of [['users'], ['users', 'promote', 'alice@example.com'], ['clients', 'list'], ['serve', 'immediately'], ['--help']]) {
        const opener = new AdministrationOpenerDouble();

        const result = await run(args, { opener });

        assert.equal(result.code, 2, args.join(' '));
        assert.match(result.errors, /^Unknown command\./);
        assert.match(result.errors, /magumagu users add <email>/);
        assert.doesNotMatch(result.errors, /promote|alice@example\.com|immediately/);
        assert.deepEqual([result.output, opener.events, result.prompts], ['', [], []]);
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
        const opener = new AdministrationOpenerDouble();

        const result = await run(args, { opener });

        assert.equal(result.code, 2, args.join(' '));
        assert.match(result.errors, /Usage:/);
        assert.doesNotMatch(result.errors, /alice@example\.com|bob@example\.com/);
        assertRevealsNone(result);
        assert.deepEqual([result.output, opener.events, result.prompts], ['', [], []]);
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
        const opener = new AdministrationOpenerDouble();

        const result = await run(['clients', 'register', ...options], { opener });

        assert.equal(result.code, 2, options.join(' '));
        assert.match(result.errors, /Usage:/);
        assert.doesNotMatch(result.errors, /alice@example\.com|bob@example\.com|127\.0\.0\.1:33418/);
        assertRevealsNone(result);
        assert.deepEqual([result.output, opener.events], ['', []]);
      }
    });
  });

  describe('configuration and lifecycle', () => {
    test('Given the self-hosted settings, when a command runs, then it opens administration for the configured data directory and public URLs and closes it after the command', async () => {
      const opener = new AdministrationOpenerDouble();

      const result = await run(['users', 'list'], { opener });

      assert.equal(result.code, 0);
      assert.deepEqual(opener.settings.map(({ dataDirectory, publicBaseUrl, mcpResourceUrl }) => ({ dataDirectory, publicBaseUrl, mcpResourceUrl })), [{
        dataDirectory: '/var/lib/magumagu',
        publicBaseUrl: 'http://localhost:8080/',
        mcpResourceUrl: 'http://localhost:8080/mcp',
      }]);
      assert.deepEqual(opener.events, ['open', 'close']);
    });

    test('Given missing settings or the hosted deployment, when a command runs, then it exits with status 1 and a safe message and opens no data', async () => {
      const cases: { readonly settings: Record<string, string>; readonly message: RegExp }[] = [
        { settings: { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: 'http://localhost:8080' }, message: /DATA_DIR is required/ },
        { settings: { PUBLIC_BASE_URL: 'http://localhost:8080', DATA_DIR: '/var/lib/magumagu' }, message: /DEPLOYMENT must be set/ },
        { settings: { DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://magumagu.example' }, message: /only for DEPLOYMENT=self-hosted/ },
        { settings: { DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://magumagu.example', ...workOSSettings }, message: /only for DEPLOYMENT=self-hosted/ },
      ];

      for (const { settings, message } of cases) {
        const opener = new AdministrationOpenerDouble();

        const result = await run(['users', 'list'], { opener, environment: settings });

        assert.equal(result.code, 1);
        assert.match(result.errors, message);
        assert.doesNotMatch(result.errors, /workos-api-key-placeholder|cookie-password-placeholder/);
        assert.deepEqual([result.output, opener.events], ['', []]);
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
        const opener = new AdministrationOpenerDouble();
        opener.openFailure = Object.assign(new Error('The data directory is in use by another Magumagu process. Stop that process, then try again.'), { name: 'DataDirectoryInUseError' });

        const result = await run(args, { opener, input: new ScriptedInput('alice-password-1', 'alice-password-1') });

        assert.equal(result.code, 1, args.join(' '));
        assert.equal(result.errors, 'The data directory is in use by another Magumagu process. Stop that process, then try again.');
        assert.deepEqual([result.output, result.prompts, opener.events], ['', [], ['open']]);
      }
    });

    test('Given a command that fails, when it runs, then administration still closes and the command exits with status 1', async () => {
      const opener = new AdministrationOpenerDouble();

      const result = await run(['users', 'disable', 'carol@example.com'], { opener });

      assert.equal(result.code, 1);
      assert.deepEqual(opener.events, ['open', 'close']);
    });

    test('Given administration that fails to close after the command, when the command runs, then the command result and the close failure are both reported and it exits with status 1', async () => {
      const opener = new AdministrationOpenerDouble();
      opener.closeFailure = new Error('The database did not close.');
      opener.provider.addUser('alice@example.com', 'alice-password-1');

      const result = await run(['users', 'disable', 'alice@example.com'], { opener });

      assert.equal(result.code, 1);
      assert.match(result.output, /^Disabled alice@example\.com/);
      assert.equal(result.errors, 'The database did not close.');
    });

    test('Given a command failure and administration that fails to close, when the command runs, then the message names both failures', async () => {
      const opener = new AdministrationOpenerDouble();
      opener.closeFailure = new Error('The database did not close.');

      const result = await run(['users', 'disable', 'carol@example.com'], { opener });

      assert.equal(result.code, 1);
      assert.equal(result.errors, 'No local account has this email address. The cleanup after this failure also failed: The database did not close.');
    });
  });
});
