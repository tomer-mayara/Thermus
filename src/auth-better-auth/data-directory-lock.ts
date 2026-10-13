import { statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const LOCK_FILE = 'data-directory.lock';
const SQLITE_BUSY = 5;

export interface DataDirectoryLock {
  release(): void;
}

export class DataDirectoryInUseError extends Error {
  constructor() {
    super('The data directory is in use by another Magumagu process. Stop that process, then try again.');
    this.name = 'DataDirectoryInUseError';
  }
}

export class DataDirectoryUnavailableError extends Error {
  constructor() {
    super('DATA_DIR must name an existing directory.');
    this.name = 'DataDirectoryUnavailableError';
  }
}

// An open exclusive SQLite transaction is a system file lock: it also stops other connections
// in this process, and the system releases it when the process ends, also after a crash.
export function lockDataDirectory(directory: string): DataDirectoryLock {
  requireDirectory(directory);
  const connection = new DatabaseSync(join(directory, LOCK_FILE));
  try {
    connection.exec('PRAGMA journal_mode = MEMORY');
    connection.exec('PRAGMA locking_mode = EXCLUSIVE');
    connection.exec('BEGIN EXCLUSIVE');
  } catch (error) {
    connection.close();
    if (isBusy(error)) throw new DataDirectoryInUseError();
    throw error;
  }
  return {
    release: () => {
      if (connection.isOpen) connection.close();
    },
  };
}

function requireDirectory(directory: string): void {
  if (statSync(directory, { throwIfNoEntry: false })?.isDirectory() !== true) {
    throw new DataDirectoryUnavailableError();
  }
}

function isBusy(error: unknown): boolean {
  return (error as { errcode?: unknown } | null)?.errcode === SQLITE_BUSY;
}
