import { spawnSync } from 'node:child_process';
import { lstatSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
let existing;
try {
  existing = lstatSync(output);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) {
  throw new Error('Build output must be a directory at the project dist path.');
}
rmSync(output, { recursive: true, force: true });
const compiler = join(root, 'node_modules/typescript/bin/tsc');
const result = spawnSync(process.execPath, [compiler, '--project', join(root, 'tsconfig.json'), '--outDir', output], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
