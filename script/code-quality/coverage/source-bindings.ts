import { ts } from 'ts-morph';
import { declarationsOf, type Candidate } from '../identity/declarations.ts';
import { candidateIdentityOf } from '../identity/source.ts';
import type { FunctionIdentity } from '../identity/types.ts';
import { sourceDeclarationMapper, type ParsedScript } from './source-map.ts';
import type { CoverageSourceFiles } from './source-files.ts';

export type SourceBindings = { readonly sourceContentIdentity: string; readonly sourceIdentities: ReadonlyMap<string, FunctionIdentity> };
const omittedRangeModifiers = new Set([ts.SyntaxKind.ExportKeyword, ts.SyntaxKind.DefaultKeyword, ts.SyntaxKind.StaticKeyword, ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword, ts.SyntaxKind.AbstractKeyword, ts.SyntaxKind.OverrideKeyword, ts.SyntaxKind.DeclareKeyword]);

// Mapping is a calculation over the identified files; invalid syntax remains unknown.
export function sourceBindingsOf(files: CoverageSourceFiles): SourceBindings | undefined {
  try {
    const source = parsedScript(files.source.path, files.source.text);
    const emitted = files.mapping === undefined ? source : parsedScript(files.emitted.path, files.emitted.text);
    if (!source || !emitted) return undefined;
    return { sourceContentIdentity: files.sourceContentIdentity, sourceIdentities: identitiesOf(source, emitted, files.mapping) };
  } catch {
    return undefined;
  }
}

function parsedScript(path: string, text: string): ParsedScript | undefined {
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  if ((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length > 0) return undefined;
  return { tree, declarations: declarationsOf(tree) };
}

function identitiesOf(source: ParsedScript, emitted: ParsedScript, mapping: { mapText: string; emittedPath: string; sourcePath: string } | undefined): ReadonlyMap<string, FunctionIdentity> {
  const candidates = new Map<string, FunctionIdentity[]>();
  const originalOf = mapping === undefined ? (candidate: Candidate) => candidate : sourceDeclarationMapper(emitted, source, mapping);
  for (const declaration of emitted.declarations) {
    const original = originalOf(declaration);
    const identity = original === undefined ? undefined : candidateIdentityOf(original);
    if (!identity) continue;
    for (const start of coverageStartsOf(declaration)) {
      const key = `${start}:${declaration.node.getEnd()}`;
      candidates.set(key, [...candidates.get(key) ?? [], identity]);
    }
  }
  return new Map([...candidates].filter(([, matches]) => matches.length === 1).map(([key, matches]) => [key, matches[0]]));
}

// V8 omits static and export/default prefixes; TypeScript-only modifiers also precede the runtime range.
// It must still start at an exact declaration token and end at that declaration's end.
function coverageStartsOf({ node }: Candidate): readonly number[] {
  const starts = new Set([node.getStart()]);
  const children = node.getChildren().flatMap((child) => child.kind === ts.SyntaxKind.SyntaxList && child.getChildren().every(ts.isModifier) ? child.getChildren() : [child]);
  for (const child of children) {
    if (ts.isJSDoc(child) || omittedRangeModifiers.has(child.kind)) continue;
    starts.add(child.getStart());
    break;
  }
  return [...starts];
}
