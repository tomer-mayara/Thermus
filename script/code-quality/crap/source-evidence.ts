import { ts } from 'ts-morph';
import { declarationsOf } from '../identity/declarations.ts';
import { functionEvidenceOf } from '../identity/source.ts';
import type { TableFile } from '../architecture/types.ts';
import type { SnapshotFunction } from '../snapshot/types.ts';
import { CommandError } from '../shared/repository.ts';

export function sourceFileOf(path: string, text: string, metrics?: readonly SnapshotFunction[]): TableFile {
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const diagnostics = (tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  if (diagnostics.length > 0) throw new CommandError(`Cannot parse source evidence for ${path}. The required goals are unresolved.`);
  return { path, ...functionEvidenceOf({ path, text }, metrics ?? declaredFunctions(tree)) };
}

function declaredFunctions(tree: ts.SourceFile): SnapshotFunction[] {
  return declarationsOf(tree).filter(({ node }) => node.body !== undefined).map(({ node, name }): SnapshotFunction => {
    const parent = node.parent;
    return { name: name === undefined ? '(anonymous)' : ts.isClassDeclaration(parent) && parent.name ? `${parent.name.text}.${name}` : name, paths: 0, loc: 0 };
  });
}
