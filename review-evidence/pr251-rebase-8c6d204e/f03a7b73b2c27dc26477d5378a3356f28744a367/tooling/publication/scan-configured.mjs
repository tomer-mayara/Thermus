// The existing staging launcher reads the configured WorkOS key from Keychain.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--axiom-env') throw new Error('Use --axiom-env <the existing environment file used for ordinary gates>.');
const settings = parseEnv(readFileSync(resolve(args[1]), 'utf8'));
if (!settings.AXIOM_API_KEY || settings.AXIOM_API_KEY.length < 12) throw new Error('Configured Axiom key is unavailable.');
const result = spawnSync(process.execPath, [resolve(homedir(), '.config/thermus/with-workos-staging.cjs'), process.execPath, resolve('.cache/pr251-rebase-8c6d204e/publication/scan.mjs')], { env: { ...process.env, AXIOM_API_KEY: settings.AXIOM_API_KEY }, stdio: 'inherit' });
if (result.error) throw new Error('Cannot start configured-secret scan.');
process.exitCode = result.status ?? 1;
