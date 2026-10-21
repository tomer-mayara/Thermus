import { crapAbsoluteOf } from './crap-absolute.ts';
import { isJsonObject, type JsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';

type Unit = { readonly id: string; readonly kind: 'file' | 'class' | 'function' };
interface Binding { readonly unit: Unit; readonly basis: string; readonly base: string; readonly head: string; readonly acceptedBest?: string }
interface Missing { readonly state: 'missing'; readonly reason: string }
interface MiKnown { readonly state: 'known'; readonly raw: number }
interface CrapKnown { readonly state: 'known'; readonly paths: number; readonly coverage: { readonly state: 'known'; readonly share: number } | Missing }
type MiEvidence = MiKnown | Missing;
type CrapEvidence = CrapKnown | Missing;
interface Slot<E> { readonly revision: string; readonly evidence: E }
interface Slots<E> { readonly base: Slot<E>; readonly head: Slot<E>; readonly acceptedBest: Slot<E> | Missing }
type Operands<O> = { readonly base?: O; readonly head?: O; readonly acceptedBest?: O };
type CrapOperands = Parameters<typeof crapAbsoluteOf>[0];
type Result =
  | (Slots<MiEvidence> & { readonly unit: Unit; readonly basis: string; readonly metric: 'MI'; readonly operands: Operands<number> })
  | (Slots<CrapEvidence> & { readonly unit: Unit; readonly basis: string; readonly metric: 'CRAP'; readonly operands: Operands<CrapOperands> });

// This fragment checks declared bindings and numeric fields. It proves no source
// authenticity, identity continuity, history completeness, or review eligibility.
export function numericEvidenceIn(value: unknown, expected: Binding): Result {
  const binding = bindingIn(expected);
  const fields = objectIn(value, 'input', ['unit', 'basis', 'metric', 'base', 'head', 'acceptedBest']);
  const unit = unitIn(fields.unit, 'input.unit');
  if (unit.id !== binding.unit.id || unit.kind !== binding.unit.kind) invalid('input.unit', 'the expected unit');
  const basis = shaIn(fields.basis, 'input.basis', 64);
  if (basis !== binding.basis) invalid('input.basis', 'the expected basis');
  const metric = unit.kind === 'function' ? 'CRAP' : 'MI';
  if (fields.metric !== metric) invalid('input.metric', `the unit metric ${metric}`);
  if (metric === 'MI') {
    const slots = slotsIn(fields, binding, miIn);
    return { unit, basis, metric, ...slots, operands: operandsOf(slots, (evidence) => evidence.raw) };
  }
  const slots = slotsIn(fields, binding, crapIn);
  return { unit, basis, metric, ...slots, operands: operandsOf(slots, (evidence) => evidence.coverage.state === 'known' ? { paths: evidence.paths, share: evidence.coverage.share } : { paths: evidence.paths }) };
}

function bindingIn(value: unknown): Binding {
  const fields = objectIn(value, 'expected', ['unit', 'basis', 'base', 'head', 'acceptedBest']);
  return {
    unit: unitIn(fields.unit, 'expected.unit'), basis: shaIn(fields.basis, 'expected.basis', 64),
    base: shaIn(fields.base, 'expected.base', 40), head: shaIn(fields.head, 'expected.head', 40),
    ...(fields.acceptedBest === undefined ? {} : { acceptedBest: shaIn(fields.acceptedBest, 'expected.acceptedBest', 40) }),
  };
}

function unitIn(value: unknown, field: string): Unit {
  const fields = objectIn(value, field, ['id', 'kind']);
  const id = textIn(fields.id, `${field}.id`);
  const kind = fields.kind;
  if (kind !== 'file' && kind !== 'class' && kind !== 'function') invalid(`${field}.kind`, 'file, class or function');
  return { id, kind };
}

function slotsIn<E>(fields: JsonObject, binding: Binding, read: (value: unknown, field: string, anchor: boolean) => E): Slots<E> {
  const base = slotIn(fields.base, 'input.base', binding.base, read, false);
  const head = slotIn(fields.head, 'input.head', binding.head, read, false);
  const acceptedBest = binding.acceptedBest === undefined
    ? missingIn(fields.acceptedBest, 'input.acceptedBest')
    : slotIn(fields.acceptedBest, 'input.acceptedBest', binding.acceptedBest, read, true);
  return { base, head, acceptedBest };
}

function slotIn<E>(value: unknown, field: string, expected: string, read: (value: unknown, field: string, anchor: boolean) => E, anchor: boolean): Slot<E> {
  const fields = objectIn(value, field, ['revision', 'evidence']);
  const revision = shaIn(fields.revision, `${field}.revision`, 40);
  if (revision !== expected) invalid(`${field}.revision`, 'the expected revision');
  return { revision, evidence: read(fields.evidence, `${field}.evidence`, anchor) };
}

function miIn(value: unknown, field: string): MiEvidence {
  const fields = objectIn(value, field, ['state', 'raw', 'reason']);
  if (fields.state === 'missing') return missingIn(value, field);
  if (fields.state !== 'known') invalid(`${field}.state`, 'known or missing');
  const known = objectIn(value, field, ['state', 'raw']);
  if (typeof known.raw !== 'number' || !Number.isFinite(known.raw)) invalid(`${field}.raw`, 'a finite number');
  return { state: 'known', raw: known.raw };
}

function crapIn(value: unknown, field: string, anchor: boolean): CrapEvidence {
  const fields = objectIn(value, field, ['state', 'paths', 'coverage', 'reason']);
  if (fields.state === 'missing') return missingIn(value, field);
  if (fields.state !== 'known') invalid(`${field}.state`, 'known or missing');
  const known = objectIn(value, field, ['state', 'paths', 'coverage']);
  const coverage = coverageIn(known.coverage, `${field}.coverage`);
  let observation: ReturnType<typeof crapAbsoluteOf>['observation'];
  try { observation = crapAbsoluteOf({ paths: known.paths as number, ...(coverage.state === 'known' ? { share: coverage.share } : {}) }).observation; }
  catch (error) {
    if (!(error instanceof CommandError)) throw error;
    throw new CommandError(`Invalid numeric evidence at ${field}: ${error.message}`);
  }
  if (anchor && coverage.state === 'missing' && observation.paths !== 0) invalid(`${field}.coverage`, 'exact accepted-best evidence, not a nonzero missing-coverage range');
  return { state: 'known', paths: observation.paths, coverage };
}

function coverageIn(value: unknown, field: string): CrapKnown['coverage'] {
  const fields = objectIn(value, field, ['state', 'share', 'reason']);
  if (fields.state === 'missing') return missingIn(value, field);
  if (fields.state !== 'known') invalid(`${field}.state`, 'known or missing');
  const known = objectIn(value, field, ['state', 'share']);
  if (typeof known.share !== 'number' || !Number.isFinite(known.share) || known.share < 0 || known.share > 1) invalid(`${field}.share`, 'a finite number from 0 to 1');
  return { state: 'known', share: known.share };
}

function missingIn(value: unknown, field: string): Missing {
  const fields = objectIn(value, field, ['state', 'reason']);
  if (fields.state !== 'missing') invalid(`${field}.state`, 'missing');
  return { state: 'missing', reason: textIn(fields.reason, `${field}.reason`) };
}

function operandsOf<E extends { readonly state: string }, O>(slots: Slots<E>, known: (evidence: Extract<E, { state: 'known' }>) => O): Operands<O> {
  const operands: { base?: O; head?: O; acceptedBest?: O } = {};
  for (const label of ['base', 'head', 'acceptedBest'] as const) {
    const slot = slots[label];
    if ('evidence' in slot && slot.evidence.state === 'known') operands[label] = known(slot.evidence as Extract<E, { state: 'known' }>);
  }
  return operands;
}

function objectIn(value: unknown, field: string, allowed: readonly string[]): JsonObject {
  if (!isJsonObject(value)) invalid(field, 'an object');
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new CommandError(`Invalid numeric evidence at ${field}.${key}: unsupported field.`);
  }
  return { ...value };
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
  throw new CommandError(`Invalid numeric evidence at ${field}: expected ${expected}.`);
}
