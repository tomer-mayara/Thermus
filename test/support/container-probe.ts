// This script runs in a one-off container of the image under test. container-site.ts sends it on standard input.
// PROBE selects the work, and the script prints its result as JSON:
//   image                         the application files, their hashes, the packages, the user, and DATA_DIR
//   data-files                    the names of the files in DATA_DIR
//   installation-ids              the installation IDs in the database
//   remove-installation-identity  deletes the installation row, as a damaged restore can
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const APPLICATION = '/app';
const DATA_DIR = process.env.DATA_DIR ?? '/var/lib/magumagu';
const DEVELOPMENT_PACKAGES = ['typescript', 'tsx', 'eslint', 'knip', 'ts-morph', '@modelcontextprotocol/client', '@types/node', '@types/css-tree'];
const PINNED_PACKAGES = ['better-auth', '@better-auth/mcp', '@modelcontextprotocol/server', 'adblock-rs'];

function fileHashes(directory: string): Record<string, string> {
  const files = readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  return Object.fromEntries(files.map((entry) => {
    const path = join(entry.parentPath, entry.name);
    return [relative(directory, path), createHash('sha256').update(readFileSync(path)).digest('hex')];
  }).sort(([first = ''], [second = '']) => first.localeCompare(second)));
}

function packageVersion(name: string): string {
  return (JSON.parse(readFileSync(join(APPLICATION, 'node_modules', name, 'package.json'), 'utf8')) as { version: string }).version;
}

interface AdBlocker {
  readonly FilterSet: new (debug: boolean) => { addFilters(rules: string): void };
  readonly Engine: new (filterSet: object) => { urlCosmeticResources(url: string): { hide_selectors: string[] } };
}

// The ad blocker is a native module that the image build compiles. One rule shows that it loads and runs.
function adBlockerSelectors(): string[] {
  const adblock = createRequire(join(APPLICATION, 'package.json'))('adblock-rs') as AdBlocker;
  const filterSet = new adblock.FilterSet(false);
  filterSet.addFilters('example.com##.ad-banner');
  return new adblock.Engine(filterSet).urlCosmeticResources('https://example.com/').hide_selectors;
}

function imageFacts(): unknown {
  const data = statSync(DATA_DIR);
  return {
    applicationEntries: readdirSync(APPLICATION).sort(),
    distEntries: readdirSync(join(APPLICATION, 'dist')).sort(),
    compiledSource: fileHashes(join(APPLICATION, 'dist/src')),
    migrations: fileHashes(join(APPLICATION, 'migrations')),
    developmentPackages: DEVELOPMENT_PACKAGES.filter((name) => existsSync(join(APPLICATION, 'node_modules', name))),
    pinnedPackages: Object.fromEntries(PINNED_PACKAGES.map((name) => [name, packageVersion(name)])),
    adBlockerSelectors: adBlockerSelectors(),
    userId: process.getuid?.(),
    dataDirectory: { path: DATA_DIR, ownerId: data.uid, mode: (data.mode & 0o777).toString(8), entries: readdirSync(DATA_DIR) },
  };
}

function withDatabase<T>(work: (database: DatabaseSync) => T): T {
  const database = new DatabaseSync(join(DATA_DIR, 'auth.sqlite'));
  try {
    return work(database);
  } finally {
    database.close();
  }
}

const probes: Readonly<Record<string, () => unknown>> = {
  image: imageFacts,
  'data-files': () => readdirSync(DATA_DIR).sort(),
  'installation-ids': () => withDatabase((database) => database.prepare('SELECT "id" FROM "magumagu_installation"').all().map(({ id }) => String(id))),
  'remove-installation-identity': () => withDatabase((database) => database.exec('DELETE FROM "magumagu_installation"')),
};

const probe = probes[process.env.PROBE ?? ''];
if (probe === undefined) throw new Error(`Unknown PROBE ${process.env.PROBE}`);
process.stdout.write(`${JSON.stringify(probe() ?? null)}\n`);
