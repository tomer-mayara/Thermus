import { isJsonObject } from '../shared/json.ts';
import type { JsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import { normalizationVersion } from './types.ts';
import type { FunctionIdentity } from './types.ts';

const declarationKinds = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'MethodDeclaration', 'GetAccessor', 'SetAccessor', 'Constructor']);
const fingerprint = /^[a-f0-9]{64}$/u;

export function functionIdentityIn(value: unknown): FunctionIdentity | undefined {
  if (value === undefined) return undefined;
  if (!isJsonObject(value) || !['typescript-tokens-v1', normalizationVersion].includes(value.version as string)) return invalid();
  const [kind, owner, name, body, signature] = identityTextsOf(value);
  if (!declarationKinds.has(kind) || name === '' || value.version === 'typescript-tokens-v1' && name === '(anonymous)') return invalid();
  if (!fingerprint.test(body) || !fingerprint.test(signature)) return invalid();
  return { version: value.version as FunctionIdentity['version'], kind, owner, name, ...sourceRangeIn(value), body, signature };
}

function identityTextsOf(fields: JsonObject): readonly [string, string, string, string, string] {
  const values = ['kind', 'owner', 'name', 'body', 'signature'].map((key) => fields[key]);
  if (!values.every((value) => typeof value === 'string')) return invalid();
  return values as [string, string, string, string, string];
}

function sourceRangeIn(fields: JsonObject): Pick<FunctionIdentity, 'start' | 'end'> {
  const { start, end } = fields;
  if (!offset(start) || !offset(end) || end <= start) return invalid();
  return { start, end };
}

function offset(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function invalid(): never {
  throw new CommandError('The snapshot has invalid source function identity evidence.');
}
