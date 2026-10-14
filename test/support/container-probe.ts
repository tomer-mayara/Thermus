// Runs in a one-off container of the image under test; container-gate.ts sends it on standard input.
// PROBE names one of the probes at the end of this file, and the script prints the result as JSON.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const APPLICATION = '/app';
const DATA_DIR = process.env.DATA_DIR ?? '/var/lib/thermus';
const DEVELOPMENT_PACKAGES = [
  'typescript', 'tsx', 'esbuild', 'eslint', 'knip', 'ts-morph', '@modelcontextprotocol/client', '@types/node', '@types/css-tree',
  '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin',
];
const PINNED_PACKAGES = ['better-auth', '@better-auth/mcp', '@modelcontextprotocol/server', 'adblock-rs'];

function fileHashes(directory: string): Record<string, string> {
  const files = readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  return Object.fromEntries(files.map((entry) => {
    const path = join(entry.parentPath, entry.name);
    return [relative(directory, path), createHash('sha256').update(readFileSync(path)).digest('hex')];
  }).sort(([first = ''], [second = '']) => first.localeCompare(second)));
}

// The pnpm virtual store names a package directory like "@scope+name@1.0.0_peer@2.0.0".
function storedPackageName(entry: string): string {
  return (/^(@[^@]+|[^@]+)@/.exec(entry)?.[1] ?? entry).replace('+', '/');
}

function developmentPackages(): string[] {
  const linked = DEVELOPMENT_PACKAGES.filter((name) => existsSync(join(APPLICATION, 'node_modules', name)));
  const stored = readdirSync(join(APPLICATION, 'node_modules/.pnpm')).map(storedPackageName).filter((name) => DEVELOPMENT_PACKAGES.includes(name));
  return [...new Set([...linked, ...stored])].sort();
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

// The image names the rules path in AD_RULES_FILE, but the operator supplies the file.
function adRulesFile(): string | null {
  const file = process.env.AD_RULES_FILE ?? '';
  return file !== '' && existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function writable(path: string): boolean {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// The messages that the renderer logs for an HTTPS page without a network. The renderer reads the CA certificates of
// the system when it starts, and it logs "No certificates loaded" when it finds none.
function offlineHttpsLog(path: string): string[] {
  const { stderr } = spawnSync(path, ['fetch', '--dump', 'html', 'https://192.0.2.1/'], { encoding: 'utf8', timeout: 10_000 });
  return [...stderr.matchAll(/\$msg="([^"]*)"/g)].map(([, message]) => message ?? '');
}

// The renderer at LIGHTPANDA_BIN, or null when the image has no file there. The probe runs as the image user, so the
// writable paths are the paths of the renderer that this user could change.
function renderer(): unknown {
  const path = process.env.LIGHTPANDA_BIN ?? '';
  if (path === '' || !existsSync(path)) return null;
  const file = statSync(path);
  return {
    path,
    ownerId: file.uid,
    groupId: file.gid,
    mode: (file.mode & 0o777).toString(8),
    writablePaths: [path, dirname(path)].filter(writable),
    version: execFileSync(path, ['version'], { encoding: 'utf8', timeout: 10_000 }).trim(),
    offlineHttpsLog: offlineHttpsLog(path),
  };
}

function imageFacts(): unknown {
  const data = statSync(DATA_DIR);
  return {
    applicationEntries: readdirSync(APPLICATION).sort(),
    distEntries: readdirSync(join(APPLICATION, 'dist')).sort(),
    compiledSource: fileHashes(join(APPLICATION, 'dist/src')),
    migrations: fileHashes(join(APPLICATION, 'migrations')),
    developmentPackages: developmentPackages(),
    pinnedPackages: Object.fromEntries(PINNED_PACKAGES.map((name) => [name, packageVersion(name)])),
    adBlockerSelectors: adBlockerSelectors(),
    adRulesFile: adRulesFile(),
    renderer: renderer(),
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
  'installation-ids': () => withDatabase((database) => database.prepare('SELECT "id" FROM "thermus_installation"').all().map(({ id }) => String(id))),
  'remove-installation-identity': () => withDatabase((database) => database.exec('DELETE FROM "thermus_installation"')),
};

const probe = probes[process.env.PROBE ?? ''];
if (probe === undefined) throw new Error(`Unknown PROBE ${process.env.PROBE}`);
process.stdout.write(`${JSON.stringify(probe() ?? null)}\n`);
