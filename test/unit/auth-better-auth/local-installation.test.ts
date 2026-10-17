import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import {
  LocalInstallationError,
  openLocalInstallation,
  type LocalInstallation,
} from '../../../src/auth/local-auth/better-auth/local-installation.ts';
import { changeDatabase, dataDirectory, storedInstallationIds } from '../../support/isolation/data-directory.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const generatedSecret = /^[A-Za-z0-9_-]{43}$/;
const missingIdentity = 'The data directory has authentication data but no valid installation identity. '
  + 'Thermus does not create a new identity for retained data. '
  + 'Restore the complete data directory from a backup, or move the data away to start a new installation.';
const invalidResourceServerClient = 'The resource-server-client.json file in the data directory is not valid. '
  + 'Restore the complete data directory from a backup, or remove the file and run thermus clients register again.';
const resourceServerClient = {
  clientId: 'resource-server-client-id',
  clientSecret: 'resource-server-client-secret',
  resource: 'http://localhost:8080/mcp',
};

function opened(t: TestContext, directory: string): LocalInstallation {
  const installation = openLocalInstallation(directory);
  t.after(() => installation.close());
  return installation;
}

function initializedDirectory(t: TestContext) {
  const directory = dataDirectory(t);
  const installation = openLocalInstallation(directory);
  installation.close();
  return { directory, installation };
}

function databaseSnapshot(directory: string): string {
  const database = new DatabaseSync(join(directory, 'auth.sqlite'), { readOnly: true });
  try {
    const objects = database.prepare('SELECT "type", "name" FROM sqlite_schema ORDER BY "name"').all();
    const version = database.prepare('PRAGMA user_version').get();
    return JSON.stringify({ objects, version });
  } finally {
    database.close();
  }
}

function installationFailure(work: () => unknown): string {
  let message = '';
  assert.throws(work, (error) => {
    assert.ok(error instanceof LocalInstallationError, String(error));
    message = error.message;
    return true;
  });
  return message;
}

function rejection(directory: string): string {
  return installationFailure(() => openLocalInstallation(directory));
}

function fileMode(path: string): number {
  return statSync(path).mode & 0o777;
}

function clientFile(directory: string): string {
  return join(directory, 'resource-server-client.json');
}

test('Given an empty data directory, when the installation opens, then it creates one installation identity, a generated secret, and the migrated database, with owner-only files', (t) => {
  const directory = dataDirectory(t);

  const installation = opened(t, directory);

  assert.match(installation.id, uuid);
  assert.match(installation.secret, generatedSecret);
  assert.equal(readFileSync(join(directory, 'auth.secret'), 'utf8'), `${installation.secret}\n`);
  assert.deepEqual([fileMode(join(directory, 'auth.sqlite')), fileMode(join(directory, 'auth.secret'))], [0o600, 0o600]);
  const tables = installation.database.prepare(`SELECT "name" FROM sqlite_schema WHERE "type" = 'table'`).all().map(({ name }) => name);
  assert.deepEqual(storedInstallationIds(directory), [installation.id]);
  assert.ok(tables.includes('user') && tables.includes('jwks') && tables.includes('oauthClient'), tables.join(', '));
  assert.equal(installation.database.prepare('PRAGMA user_version').get()?.user_version, 2);
  assert.deepEqual(readdirSync(directory).sort(), ['auth.secret', 'auth.sqlite']);
});

test('Given an initialized data directory, when the installation opens again, then it keeps the same identity and secret', (t) => {
  const { directory, installation: first } = initializedDirectory(t);

  const second = opened(t, directory);

  assert.deepEqual([second.id, second.secret], [first.id, first.secret]);
});

test('Given two fresh data directories, when each installation opens, then each gets its own identity and secret', (t) => {
  const first = opened(t, dataDirectory(t));
  const second = opened(t, dataDirectory(t));

  assert.notEqual(first.id, second.id);
  assert.notEqual(first.secret, second.secret);
});

test('Given an open installation, when it closes two times, then its database is closed and the second close does nothing', (t) => {
  const installation = openLocalInstallation(dataDirectory(t));

  installation.close();
  installation.close();

  assert.equal(installation.database.isOpen, false);
});

const lostIdentities: ReadonlyArray<[string, string]> = [
  ['a deleted identity row', 'DELETE FROM "thermus_installation"'],
  ['a dropped identity table', 'DROP TABLE "thermus_installation"'],
  ['an identity that is not a UUID', `UPDATE "thermus_installation" SET "id" = 'not-a-uuid'`],
];
for (const [label, sql] of lostIdentities) {
  test(`Given retained data with ${label}, when the installation opens, then it fails closed, asks for a restore, and changes no data`, (t) => {
    const { directory } = initializedDirectory(t);
    changeDatabase(directory, sql);
    const before = databaseSnapshot(directory);
    const secret = readFileSync(join(directory, 'auth.secret'), 'utf8');

    assert.equal(rejection(directory), missingIdentity);

    assert.equal(databaseSnapshot(directory), before);
    assert.equal(readFileSync(join(directory, 'auth.secret'), 'utf8'), secret);
  });
}

test('Given a database with provider tables but no Thermus schema, when the installation opens, then it fails closed and adds no identity', (t) => {
  const directory = dataDirectory(t);
  changeDatabase(directory, 'CREATE TABLE "user" ("id" text not null primary key)');

  assert.equal(rejection(directory), missingIdentity);

  assert.deepEqual(readdirSync(directory), ['auth.sqlite']);
  assert.match(databaseSnapshot(directory), /"name":"user"/);
});

test('Given retained data without its secret file, when the installation opens, then it fails closed and writes no new secret', (t) => {
  const { directory } = initializedDirectory(t);
  rmSync(join(directory, 'auth.secret'));

  assert.equal(
    rejection(directory),
    'The data directory has authentication data but no auth.secret file. Restore the database and auth.secret together from the same backup.',
  );

  assert.deepEqual(readdirSync(directory), ['auth.sqlite']);
});

for (const content of ['', 'short\n', `${'a'.repeat(42)} \n`, `${'a'.repeat(43)}\n${'b'.repeat(43)}\n`]) {
  test(`Given retained data with the secret file content ${JSON.stringify(content)}, when the installation opens, then it fails closed without the secret in the message`, (t) => {
    const { directory } = initializedDirectory(t);
    writeFileSync(join(directory, 'auth.secret'), content);

    const message = rejection(directory);

    assert.equal(message, 'The auth.secret file in the data directory is not valid. Restore it from the same backup as the database.');
    assert.equal(readFileSync(join(directory, 'auth.secret'), 'utf8'), content);
  });
}

test('Given a database from another schema version, when the installation opens, then it fails closed and names both versions', (t) => {
  const { directory } = initializedDirectory(t);
  changeDatabase(directory, 'PRAGMA user_version = 3');

  assert.equal(
    rejection(directory),
    'The authentication database has schema version 3, but this Thermus version uses schema version 2. '
      + 'Use the Thermus version that created the data, or restore a backup for this version.',
  );
});

test('Given a secret file and an empty database from an interrupted first start, when the installation opens, then it initializes a new identity and keeps that secret', (t) => {
  const directory = dataDirectory(t);
  const secret = 'Ab3_dE6-gH9iJ2kL5mN8oP1qR4sT7uV0wX3yZ6aB9cD';
  writeFileSync(join(directory, 'auth.secret'), `${secret}\n`, { mode: 0o600 });
  writeFileSync(join(directory, 'auth.sqlite'), '');

  const installation = opened(t, directory);

  assert.match(installation.id, uuid);
  assert.equal(installation.secret, secret);
});

test('Given an open installation, when it writes the resource-server client, then it reads the same client back from an owner-only file that has only that client, and no temporary file stays', (t) => {
  const directory = dataDirectory(t);
  const installation = opened(t, directory);

  installation.writeResourceServerClient(resourceServerClient);

  assert.deepEqual(installation.readResourceServerClient(), resourceServerClient);
  assert.equal(
    readFileSync(clientFile(directory), 'utf8'),
    '{"clientId":"resource-server-client-id","clientSecret":"resource-server-client-secret","resource":"http://localhost:8080/mcp"}\n',
  );
  assert.equal(fileMode(clientFile(directory)), 0o600);
  assert.deepEqual(readdirSync(directory).sort(), ['auth.secret', 'auth.sqlite', 'resource-server-client.json']);
});

test('Given a stored resource-server client, when the installation writes another client, then the other client replaces it, also after the installation opens again', (t) => {
  const directory = dataDirectory(t);
  const first = openLocalInstallation(directory);
  first.writeResourceServerClient(resourceServerClient);
  const replacement = { clientId: 'replacement-client-id', clientSecret: 'replacement-client-secret', resource: 'http://localhost:9090/mcp' };

  first.writeResourceServerClient(replacement);
  first.close();

  assert.deepEqual(opened(t, directory).readResourceServerClient(), replacement);
});

test('Given a temporary file from an interrupted write, when the installation writes the resource-server client, then the write completes and no temporary file stays', (t) => {
  const directory = dataDirectory(t);
  const installation = opened(t, directory);
  writeFileSync(`${clientFile(directory)}.new`, '{"clientId":"partial');

  installation.writeResourceServerClient(resourceServerClient);

  assert.deepEqual(installation.readResourceServerClient(), resourceServerClient);
  assert.deepEqual(readdirSync(directory).sort(), ['auth.secret', 'auth.sqlite', 'resource-server-client.json']);
});

test('Given a data directory without a resource-server client file, when the installation reads the client, then it gets none and writes no file', (t) => {
  const directory = dataDirectory(t);
  const installation = opened(t, directory);

  assert.equal(installation.readResourceServerClient(), undefined);

  assert.deepEqual(readdirSync(directory).sort(), ['auth.secret', 'auth.sqlite']);
});

const storedSecret = 'stored-client-secret-value';
const invalidClientFiles: ReadonlyArray<[string, string]> = [
  ['no content', ''],
  ['content that is not complete JSON', `{"clientId":"resource-server-client-id","clientSecret":"${storedSecret}"`],
  ['a JSON value that is not an object', `["resource-server-client-id","${storedSecret}"]`],
  ['a null JSON value', 'null'],
  ['no client ID', JSON.stringify({ clientSecret: storedSecret, resource: resourceServerClient.resource })],
  ['an empty client ID', JSON.stringify({ ...resourceServerClient, clientId: '', clientSecret: storedSecret })],
  ['a client secret that is not a string', JSON.stringify({ ...resourceServerClient, clientSecret: 42 })],
  ['an empty client secret', JSON.stringify({ ...resourceServerClient, clientSecret: '' })],
  ['no resource', JSON.stringify({ clientId: resourceServerClient.clientId, clientSecret: storedSecret })],
  ['a resource that is not a URL', JSON.stringify({ ...resourceServerClient, clientSecret: storedSecret, resource: 'not a URL' })],
];
for (const [label, content] of invalidClientFiles) {
  test(`Given a resource-server client file with ${label}, when the installation reads the client, then it fails with a message that asks for a restore or a new registration, without the secret, and keeps the file`, (t) => {
    const directory = dataDirectory(t);
    const installation = opened(t, directory);
    writeFileSync(clientFile(directory), content, { mode: 0o600 });

    const message = installationFailure(() => installation.readResourceServerClient());

    assert.equal(message, invalidResourceServerClient);
    assert.ok(!message.includes(storedSecret), 'the message has the secret');
    assert.equal(readFileSync(clientFile(directory), 'utf8'), content);
  });
}

test('Given initialized data with a resource-server client file that is not valid, when the installation opens, then it opens with its identity and only the read of the client fails', (t) => {
  const { directory, installation: first } = initializedDirectory(t);
  writeFileSync(clientFile(directory), 'not JSON');

  const second = opened(t, directory);

  assert.deepEqual([second.id, second.secret], [first.id, first.secret]);
  assert.equal(installationFailure(() => second.readResourceServerClient()), invalidResourceServerClient);
});
