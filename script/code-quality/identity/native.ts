import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ts } from 'ts-morph';
import { isJsonObject, jsonOf, objectOf } from '../shared/json.ts';
import type { JsonObject } from '../shared/json.ts';
import { rounded } from '../shared/numbers.ts';
import { CommandError } from '../shared/repository.ts';
import type { SnapshotFunction } from '../snapshot/types.ts';
import { declarationsOf, type Candidate } from './declarations.ts';
import { candidateIdentityOf } from './source.ts';

// Native offsets are UTF-8 bytes. Compare them with encoded declaration boundaries;
// never use them directly as TypeScript or V8 UTF-16 offsets.
export function nativeFunctionsOf(root: string, path: string, text: string | undefined, source: string): SnapshotFunction[] {
  const answer = text === undefined ? undefined : jsonOf(text);
  if (!isJsonObject(answer) || typeof answer.path !== 'string' || resolve(root, answer.path) !== resolve(root, path)) return invalid(path, 'file identity');
  if (answer.source_sha256 !== createHash('sha256').update(source).digest('hex')) return invalid(path, 'source byte hash');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  if ((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length) return invalid(path, 'source syntax');
  const candidates = declarationsOf(tree);
  const functions = nativeEntries(answer, candidates.length, path);
  if (functions.length !== candidates.length) return invalid(path, `function inventory (${functions.length} metrics, ${candidates.length} declarations)`);
  const used = new Set<Candidate>();
  const result = functions.map((value) => {
    if (!isJsonObject(value)) return invalid(path, 'function record');
    const candidate = matchedDeclaration(value.source_range, candidates, source, path);
    if (used.has(candidate)) return invalid(path, 'duplicate source range');
    used.add(candidate);
    return metricOf(value, candidate, path);
  });
  return result;
}

function nativeEntries(answer: JsonObject, count: number, path: string): readonly unknown[] {
  if (Array.isArray(answer.functions)) return answer.functions;
  const lines = answer.lines_of_code;
  if (answer.functions === undefined && count === 0 && answer.cyclomatic_complexity === 0 && answer.risk_score === 0 && isJsonObject(lines) &&
    [lines.lines_of_code, lines.logical_lines, lines.comment_lines].every(nonnegativeInteger)) return [];
  return invalid(path, 'function list');
}

function matchedDeclaration(value: unknown, candidates: readonly Candidate[], source: string, path: string): Candidate {
  if (!isJsonObject(value) || value.coordinates !== 'utf8-bytes' || !nonnegativeInteger(value.start) || !nonnegativeInteger(value.end) || value.end <= value.start) return invalid(path, 'native byte range');
  const byteOffset = (position: number) => Buffer.byteLength(source.slice(0, position));
  const matches = candidates.filter(({ node }) => byteOffset(node.getEnd()) === value.end && declarationStarts(node).some((start) => byteOffset(start) === value.start));
  if (matches.length !== 1) return invalid(path, `unmatched or ambiguous byte range ${value.start}:${value.end}`);
  return matches[0];
}

// Tree-sitter excludes an export wrapper and can exclude declaration modifiers.
// Only actual leading tokens can supply the beginning of the same declaration.
function declarationStarts(node: Candidate['node']): readonly number[] {
  const starts = [node.getStart()];
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
  for (const modifier of modifiers) {
    starts.push(modifier.getStart());
    const next = node.getChildren().find((child) => child.getStart() >= modifier.getEnd() && child.kind !== ts.SyntaxKind.SyntaxList);
    if (next) starts.push(next.getStart());
  }
  return starts;
}

function metricOf(fields: JsonObject, candidate: Candidate, path: string): SnapshotFunction {
  if (fields.name !== undefined && typeof fields.name !== 'string') return invalid(path, 'function name');
  const paths = fields.cyclomatic_complexity;
  if (fields.volume !== undefined && !isJsonObject(fields.volume) || fields.maintainability !== undefined && !isJsonObject(fields.maintainability)) return invalid(path, 'function metric objects');
  const loc = objectOf(fields.volume).loc ?? 0;
  const mi = objectOf(fields.maintainability).maintainability_index;
  if (!nonnegativeInteger(paths) || paths < 1 || !nonnegativeInteger(loc) || mi !== undefined && (typeof mi !== 'number' || !Number.isFinite(mi))) return invalid(path, 'function metrics');
  return { name: fields.name as string || '(anonymous)', paths, loc, maintainability: rounded(mi as number | undefined, 1), identity: candidateIdentityOf(candidate) };
}

function nonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function invalid(path: string, field: string): never {
  throw new CommandError(`get_file_metrics gave invalid ${field} for ${path}. The required goals are unresolved.`);
}
