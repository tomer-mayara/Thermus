// Scan exact configured secrets. This script never prints or saves their values.
import {readFileSync, readdirSync, writeFileSync, realpathSync, lstatSync} from 'node:fs';
import {resolve, join, relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root = process.cwd();
const cache = resolve('.cache/s25-r1');
const metadata = JSON.parse(readFileSync(join(cache, 'publish-metadata.json'), 'utf8'));
if (execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim() !== metadata.candidate || execFileSync('git', ['status', '--porcelain'], {encoding:'utf8'}).trim()) throw new Error('A clean, matching committed candidate is required.');
const expected = join(cache, 'publish/review-evidence/s2-5-r1', metadata.candidate);
if (metadata.stage !== expected || realpathSync(expected) !== expected) throw new Error('Unsafe evidence stage.');
for (const key of ['WORKOS_API_KEY', 'AXIOM_API_KEY']) {
  if (!process.env[key] || process.env[key].length < 12) throw new Error(`Load ${key} into the scan process only.`);
}
const secrets = [...new Set(Object.entries(process.env).filter(([key,value]) => /(TOKEN|PASSWORD|SECRET|API_KEY|ENCRYPTION_KEY)/i.test(key) && value && value.length >= 12).map(([,value]) => value))].map(value => Buffer.from(value));
const files = [];
function walk(path) {
  for (const entry of readdirSync(path, {withFileTypes:true})) {
    const full = join(path, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlinks are excluded.');
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && !['secret-scan.json','manifest.json'].includes(relative(expected, full))) files.push(full);
    else if (!entry.isFile()) throw new Error('Only normal files are allowed.');
  }
}
walk(expected);
const matches = [], hashes = {};
for (const path of files.sort()) {
  const before = lstatSync(path);
  const bytes = readFileSync(path);
  const after = lstatSync(path);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('Stage changed during scan.');
  const name = relative(expected,path);
  if (/user[-_ ]?draft|production-cutover|credential|(^|\/)\.env|raw[-_]?v8/i.test(name)) throw new Error('Excluded file name in stage.');
  if (secrets.some(secret => bytes.includes(secret))) matches.push(name);
  hashes[name] = createHash('sha256').update(bytes).digest('hex');
}
if (!files.length) throw new Error('Empty evidence stage.');
const report = {candidate:metadata.candidate, parentMergeBase:metadata.parentMergeBase, filesScanned:files.length, configuredSecretValuesChecked:secrets.length, requiredSecretSources:['WORKOS_API_KEY','AXIOM_API_KEY'], matchedFiles:matches, files:hashes, scope:'Exact configured sensitive environment values only; values are never printed or persisted. This is not exhaustive secret detection.'};
writeFileSync(join(expected,'secret-scan.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({candidate:report.candidate,filesScanned:files.length,configuredSecretValuesChecked:secrets.length,matchedFiles:matches}));
if (matches.length) process.exitCode = 1;
