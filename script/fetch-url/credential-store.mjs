import { randomUUID } from 'node:crypto';
import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';

const MAX_CREDENTIAL_LENGTH = 65_536;
const MAX_RECORD_BYTES = 1_048_576;
const MAX_DATE = 8_640_000_000_000_000;
const BEARER = /^[A-Za-z0-9._~+/-]+=*$/;
const STORAGE_MESSAGE = 'OAuth credential storage is unavailable. Check its private files and permissions.';
const RECORD_MESSAGE = 'Saved OAuth credentials are invalid. Run --login to replace them, or --logout to remove them.';

export class OAuthStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OAuthStoreError';
  }
}

export async function withOAuthStore(profile, operation) {
  const binding = bindingOf(profile);
  let connection;
  let directory;
  try {
    directory = privateDirectory();
    const lock = join(directory, 'grant.lock');
    createPrivateFile(lock);
    const { DatabaseSync } = await import('node:sqlite');
    connection = new DatabaseSync(lock);
    connection.exec('PRAGMA journal_mode = MEMORY');
    connection.exec('BEGIN IMMEDIATE');
    removeTemporaryFiles(directory);
    privateFile(join(directory, 'grant.json'));
  } catch (error) {
    try { connection?.close(); } catch { throw new OAuthStoreError(STORAGE_MESSAGE); }
    if (error?.errcode === 5) throw new OAuthStoreError('Another Thermus OAuth operation is in progress. Try again after it ends.');
    if (error instanceof OAuthStoreError) throw error;
    throw new OAuthStoreError(STORAGE_MESSAGE);
  }
  let active = true;
  const grant = join(directory, 'grant.json');
  function owned(action) {
    if (!active) throw new OAuthStoreError('The OAuth store operation is closed.');
    try { return action(); } catch (error) {
      if (error instanceof OAuthStoreError) throw error;
      throw new OAuthStoreError(STORAGE_MESSAGE);
    }
  }
  const store = {
    read: () => owned(() => readRecord(grant, binding)),
    markLoginRequired: () => owned(() => replaceRecord(directory, grant, { version: 1, binding, status: 'login-required' })),
    saveReady: (value) => owned(() => {
      const tokens = readyOf(value);
      replaceRecord(directory, grant, { version: 1, binding, ...tokens });
    }),
    logout: () => owned(() => {
      if (!privateFile(grant)) return;
      unlinkSync(grant);
      syncDirectory(directory);
    }),
  };
  try {
    return await operation(store);
  } finally {
    active = false;
    try { connection.close(); } catch { throw new OAuthStoreError(STORAGE_MESSAGE); }
  }
}

function bindingOf(value) {
  if (!value || ['endpoint', 'issuer', 'clientId'].some((key) => typeof value[key] !== 'string' || value[key] === '')) {
    throw new OAuthStoreError('OAuth storage needs a configured endpoint, issuer, and public client.');
  }
  return { endpoint: value.endpoint, issuer: value.issuer, clientId: value.clientId };
}

function privateDirectory() {
  if (process.platform === 'win32' || typeof process.getuid !== 'function' || constants.O_NOFOLLOW === undefined) {
    throw new OAuthStoreError('OAuth storage requires private POSIX file permissions. Use explicit Bearer input on this platform.');
  }
  const base = process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state');
  if (!isAbsolute(base)) throw new OAuthStoreError('XDG_STATE_HOME must be an absolute path for OAuth storage.');
  ensureDirectory(base);
  const baseInfo = lstatSync(base);
  if (baseInfo.uid !== process.getuid() || (baseInfo.mode & 0o022) !== 0) throw new OAuthStoreError(STORAGE_MESSAGE);
  const application = join(base, 'thermus');
  ensureDirectory(application, true);
  const directory = join(application, 'mcp-fetch');
  ensureDirectory(directory, true);
  return directory;
}

function ensureDirectory(path, privateMode = false) {
  const parent = dirname(path);
  if (parent !== path) ensureDirectory(parent);
  let info = lstatSync(path, { throwIfNoEntry: false });
  if (!info) {
    try {
      mkdirSync(path, { mode: 0o700 });
      syncDirectory(parent);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    info = lstatSync(path);
  }
  requireDirectoryPermissions(info, privateMode);
}

function requireDirectoryPermissions(info, privateMode) {
  const uid = process.getuid();
  const unsafeWriter = (info.mode & 0o022) !== 0 && (info.mode & 0o1000) === 0;
  if (!info.isDirectory() || (info.uid !== uid && info.uid !== 0) || unsafeWriter) throw new OAuthStoreError(STORAGE_MESSAGE);
  if (privateMode && (info.uid !== uid || (info.mode & 0o7777) !== 0o700)) throw new OAuthStoreError(STORAGE_MESSAGE);
}

function privateFile(path) {
  const info = lstatSync(path, { throwIfNoEntry: false });
  if (!info) return false;
  requirePrivateFile(info);
  return true;
}

function requirePrivateFile(info) {
  if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o7777) !== 0o600) throw new OAuthStoreError(STORAGE_MESSAGE);
}

function createPrivateFile(path) {
  if (!privateFile(path)) {
    let fd;
    let created = false;
    try {
      fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      created = true;
      fsyncSync(fd);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
    if (created) syncDirectory(dirname(path));
  }
  if (!privateFile(path)) throw new OAuthStoreError(STORAGE_MESSAGE);
}

function removeTemporaryFiles(directory) {
  let removed = false;
  try {
    for (const name of readdirSync(directory)) {
      if (!/^\.grant-[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\.tmp$/.test(name)) continue;
      const path = join(directory, name);
      if (!privateFile(path)) continue;
      unlinkSync(path);
      removed = true;
    }
  } finally {
    if (removed) syncDirectory(directory);
  }
}

function readRecord(path, binding) {
  if (!privateFile(path)) return null;
  return recordOf(parsePrivateRecord(path), binding);
}

function parsePrivateRecord(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    requirePrivateFile(info);
    if (info.size > MAX_RECORD_BYTES) throw new OAuthStoreError(RECORD_MESSAGE);
    try { return JSON.parse(readFileSync(fd, 'utf8')); } catch { throw new OAuthStoreError(RECORD_MESSAGE); }
  } finally {
    closeSync(fd);
  }
}

function recordOf(record, binding) {
  if (!record || record.version !== 1 || !record.binding || Object.keys(record.binding).length !== 3
    || Object.keys(binding).some((key) => record.binding[key] !== binding[key])) {
    throw new OAuthStoreError(RECORD_MESSAGE);
  }
  if (record.status === 'login-required' && Object.keys(record).every((key) => ['version', 'binding', 'status'].includes(key))) {
    return { status: 'login-required' };
  }
  if (record.status !== 'ready' || !Object.keys(record).every((key) => ['version', 'binding', 'status', 'accessToken', 'refreshToken', 'scope', 'expiresAt'].includes(key))) {
    throw new OAuthStoreError(RECORD_MESSAGE);
  }
  return readyOf(record);
}

// eslint-disable-next-line complexity -- Keep the field checks together as one rule that admits stored credentials.
function readyOf(value) {
  if (!value || !credential(value.accessToken) || (value.refreshToken !== undefined && !credential(value.refreshToken))
    || (value.scope !== undefined && (typeof value.scope !== 'string' || value.scope.length > MAX_CREDENTIAL_LENGTH))
    || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= 0 || value.expiresAt > MAX_DATE) {
    throw new OAuthStoreError(RECORD_MESSAGE);
  }
  return {
    status: 'ready', accessToken: value.accessToken,
    ...(value.refreshToken === undefined ? {} : { refreshToken: value.refreshToken }),
    ...(value.scope === undefined ? {} : { scope: value.scope }), expiresAt: value.expiresAt,
  };
}

function credential(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_CREDENTIAL_LENGTH && BEARER.test(value);
}

function replaceRecord(directory, path, record) {
  privateFile(path);
  const content = JSON.stringify(record);
  if (Buffer.byteLength(content) > MAX_RECORD_BYTES) throw new OAuthStoreError(RECORD_MESSAGE);
  const temporary = join(directory, `.grant-${randomUUID()}.tmp`);
  let fd;
  let created = false;
  let replaced = false;
  try {
    fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    created = true;
    requirePrivateFile(fstatSync(fd));
    writeFileSync(fd, content, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, path);
    replaced = true;
    syncDirectory(directory);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (created && !replaced) {
      try { unlinkSync(temporary); } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }
}

function syncDirectory(directory) {
  const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
