import { appendFileSync, closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGuard } from './ownership-guard.mjs';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const selected = new Set(['hosted.live.js', 'hosted-removal.live.js', 'fetch-public-connect.live.js', 'fetch-public-script.live.js'].map(name => resolve(root, 'dist/test/acceptance/auth', name)));
if (process.env.NODE_TEST_CONTEXT === 'child-v8' && selected.has(resolve(process.argv[1] ?? ''))) {
  const clientId = 'client_01M4VDKB7C7T2GV2NWPS84HADP';
  if (process.env.WORKOS_CLIENT_ID !== clientId || !process.env.WORKOS_API_KEY?.startsWith('sk_test_') || process.env.WORKOS_AUTHKIT_ISSUER !== 'https://reasonable-field-33-staging.authkit.app') throw new Error('Ownership guard refused staging bindings.');
  const path = process.env.THERMUS_LIVE_OWNERSHIP_JOURNAL;
  const run = process.env.THERMUS_LIVE_OWNERSHIP_RUN;
  if (!path || !run || !/^[A-Za-z0-9_-]{1,80}$/.test(run)) throw new Error('Ownership guard requires a private run journal.');
  const fd = openSync(path, constants.O_APPEND | constants.O_RDWR | constants.O_NOFOLLOW);
  const stat = fstatSync(fd);
  if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) throw new Error('Ownership guard refused journal permissions.');
  const rows = readFileSync(fd, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (rows.some(row => row.run !== run)) throw new Error('Ownership guard refused journal from another run.');
  const journal = facts => appendFileSync(fd, JSON.stringify({ at: new Date().toISOString(), run, worker: process.argv[1].split('/').pop(), ...facts }) + '\n');
  const { WorkOS } = await import('@workos-inc/node');
  const sdk = new WorkOS({ apiKey: 'sk_test_guard_initialization_only', clientId, maxRetries: 0 });
  installGuard(sdk, clientId, journal, rows);
  journal({ event: 'guard-active' });
  process.once('exit', () => closeSync(fd));
}
