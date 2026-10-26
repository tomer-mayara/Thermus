// Manager-only scan launcher. Configured secret values stay in child memory.
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {homedir} from 'node:os';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--axiom-env') throw new Error('Use --axiom-env <the same configured environment file used by the gates>.');
const settings = parseEnv(readFileSync(resolve(args[1]), 'utf8'));
if (!settings.AXIOM_API_KEY || settings.AXIOM_API_KEY.length < 12) throw new Error('Configured Axiom key unavailable.');
const result = spawnSync(process.execPath, [
  resolve(homedir(), '.config/thermus/with-workos-staging.cjs'),
  process.execPath,
  resolve('.cache/rebase251/scan-review-evidence.mjs'),
], {env:{...process.env,AXIOM_API_KEY:settings.AXIOM_API_KEY},stdio:'inherit'});
if (result.error) throw new Error('Could not start configured-secret scan.');
process.exitCode = result.status ?? 1;
