// Runs on standard input in the final image without any mounted test support.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = '/app';
const developmentPackages = ['typescript', 'tsx', 'esbuild', 'eslint', 'knip', 'ts-morph', 'playwright', '@modelcontextprotocol/client', '@types/node'];
const storedPackages = readdirSync(`${root}/node_modules/.pnpm`).map((name) => (/^(@[^@]+|[^@]+)@/.exec(name)?.[1] ?? name).replace('+', '/'));
const rules = readFileSync(process.env.AD_RULES_FILE ?? '', 'utf8');
const renderer = process.env.LIGHTPANDA_BIN ?? '';
let rendererWritable = true;
try { accessSync(renderer, constants.W_OK); } catch { rendererWritable = false; }
const packageJson = JSON.parse(readFileSync(`${root}/package.json`, 'utf8')) as { dependencies: Record<string, string> };
const productionPackages = Object.keys(packageJson.dependencies).filter((name) => existsSync(join(root, 'node_modules', name, 'package.json'))).sort();
process.stdout.write(JSON.stringify({
  architecture: process.arch,
  user: process.getuid?.(),
  rootEntries: readdirSync(root).sort(),
  distEntries: readdirSync(`${root}/dist`).sort(),
  portal: existsSync(`${root}/src/user-portal/dist/index.html`),
  developmentPackages: developmentPackages.filter((name) => storedPackages.includes(name) || existsSync(join(root, 'node_modules', name))),
  productionPackages,
  rulesHash: createHash('sha256').update(rules).digest('hex'),
  rendererVersion: execFileSync(renderer, ['version'], { encoding: 'utf8', timeout: 10_000 }).trim(),
  rendererWritable,
  certificates: existsSync('/etc/ssl/certs/ca-certificates.crt'),
  tools: ['cargo', 'rustc', 'cc', 'gcc', 'make', 'pnpm', 'tsc'].filter((name) => {
    try { execFileSync('sh', ['-c', `command -v ${name}`], { stdio: 'ignore' }); return true; } catch { return false; }
  }),
}));
