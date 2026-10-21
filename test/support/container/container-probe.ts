// Runs in a one-off container to read or reset the local installation data.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = process.env.DATA_DIR ?? '/var/lib/thermus';
function withDatabase<T>(work: (database: DatabaseSync) => T): T {
  const database = new DatabaseSync(join(DATA_DIR, 'auth.sqlite'));
  try {
    return work(database);
  } finally {
    database.close();
  }
}

const probes: Readonly<Record<string, () => unknown>> = {
  'data-files': () => readdirSync(DATA_DIR).sort(),
  'installation-ids': () => withDatabase((database) => database.prepare('SELECT "id" FROM "thermus_installation"').all().map(({ id }) => String(id))),
  'remove-installation-identity': () => withDatabase((database) => database.exec('DELETE FROM "thermus_installation"')),
};

const probe = probes[process.env.PROBE ?? ''];
if (probe === undefined) throw new Error(`Unknown PROBE ${process.env.PROBE}`);
process.stdout.write(`${JSON.stringify(probe() ?? null)}\n`);
