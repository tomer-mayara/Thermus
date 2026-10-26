// Scan exact configured secret values without printing or saving those values.
import {readFileSync, readdirSync, writeFileSync, realpathSync, lstatSync} from 'node:fs';
import {resolve, join, relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const cache = resolve('.cache/rebase251');
const metadata = JSON.parse(readFileSync(join(cache, 'publish-metadata.json'), 'utf8'));
const base = '581f30cfaa32b01399422b087b0f0bdc3b800f70';
const git = (...args) => execFileSync('git', args, {encoding:'utf8'}).trim();
if (!/^[a-f0-9]{40}$/.test(metadata.candidate) || metadata.mergeBase !== base || git('rev-parse','HEAD') !== metadata.candidate || git('status','--porcelain')) throw new Error('A clean matching final candidate is required.');
const expected = join(cache, 'publish/review-evidence/s2-5-01a-rebase', metadata.candidate);
if (metadata.stage !== expected || realpathSync(expected) !== expected) throw new Error('Unsafe stage.');
const requiredSources = ['WORKOS_API_KEY', 'AXIOM_API_KEY'];
for (const key of requiredSources) {
  if (!process.env[key] || process.env[key].length < 12) throw new Error(`Load ${key} into the scan process only.`);
}
const secrets = [...new Set(Object.entries(process.env).filter(([key,value]) => /(TOKEN|PASSWORD|SECRET|API_KEY|ENCRYPTION_KEY)/i.test(key) && value && value.length >= 12).map(([,value]) => value))].map(value => Buffer.from(value));
const files = [];
function walk(path) {
  for (const entry of readdirSync(path,{withFileTypes:true})) {
    const full = join(path,entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlinks excluded.');
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && !['secret-scan.json','manifest.json'].includes(relative(expected,full))) files.push(full);
    else if (!entry.isFile()) throw new Error('Only normal files allowed.');
  }
}
walk(expected);
const hashes = {}, matches = [];
for (const path of files.sort()) {
  const before = lstatSync(path), bytes = readFileSync(path), after = lstatSync(path);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('Stage changed during scan.');
  const name = relative(expected,path);
  if (/user[-_ ]?draft|preservation|production-cutover|credential|(^|\/)\.env|raw[-_]?v8|s25-r1|s2-5-r1|(^|\/)(keys?|secrets?)(\/|\.)|(^|\/)(coverage|process|signal)-\d+-|(^|\/)(seal-request|seal-receipt|loader)-/i.test(name)) throw new Error('Excluded staged filename.');
  if (secrets.some(secret => bytes.includes(secret))) matches.push(name);
  hashes[name] = createHash('sha256').update(bytes).digest('hex');
}
if (!files.length) throw new Error('Empty evidence stage.');
const report = {candidate:metadata.candidate,mergeBase:base,filesScanned:files.length,configuredSecretValuesChecked:secrets.length,requiredSecretSources:requiredSources,matchedFiles:matches,files:hashes,scope:'Exact configured sensitive environment values only; no values printed or persisted. This is not exhaustive secret detection.'};
writeFileSync(join(expected,'secret-scan.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({candidate:report.candidate,filesScanned:files.length,configuredSecretValuesChecked:secrets.length,matchedFiles:matches}));
if (matches.length) process.exitCode = 1;
