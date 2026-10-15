import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runLocalAuthCommand, type LocalAuthCommandContext } from '../../../src/auth/local-auth/local-auth-command.ts';
import type { LocalUserAdministration } from '../../../src/auth/local-auth/local-user-administration.ts';
import { BaseLogger } from '../../../src/logging/base-logger.ts';

const environment = { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: 'http://localhost:8080', DATA_DIR: '/var/lib/thermus' };
const account = { id: 'account-id', email: 'alice@example.com', disabled: false };
const password = 'account-password';

function harness(failures: { operation?: Error; output?: Error; close?: Error; open?: Error } = {}) {
  const events: string[] = [];
  const errors: string[] = [];
  let output = '';
  const administration: LocalUserAdministration = {
    addUser: async (email, source) => {
      events.push('add'); assert.equal(email, account.email); assert.equal(await source(), password); return account;
    },
    listUsers: async () => { events.push('list'); if (failures.operation) throw failures.operation; return [account]; },
    resetPassword: async (email, source) => {
      events.push('reset'); assert.equal(email, account.email); assert.equal(await source(), password); return account;
    },
    disableUser: async (email) => { events.push('disable'); assert.equal(email, account.email); return { ...account, disabled: true }; },
    registerClient: async (email, source, client) => {
      events.push('register'); assert.equal(email, account.email); assert.equal(await source(), password);
      assert.deepEqual(client, { name: 'Native client', redirectUris: ['http://localhost:3333/callback'] });
      return { ...client, clientId: 'client-id', resourceServerClientRegistered: true };
    },
  };
  const context: LocalAuthCommandContext = {
    environment,
    input: { readHiddenLine: async () => { events.push('password'); return password; } },
    logger: { error: (failure) => { errors.push(BaseLogger.messageOf(failure)); } },
    output: { write: (text) => { events.push('output'); if (failures.output) throw failures.output; output += text; } },
    openAdministration: async (settings) => {
      events.push('open');
      assert.equal(settings.dataDirectory, environment.DATA_DIR);
      assert.equal(settings.publicBaseUrl, 'http://localhost:8080/');
      assert.equal(settings.mcpResourceUrl, 'http://localhost:8080/mcp');
      if (failures.open) throw failures.open;
      return { administration, close: async () => { events.push('close'); if (failures.close) throw failures.close; } };
    },
  };
  return { context, events, errors, output: () => output };
}

test('Given only a five-operation administration role and close, when each local command runs, then it dispatches the operation with lazy input, writes its result, and closes', async () => {
  const cases = [
    { args: ['users', 'add', account.email], operation: 'add', prompts: 2, output: /Added alice@example.com/ },
    { args: ['users', 'list'], operation: 'list', prompts: 0, output: /EMAIL.*STATE.*ID/ },
    { args: ['users', 'reset-password', account.email], operation: 'reset', prompts: 2, output: /Reset the password/ },
    { args: ['users', 'disable', account.email], operation: 'disable', prompts: 0, output: /Disabled alice@example.com/ },
    { args: ['clients', 'register', '--user', account.email, '--name', 'Native client', '--redirect-uri', 'http://localhost:3333/callback'], operation: 'register', prompts: 1, output: /Registered the resource-server client/ },
  ];
  for (const { args, operation, prompts, output } of cases) {
    const run = harness();
    assert.equal(await runLocalAuthCommand(args, run.context), 0);
    assert.deepEqual(run.events, ['open', operation, ...Array<string>(prompts).fill('password'), 'output', 'close']);
    assert.match(run.output(), output);
    assert.doesNotMatch(run.output(), new RegExp(password));
    assert.deepEqual(run.errors, []);
  }
});

test('Given an output failure, when a command writes its result, then it still closes and reports the output error, with a cleanup error when present', async () => {
  for (const close of [undefined, new Error('close failed')]) {
    const run = harness({ output: new Error('output failed'), close });
    assert.equal(await runLocalAuthCommand(['users', 'list'], run.context), 1);
    assert.deepEqual(run.events, ['open', 'list', 'output', 'close']);
    assert.equal(run.output(), '');
    assert.deepEqual(run.errors, [close ? 'output failed The cleanup after this failure also failed: close failed' : 'output failed']);
  }
});

test('Given an operation or close failure, when a command runs, then it preserves output-before-close and reports both errors when present', async () => {
  for (const operation of [undefined, new Error('operation failed')]) {
    const run = harness({ operation, close: new Error('close failed') });
    assert.equal(await runLocalAuthCommand(['users', 'list'], run.context), 1);
    assert.deepEqual(run.events, operation ? ['open', 'list', 'close'] : ['open', 'list', 'output', 'close']);
    assert.deepEqual(run.errors, [operation ? 'operation failed The cleanup after this failure also failed: close failed' : 'close failed']);
  }
});

test('Given an opener with primary and cleanup failures, when a command runs, then it reports both and never invokes the role or claims ownership of close', async () => {
  const run = harness({ open: new SuppressedError(new Error('opening cleanup failed'), new Error('opening failed')) });
  assert.equal(await runLocalAuthCommand(['users', 'list'], run.context), 1);
  assert.deepEqual(run.events, ['open']);
  assert.deepEqual(run.errors, ['opening failed The cleanup after this failure also failed: opening cleanup failed']);
  assert.equal(run.output(), '');
});
