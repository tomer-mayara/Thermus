import { ts } from 'ts-morph';
import type { SnapshotFunction } from '../snapshot/types.ts';
import { identityOf } from './normalize.ts';
import { declarationsOf } from './declarations.ts';
import type { Candidate } from './declarations.ts';
import { normalizationVersion } from './types.ts';
import type { FunctionIdentity, SourceEvidence } from './types.ts';

interface SourceText { readonly path: string; readonly text: string }
interface Evidence { readonly functions: readonly SnapshotFunction[]; readonly sourceEvidence: SourceEvidence }

export function functionEvidenceOf(source: SourceText, functions: readonly SnapshotFunction[]): Evidence {
  const tree = ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true);
  const candidates = declarationsOf(tree);
  const valid = (tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length === 0;
  const attached = functions.map((entry) => ({ ...entry, identity: valid ? identityFor(entry, candidates, functions) : undefined }));
  const ranges = attached.flatMap(({ identity }) => identity ? [`${identity.start}:${identity.end}`] : []);
  const complete = valid && attached.length === candidates.length && new Set(ranges).size === candidates.length;
  return { functions: attached, sourceEvidence: { version: normalizationVersion, coordinates: 'utf16', complete } };
}

export function candidateIdentityOf(candidate: Candidate): FunctionIdentity | undefined {
  return candidate.node.body ? identityOf({ node: candidate.node, body: candidate.node.body, name: candidate.name ?? '(anonymous)', owner: candidate.owner }) : undefined;
}

function identityFor(entry: SnapshotFunction, candidates: readonly Candidate[], functions: readonly SnapshotFunction[]): FunctionIdentity | undefined {
  if (entry.identity) {
    const match = candidates.find(({ node }) => node.getStart() === entry.identity?.start && node.getEnd() === entry.identity?.end);
    const expected = match && candidateIdentityOf(match);
    return expected && JSON.stringify(expected) === JSON.stringify(entry.identity) ? expected : undefined;
  }
  const { name } = entry;
  if (name === '(anonymous)') return undefined;
  const matches = candidates.filter((entry) => metricNamesOf(entry).includes(metricName(name)));
  const candidate = matches[0];
  if (matches.length !== 1 || !candidate?.node.body || candidate.name === undefined) return undefined;
  if (functions.filter((entry) => metricNamesOf(candidate).includes(metricName(entry.name))).length !== 1) return undefined;
  return candidateIdentityOf(candidate);
}

function metricName(name: string): string {
  return name.slice(name.lastIndexOf('\\') + 1);
}

function metricNamesOf(candidate: Candidate): readonly string[] {
  if (!candidate.name) return [];
  const parent = candidate.node.parent;
  if (ts.isClassDeclaration(parent) && parent.name) return [candidate.name, `${parent.name.text}.${candidate.name}`];
  return [candidate.name];
}
