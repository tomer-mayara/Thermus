import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ts } from 'ts-morph';
import { sourceBindingsOf } from '../../script/code-quality/coverage/source-bindings.ts';

const phase = process.argv[2];
assert.ok(['before', 'after'].includes(phase));
const folder = resolve('ast-report/audit-actor-name');
const rows = [];
function filesFor(sourcePath, sourceText, emittedPath, emittedText, mapText) {
  return { source: { path: sourcePath, text: sourceText }, emitted: { path: emittedPath, text: emittedText },
    sourceContentIdentity: createHash('sha256').update(sourceText).digest('hex'), cacheKey: `${phase}:${sourcePath}`,
    mapping: { sourcePath, emittedPath, mapText } };
}
function checkRange(label, files, coverage) {
  const identities = sourceBindingsOf(files)?.sourceIdentities;
  assert.ok(identities);
  const range = `${coverage.start}:${coverage.end}`;
  const identity = identities.get(range);
  if (phase === 'after') assert.ok(identity, `${label} must map its exact V8 range`);
  assert.equal(identities.has(`${coverage.start}:${coverage.end - 1}`), false, `${label} rejects a nearby end`);
  const missingEnd = sourceBindingsOf({ ...files, mapping: { ...files.mapping, mapText: JSON.stringify({ ...JSON.parse(files.mapping.mapText), mappings: 'AAAA' }) } });
  assert.equal(missingEnd?.sourceIdentities.size, 0, `${label} requires exact source-map end evidence`);
  const wrongSource = sourceBindingsOf({ ...files, mapping: { ...files.mapping, mapText: JSON.stringify({ ...JSON.parse(files.mapping.mapText), sources: ['unrelated.ts'] }) } });
  assert.equal(wrongSource?.sourceIdentities.size, 0, `${label} rejects a map to another source`);
  rows.push({ label, range, called: coverage.called, coveredShare: coverage.coveredShare, sourceIdentity: identity ?? null,
    guards: { nearbyEndRejected: true, missingMapEndRejected: true, wrongSourceRejected: true } });
}
const report = JSON.parse(readFileSync('ast-report/coverage.json', 'utf8'));
for (const path of ['src/logs/audit/audit-content.ts', 'src/logs/audit/otlp-audit-encoding.ts']) {
  const emittedPath = resolve('dist', path.replace(/\.ts$/u, '.js'));
  const files = filesFor(resolve(path), readFileSync(path, 'utf8'), emittedPath, readFileSync(emittedPath, 'utf8'), readFileSync(`${emittedPath}.map`, 'utf8'));
  for (const coverage of report.files.find(file => file.path === path).functions.filter(fn => ['auditActorName', 'encodeAuditEvent', 'captureAuditResult'].includes(fn.name))) {
    checkRange(coverage.name, files, coverage);
  }
}
const fixtures = [
  { name: 'documented-function-forms', source: `/** Documented unexported function. */
function plain(): number { return 1; }
/** Documented export. */
export function named(): number { return plain(); }
/** Documented default export. */
export default function primary(): number { return named(); }
/** Documented async export. */
export async function asynchronous(): Promise<number> { return primary(); }
/** Documented generator export. */
export function* generator(): Generator<number> { yield primary(); }
/** Documented async generator export. */
export async function* asyncGenerator(): AsyncGenerator<number> { yield await asynchronous(); }
/** Run all fixture functions. */
export async function exercise(): Promise<void> { named(); primary(); await asynchronous(); [...generator()]; for await (const value of asyncGenerator()) { void value; } }
` },
  { name: 'documented-anonymous-default', source: '/** Documented anonymous default. */\nexport default function (): number { return 1; }\n' },
];
for (const fixture of fixtures) {
  const sourcePath = `${folder}/${fixture.name}.ts`;
  const emittedPath = `${folder}/${fixture.name}.js`;
  const emitted = ts.transpileModule(fixture.source, { fileName: sourcePath, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, sourceMap: true } });
  writeFileSync(sourcePath, fixture.source);
  writeFileSync(emittedPath, emitted.outputText);
  writeFileSync(`${emittedPath}.map`, emitted.sourceMapText);
  const files = filesFor(sourcePath, fixture.source, emittedPath, emitted.outputText, emitted.sourceMapText);
  const inspector = new Session();
  inspector.connect();
  await inspector.post('Profiler.enable');
  await inspector.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  const loaded = await import(pathToFileURL(emittedPath).href);
  if (loaded.exercise) await loaded.exercise(); else loaded.default();
  const { result } = await inspector.post('Profiler.takePreciseCoverage');
  await inspector.post('Profiler.stopPreciseCoverage');
  inspector.disconnect();
  const captured = result.find(script => script.url === pathToFileURL(emittedPath).href);
  assert.ok(captured);
  for (const fn of captured.functions.filter(fn => fn.functionName !== '')) {
    const whole = fn.ranges[0];
    checkRange(`${basename(sourcePath)}#${fn.functionName}`, files, { start: whole.startOffset, end: whole.endOffset, called: whole.count });
  }
}
const evidence = { phase, originalCoverageCommit: report.commit, runtime: process.version, fixtureCompiler: ts.version, rows };
writeFileSync(`${folder}/source-bindings-${phase}.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ phase, functions: rows.length, identified: rows.filter(row => row.sourceIdentity !== null).length, guardsPassed: rows.length * 3 }));
