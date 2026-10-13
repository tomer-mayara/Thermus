import { randomBytes, randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATABASE_FILE = 'auth.sqlite';
const SECRET_FILE = 'auth.secret';
const RESOURCE_SERVER_CLIENT_FILE = 'resource-server-client.json';
const MIGRATIONS = ['0001-better-auth.sql', '0002-installation.sql'];
const SCHEMA_VERSION = MIGRATIONS.length;
const OWNER_ONLY = 0o600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const GENERATED_SECRET = /^[A-Za-z0-9_-]{43}$/;

export interface StoredResourceServerClient {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly resource: string;
}

export interface LocalInstallation {
  readonly id: string;
  readonly secret: string;
  readonly database: DatabaseSync;
  // Gives undefined when the data directory has no resource-server client.
  readResourceServerClient(): StoredResourceServerClient | undefined;
  // Replaces a stored client. The client is durable when this returns.
  writeResourceServerClient(client: StoredResourceServerClient): void;
  close(): void;
}

export class LocalInstallationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalInstallationError';
  }
}

interface InstallationIdentity {
  readonly id: string;
  readonly secret: string;
}

export function openLocalInstallation(directory: string): LocalInstallation {
  const database = openOwnerOnlyDatabase(join(directory, DATABASE_FILE));
  try {
    const identity = hasSchema(database) ? retainedIdentity(database, directory) : newIdentity(database, directory);
    return {
      ...identity,
      database,
      readResourceServerClient: () => readResourceServerClient(directory),
      writeResourceServerClient: (client) => writeResourceServerClient(directory, client),
      close: () => {
        if (database.isOpen) database.close();
      },
    };
  } catch (error) {
    database.close();
    throw error;
  }
}

function openOwnerOnlyDatabase(path: string): DatabaseSync {
  try {
    closeSync(openSync(path, 'wx', OWNER_ONLY));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  return new DatabaseSync(path);
}

function hasSchema(database: DatabaseSync): boolean {
  return Number(database.prepare('SELECT count(*) AS "objects" FROM sqlite_schema').get()?.objects) > 0;
}

function retainedIdentity(database: DatabaseSync, directory: string): InstallationIdentity {
  const id = storedInstallationId(database);
  if (id === undefined) throw missingIdentity();
  const version = Number(database.prepare('PRAGMA user_version').get()?.user_version);
  if (version !== SCHEMA_VERSION) throw unsupportedSchemaVersion(version);
  const secret = readSecret(directory);
  if (secret === undefined) throw missingSecret();
  return { id, secret };
}

function storedInstallationId(database: DatabaseSync): string | undefined {
  const table = database.prepare(`SELECT 1 FROM sqlite_schema WHERE "type" = 'table' AND "name" = 'magumagu_installation'`).get();
  if (table === undefined) return undefined;
  const id = database.prepare('SELECT "id" FROM "magumagu_installation"').get()?.id;
  return typeof id === 'string' && UUID.test(id) ? id : undefined;
}

// The secret is durable before the commit, so an interrupted first start leaves a secret that the next start uses.
function newIdentity(database: DatabaseSync, directory: string): InstallationIdentity {
  const secret = readSecret(directory) ?? writeNewSecret(directory);
  const id = randomUUID();
  inTransaction(database, () => {
    for (const migration of MIGRATIONS) database.exec(readMigration(migration));
    database.prepare('INSERT INTO "magumagu_installation" ("singleton", "id") VALUES (1, ?)').run(id);
    database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
  return { id, secret };
}

function inTransaction(database: DatabaseSync, work: () => void): void {
  database.exec('BEGIN IMMEDIATE');
  try {
    work();
    database.exec('COMMIT');
  } catch (error) {
    if (database.isTransaction) database.exec('ROLLBACK');
    throw error;
  }
}

function readMigration(name: string): string {
  return readFileSync(new URL(import.meta.resolve(`#auth-local-migrations/${name}`)), 'utf8');
}

function readSecret(directory: string): string | undefined {
  const content = readFileIfPresent(join(directory, SECRET_FILE));
  if (content === undefined) return undefined;
  const secret = content.endsWith('\n') ? content.slice(0, -1) : content;
  if (!GENERATED_SECRET.test(secret)) throw invalidSecret();
  return secret;
}

function writeNewSecret(directory: string): string {
  const secret = randomBytes(32).toString('base64url');
  replaceOwnerOnlyFile(directory, SECRET_FILE, `${secret}\n`);
  return secret;
}

function readResourceServerClient(directory: string): StoredResourceServerClient | undefined {
  const content = readFileIfPresent(join(directory, RESOURCE_SERVER_CLIENT_FILE));
  if (content === undefined) return undefined;
  const client = storedClientOf(parsedJson(content));
  if (client === undefined) throw invalidResourceServerClient();
  return client;
}

function writeResourceServerClient(directory: string, { clientId, clientSecret, resource }: StoredResourceServerClient): void {
  replaceOwnerOnlyFile(directory, RESOURCE_SERVER_CLIENT_FILE, `${JSON.stringify({ clientId, clientSecret, resource })}\n`);
}

// A parse error can quote the content, and the content has the client secret, so the error is not kept.
function parsedJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

function storedClientOf(value: unknown): StoredResourceServerClient | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { clientId, clientSecret, resource } = value as Record<string, unknown>;
  return isFilledString(clientId) && isFilledString(clientSecret) && isFilledString(resource) && URL.canParse(resource)
    ? { clientId, clientSecret, resource }
    : undefined;
}

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function readFileIfPresent(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

// The rename replaces the file in one step, and the sync of the directory makes the rename durable.
function replaceOwnerOnlyFile(directory: string, name: string, content: string): void {
  const path = join(directory, name);
  const temporary = `${path}.new`;
  rmSync(temporary, { force: true });
  writeFileSync(temporary, content, { mode: OWNER_ONLY, flag: 'wx', flush: true });
  renameSync(temporary, path);
  syncDirectory(directory);
}

function syncDirectory(directory: string): void {
  const descriptor = openSync(directory, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function missingIdentity(): LocalInstallationError {
  return new LocalInstallationError(
    'The data directory has authentication data but no valid installation identity. '
      + 'Magumagu does not create a new identity for retained data. '
      + 'Restore the complete data directory from a backup, or move the data away to start a new installation.',
  );
}

function unsupportedSchemaVersion(version: number): LocalInstallationError {
  return new LocalInstallationError(
    `The authentication database has schema version ${version}, but this Magumagu version uses schema version ${SCHEMA_VERSION}. `
      + 'Use the Magumagu version that created the data, or restore a backup for this version.',
  );
}

function missingSecret(): LocalInstallationError {
  return new LocalInstallationError(
    `The data directory has authentication data but no ${SECRET_FILE} file. `
      + `Restore the database and ${SECRET_FILE} together from the same backup.`,
  );
}

function invalidSecret(): LocalInstallationError {
  return new LocalInstallationError(
    `The ${SECRET_FILE} file in the data directory is not valid. Restore it from the same backup as the database.`,
  );
}

function invalidResourceServerClient(): LocalInstallationError {
  return new LocalInstallationError(
    `The ${RESOURCE_SERVER_CLIENT_FILE} file in the data directory is not valid. `
      + 'Restore the complete data directory from a backup, or remove the file and run magumagu clients register again.',
  );
}
