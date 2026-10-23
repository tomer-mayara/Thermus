import { functionIdentityIn } from '../identity/read.ts';
import * as json from '../shared/json.ts';
import type { CoverageFunction, CoverageReport } from './coverage.ts';

type Fields = ReturnType<typeof json.objectOf>;
export type Check = <T>(value: T | undefined) => T;
export type Unmeasured = { readonly ranges: ReadonlySet<string>; readonly names: ReadonlySet<string> };
const fingerprint = /^[a-f0-9]{64}$/u;

export function coverageFileIn(fields: Fields, check: Check, unmeasured: Unmeasured, version: number): CoverageReport['files'][number] {
  const path = check(json.textOf(fields.path));
  const measured = requiredArray(fields.functions, check).map((entry) => functionOf(json.objectOf(entry), check, version)).filter((fn) =>
    !unmeasured.names.has(JSON.stringify([path, fn.name])) && !unmeasured.ranges.has(JSON.stringify([path, fn.start, fn.end])));
  const representation = fields.representation === 'emitted-javascript' || fields.representation === 'source-typescript' ? fields.representation : undefined;
  if (version === 3) check(representation);
  return { path, representation, contentIdentity: hashIn(fields.contentIdentity, check, version === 3), sourceContentIdentity: hashIn(fields.sourceContentIdentity, check, false), functions: measured };
}

function functionOf(fields: Fields, check: Check, version: number): CoverageFunction {
  const share = check(json.numberOf(fields.coveredShare));
  check(Number.isFinite(share) && share >= 0 && share <= 1 ? share : undefined);
  return {
    name: check(json.textOf(fields.name)), coveredShare: share, ...rangeIn(fields, check, version === 3),
    sourceIdentity: version === 3 ? functionIdentityIn(fields.sourceIdentity) : undefined, ...(version === 3 ? { identityRequired: true as const } : {}),
  };
}

export function unmeasuredFunctions(value: unknown = [], check: Check, version: number): Unmeasured {
  const ranges = new Set<string>();
  const names = new Set<string>();
  for (const entry of requiredArray(value, check)) {
    const fields = json.objectOf(entry);
    check(fields.reason === 'no-own-characters' ? fields.reason : undefined);
    const path = check(json.textOf(fields.path));
    const name = check(json.textOf(fields.name));
    const { start, end } = rangeIn(fields, check, version === 3);
    if (start !== undefined) ranges.add(JSON.stringify([path, start, end]));
    else names.add(JSON.stringify([path, name]));
  }
  return { ranges, names };
}

function rangeIn(fields: Fields, check: Check, required: boolean): Pick<CoverageFunction, 'start' | 'end'> {
  if (!required && fields.start === undefined && fields.end === undefined) return {};
  const start = check(json.numberOf(fields.start));
  const end = check(json.numberOf(fields.end));
  check(Number.isSafeInteger(start) && start >= 0 && Number.isSafeInteger(end) && end > start ? true : undefined);
  return { start, end };
}

function hashIn(value: unknown, check: Check, required: boolean): string | undefined {
  if (value === undefined && !required) return undefined;
  const text = check(json.textOf(value));
  return check(fingerprint.test(text) ? text : undefined);
}

export function requiredArray(value: unknown, check: Check): readonly unknown[] {
  return check(Array.isArray(value) ? value : undefined);
}
