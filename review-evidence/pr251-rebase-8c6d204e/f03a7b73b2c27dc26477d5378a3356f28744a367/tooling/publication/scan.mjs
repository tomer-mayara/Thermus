// Scan configured values in memory. Never print or persist a secret value.
import { readFileSync, readdirSync, lstatSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const publication = resolve('.cache/pr251-rebase-8c6d204e/publication');
const metadata = JSON.parse(readFileSync(join(publication, 'metadata.json'), 'utf8'));
const base = '8c6d204e8588a664438ba8934ab36670b802525f';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(metadata.candidate) || metadata.mergeBase !== base || git('rev-parse', 'HEAD') !== metadata.candidate || git('status', '--porcelain') || git('rev-parse', 'origin/main') !== base) throw new Error('Require the clean current candidate and pinned base.');
const stage = join(publication, 'stage/review-evidence/pr251-rebase-8c6d204e', metadata.candidate);
if (metadata.stage !== stage || realpathSync(stage) !== stage) throw new Error('Unexpected evidence stage.');
const requiredSources = ['WORKOS_API_KEY', 'AXIOM_API_KEY'];
for (const key of requiredSources) if (!process.env[key] || process.env[key].length < 12) throw new Error(`Load configured ${key} into this scan process only.`);
const secrets = [...new Set(Object.entries(process.env).filter(([key, value]) => /(TOKEN|PASSWORD|SECRET|API_KEY|ENCRYPTION_KEY)/i.test(key) && value && value.length >= 12).map(([, value]) => value))].map(value => Buffer.from(value));
const approved = JSON.parse(readFileSync(join(stage, 'approved-inventory.json'), 'utf8'));
if (approved.candidate !== metadata.candidate || approved.mergeBase !== base || !approved.approved || !approved.complete) throw new Error('Require the approved final file inventory.');
const paths = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlinks are excluded.');
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && !['secret-scan.json', 'manifest.json'].includes(relative(stage, path))) paths.push(path);
    else if (!entry.isFile()) throw new Error('Evidence must contain normal files only.');
  }
}
walk(stage);
const expectedNames = [...Object.keys(approved.files), 'approved-inventory.json', 'provenance.json'].sort();
if (JSON.stringify(paths.map(path => relative(stage, path)).sort()) !== JSON.stringify(expectedNames)) throw new Error('Stage differs from the approved file set.');
const hashes = {}, matchedFiles = [];
for (const path of paths.sort()) {
  const before = lstatSync(path), bytes = readFileSync(path), after = lstatSync(path);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('Evidence changed during scan.');
  const name = relative(stage, path);
  if (/user[-_ ]?draft|preservation|production-cutover|credential|(^|\/)\.env|raw[-_]?v8|(^|\/)(keys?|secrets?)(\/|\.)|(^|\/)(coverage|process|signal)-\d+-|(^|\/)(seal-request|seal-receipt|loader)-/i.test(name)) throw new Error('Excluded staged filename.');
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (approved.files[name] && approved.files[name].sha256 !== hash) throw new Error('Approved file bytes changed.');
  hashes[name] = hash;
  if (secrets.some(secret => bytes.includes(secret))) matchedFiles.push(name);
}
const report = { candidate: metadata.candidate, mergeBase: base, filesScanned: paths.length, configuredSecretValuesChecked: secrets.length, requiredSecretSources: requiredSources, matchedFiles, files: hashes, scope: 'Exact configured sensitive environment values only. No values are printed or persisted. This is not exhaustive secret detection.' };
writeFileSync(join(stage, 'secret-scan.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ candidate: report.candidate, filesScanned: paths.length, configuredSecretValuesChecked: secrets.length, matchedFiles }));
if (matchedFiles.length) process.exitCode = 1;
