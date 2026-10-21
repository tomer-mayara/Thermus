import { createHash } from 'node:crypto';
import { crapAbsoluteOf } from './crap-absolute.ts';
import { isJsonObject, type JsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';

type Unit = { readonly id: string; readonly kind: 'file' | 'class' | 'function' };
interface Reference { readonly id: string; readonly sha256: string }
interface Source { readonly id: string; readonly bytes: Uint8Array }
interface Binding {
  readonly unit: Unit; readonly basis: string; readonly start: string; readonly mainCut: string;
  readonly archiveCut: Reference; readonly scopeId: string; readonly reviewer: string;
  readonly acceptedBest?: string; readonly sources: readonly Reference[];
}
interface Missing { readonly state: 'missing'; readonly reason: string }
type Origin = Missing | { readonly state: 'present-at-start'; readonly references: readonly Reference[] }
  | { readonly state: 'introduced'; readonly revision: string; readonly references: readonly Reference[] };
type Coverage = Missing | { readonly state: 'known'; readonly share: number };
type Evidence = Missing | { readonly state: 'known'; readonly raw: number }
  | { readonly state: 'known'; readonly paths: number; readonly coverage: Coverage };
type Best = Missing | { readonly revision: string; readonly evidence: Evidence; readonly references: readonly Reference[] };
interface Range { readonly from: string; readonly through: string; readonly reason: string }
interface SkippedRange extends Range { readonly references: readonly Reference[] }
interface Review { readonly reviewer: string; readonly completeness: 'no-known-gaps' | 'gaps-declared'; readonly statement: string }
interface History {
  readonly unit: Unit; readonly basis: string; readonly start: string; readonly mainCut: string;
  readonly archiveCut: Reference; readonly scopeId: string; readonly metric: 'MI' | 'CRAP';
  readonly origin: Origin; readonly acceptedBest: Best; readonly skippedRanges: readonly SkippedRange[];
  readonly gaps: readonly Range[]; readonly review: Review; readonly exceptions: readonly [];
}
interface References {
  readonly one: (value: unknown, field: string) => Reference;
  readonly many: (value: unknown, field: string, required: boolean) => readonly Reference[];
}

// Checked bytes establish reference integrity, not the truth of declarations,
// reviewer authority, lineage, complete history, usable anchors, or review routes.
export function manualHistoryIn(value: unknown, expected: Binding, sources: readonly Source[]): History {
  const binding = bindingIn(expected);
  const references = referencesOf(binding.sources, sources);
  const fields = objectIn(value, 'input', ['unit', 'basis', 'start', 'mainCut', 'archiveCut', 'scopeId', 'metric', 'origin', 'acceptedBest', 'skippedRanges', 'gaps', 'review', 'exceptions']);
  const unit = unitIn(fields.unit, 'input.unit');
  if (unit.id !== binding.unit.id || unit.kind !== binding.unit.kind) invalid('input.unit', 'the expected unit');
  const basis = boundIn(fields.basis, binding.basis, 'input.basis', 64);
  const start = boundIn(fields.start, binding.start, 'input.start', 40);
  const mainCut = boundIn(fields.mainCut, binding.mainCut, 'input.mainCut', 40);
  const scopeId = textIn(fields.scopeId, 'input.scopeId');
  if (scopeId !== binding.scopeId) invalid('input.scopeId', 'the expected scope');
  const archiveCut = references.one(fields.archiveCut, 'input.archiveCut');
  if (archiveCut.id !== binding.archiveCut.id || archiveCut.sha256 !== binding.archiveCut.sha256) invalid('input.archiveCut', 'the expected archive cut');
  const metric = unit.kind === 'function' ? 'CRAP' : 'MI';
  if (fields.metric !== metric) invalid('input.metric', `the unit metric ${metric}`);
  const origin = originIn(fields.origin, references);
  const acceptedBest = bestIn(fields.acceptedBest, binding.acceptedBest, metric, references);
  const pairs = new Set<string>();
  const skippedRanges = arrayIn(fields.skippedRanges, 'input.skippedRanges').map((entry, index) => {
    const field = `input.skippedRanges[${index}]`;
    const row = objectIn(entry, field, ['from', 'through', 'reason', 'references']);
    return { ...rangeIn(row, field, pairs), references: references.many(row.references, `${field}.references`, true) };
  });
  const gaps = arrayIn(fields.gaps, 'input.gaps').map((entry, index) => {
    const field = `input.gaps[${index}]`;
    return rangeIn(objectIn(entry, field, ['from', 'through', 'reason']), field, pairs);
  });
  const review = reviewIn(fields.review, binding.reviewer, hasGap(origin, acceptedBest, gaps));
  if (arrayIn(fields.exceptions, 'input.exceptions').length !== 0) invalid('input.exceptions', 'an empty array; exception handling is not supported');
  return { unit, basis, start, mainCut, archiveCut, scopeId, metric, origin, acceptedBest, skippedRanges, gaps, review, exceptions: [] };
}

function bindingIn(value: unknown): Binding {
  const fields = objectIn(value, 'expected', ['unit', 'basis', 'start', 'mainCut', 'archiveCut', 'scopeId', 'reviewer', 'acceptedBest', 'sources']);
  const sources = arrayIn(fields.sources, 'expected.sources').map((entry, index) => referenceIn(entry, `expected.sources[${index}]`));
  const ids = new Set<string>();
  for (const [index, ref] of sources.entries()) {
    if (ids.has(ref.id)) invalid(`expected.sources[${index}].id`, 'a unique source ID');
    ids.add(ref.id);
  }
  const archiveCut = referenceIn(fields.archiveCut, 'expected.archiveCut');
  if (!sources.some((ref) => ref.id === archiveCut.id && ref.sha256 === archiveCut.sha256)) invalid('expected.archiveCut', 'an independently cataloged reference');
  return {
    unit: unitIn(fields.unit, 'expected.unit'), basis: shaIn(fields.basis, 'expected.basis', 64),
    start: shaIn(fields.start, 'expected.start', 40), mainCut: shaIn(fields.mainCut, 'expected.mainCut', 40),
    archiveCut, scopeId: textIn(fields.scopeId, 'expected.scopeId'), reviewer: textIn(fields.reviewer, 'expected.reviewer'),
    ...(fields.acceptedBest === undefined ? {} : { acceptedBest: shaIn(fields.acceptedBest, 'expected.acceptedBest', 40) }), sources,
  };
}

function referencesOf(catalog: readonly Reference[], sources: unknown): References {
  const allowed = new Map(catalog.map((ref) => [ref.id, ref.sha256]));
  const retained = new Set<string>();
  for (const [index, value] of arrayIn(sources, 'sources').entries()) {
    const field = `sources[${index}]`;
    const source = objectIn(value, field, ['id', 'bytes']);
    const id = textIn(source.id, `${field}.id`);
    if (retained.has(id)) invalid(`${field}.id`, 'a unique source ID');
    if (!allowed.has(id)) invalid(`${field}.id`, 'an independently cataloged source ID');
    if (!(source.bytes instanceof Uint8Array)) invalid(`${field}.bytes`, 'a Uint8Array');
    if (createHash('sha256').update(source.bytes).digest('hex') !== allowed.get(id)) invalid(`${field}.bytes`, 'bytes matching the expected SHA256');
    retained.add(id);
  }
  const one = (value: unknown, field: string): Reference => {
    const ref = referenceIn(value, field);
    if (allowed.get(ref.id) !== ref.sha256) invalid(field, 'the independently cataloged reference');
    if (!retained.has(ref.id)) invalid(field, 'retained source bytes');
    return ref;
  };
  const many = (value: unknown, field: string, required: boolean): readonly Reference[] => {
    const entries = arrayIn(value, field);
    if (required && entries.length === 0) invalid(field, 'at least one checked reference');
    const ids = new Set<string>();
    return entries.map((entry, index) => {
      const ref = one(entry, `${field}[${index}]`);
      if (ids.has(ref.id)) invalid(`${field}[${index}].id`, 'a unique reference ID in this list');
      ids.add(ref.id);
      return ref;
    });
  };
  return { one, many };
}

function referenceIn(value: unknown, field: string): Reference {
  const fields = objectIn(value, field, ['id', 'sha256']);
  return { id: textIn(fields.id, `${field}.id`), sha256: shaIn(fields.sha256, `${field}.sha256`, 64) };
}

function originIn(value: unknown, refs: References): Origin {
  const field = 'input.origin';
  const fields = objectIn(value, field, ['state', 'revision', 'references', 'reason']);
  if (fields.state === 'missing') return missingIn(value, field);
  if (fields.state === 'present-at-start') {
    const known = objectIn(value, field, ['state', 'references']);
    return { state: 'present-at-start', references: refs.many(known.references, `${field}.references`, true) };
  }
  if (fields.state !== 'introduced') invalid(`${field}.state`, 'present-at-start, introduced or missing');
  const known = objectIn(value, field, ['state', 'revision', 'references']);
  return { state: 'introduced', revision: shaIn(known.revision, `${field}.revision`, 40), references: refs.many(known.references, `${field}.references`, true) };
}

function bestIn(value: unknown, revision: string | undefined, metric: 'MI' | 'CRAP', refs: References): Best {
  const field = 'input.acceptedBest';
  if (revision === undefined) return missingIn(value, field);
  const fields = objectIn(value, field, ['revision', 'evidence', 'references']);
  const selected = boundIn(fields.revision, revision, `${field}.revision`, 40);
  const evidence = evidenceIn(fields.evidence, metric);
  return { revision: selected, evidence, references: refs.many(fields.references, `${field}.references`, evidence.state === 'known') };
}

function evidenceIn(value: unknown, metric: 'MI' | 'CRAP'): Evidence {
  const field = 'input.acceptedBest.evidence';
  const fields = objectIn(value, field, ['state', 'raw', 'paths', 'coverage', 'reason']);
  if (fields.state === 'missing') return missingIn(value, field);
  if (fields.state !== 'known') invalid(`${field}.state`, 'known or missing');
  return metric === 'MI' ? miIn(value, field) : crapIn(value, field);
}

function miIn(value: unknown, field: string): Evidence {
  const fields = objectIn(value, field, ['state', 'raw']);
  if (typeof fields.raw !== 'number' || !Number.isFinite(fields.raw)) invalid(`${field}.raw`, 'a finite number');
  return { state: 'known', raw: fields.raw };
}

function crapIn(value: unknown, field: string): Evidence {
  const known = objectIn(value, field, ['state', 'paths', 'coverage']);
  const coverage = coverageIn(known.coverage, `${field}.coverage`);
  let paths: number;
  try { paths = crapAbsoluteOf({ paths: known.paths as number, ...(coverage.state === 'known' ? { share: coverage.share } : {}) }).observation.paths; }
  catch (error) {
    if (!(error instanceof CommandError)) throw error;
    throw new CommandError(`Invalid manual history at ${field}: ${error.message}`);
  }
  if (paths !== 0 && coverage.state === 'missing') invalid(`${field}.coverage`, 'exact best evidence, not a positive-path coverage range');
  return { state: 'known', paths, coverage };
}

function coverageIn(value: unknown, field: string): Coverage {
  const fields = objectIn(value, field, ['state', 'share', 'reason']);
  if (fields.state === 'missing') return missingIn(value, field);
  if (fields.state !== 'known') invalid(`${field}.state`, 'known or missing');
  const known = objectIn(value, field, ['state', 'share']);
  if (typeof known.share !== 'number' || !Number.isFinite(known.share) || known.share < 0 || known.share > 1) invalid(`${field}.share`, 'a finite number from 0 to 1');
  return { state: 'known', share: known.share };
}

function rangeIn(fields: JsonObject, field: string, pairs: Set<string>): Range {
  const from = shaIn(fields.from, `${field}.from`, 40);
  const through = shaIn(fields.through, `${field}.through`, 40);
  const reason = textIn(fields.reason, `${field}.reason`);
  const pair = `${from}/${through}`;
  if (pairs.has(pair)) invalid(field, 'a unique endpoint pair across skipped ranges and gaps');
  pairs.add(pair);
  return { from, through, reason };
}

function hasGap(origin: Origin, best: Best, gaps: readonly Range[]): boolean {
  if (origin.state === 'missing' || gaps.length > 0) return true;
  return 'state' in best || best.evidence.state === 'missing';
}

function reviewIn(value: unknown, reviewer: string, gaps: boolean): Review {
  const field = 'input.review';
  const fields = objectIn(value, field, ['reviewer', 'completeness', 'statement']);
  const named = textIn(fields.reviewer, `${field}.reviewer`);
  if (named !== reviewer) invalid(`${field}.reviewer`, 'the expected reviewer');
  const completeness = gaps ? 'gaps-declared' : 'no-known-gaps';
  if (fields.completeness !== completeness) invalid(`${field}.completeness`, completeness);
  return { reviewer: named, completeness, statement: textIn(fields.statement, `${field}.statement`) };
}

function missingIn(value: unknown, field: string): Missing {
  const fields = objectIn(value, field, ['state', 'reason']);
  if (fields.state !== 'missing') invalid(`${field}.state`, 'missing');
  return { state: 'missing', reason: textIn(fields.reason, `${field}.reason`) };
}

function unitIn(value: unknown, field: string): Unit {
  const fields = objectIn(value, field, ['id', 'kind']);
  const id = textIn(fields.id, `${field}.id`);
  const kind = fields.kind;
  if (kind !== 'file' && kind !== 'class' && kind !== 'function') invalid(`${field}.kind`, 'file, class or function');
  return { id, kind };
}

function objectIn(value: unknown, field: string, allowed: readonly string[]): JsonObject {
  if (!isJsonObject(value)) invalid(field, 'an object');
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new CommandError(`Invalid manual history at ${field}.${key}: unsupported field.`);
  }
  return { ...value };
}

function arrayIn(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) invalid(field, 'an array');
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) invalid(`${field}[${index}]`, 'an own array entry');
  }
  return value;
}

function boundIn(value: unknown, expected: string, field: string, length: 40 | 64): string {
  const hash = shaIn(value, field, length);
  if (hash !== expected) invalid(field, 'the expected revision or basis');
  return hash;
}

function shaIn(value: unknown, field: string, length: 40 | 64): string {
  if (typeof value !== 'string' || value.length !== length || !/^[a-f0-9]+$/u.test(value)) invalid(field, `a full lowercase ${length === 40 ? 'SHA1' : 'SHA256'}`);
  return value;
}

function textIn(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') invalid(field, 'a nonblank string');
  return value;
}

function invalid(field: string, expected: string): never {
  throw new CommandError(`Invalid manual history at ${field}: expected ${expected}.`);
}
