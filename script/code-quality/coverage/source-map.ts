import { SourceMap, type SourceMapping } from 'node:module';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ts } from 'ts-morph';
import type { Candidate } from '../identity/declarations.ts';

export type ParsedScript = { readonly tree: ts.SourceFile; readonly declarations: readonly Candidate[] };
interface Mapping { readonly mapText: string; readonly emittedPath: string; readonly sourcePath: string }

// Require both exact map entries. A preceding entry from findEntry is not a boundary proof.
export function sourceDeclarationMapper(emitted: ParsedScript, source: ParsedScript, mapping: Mapping): (declaration: Candidate) => Candidate | undefined {
  const payload = JSON.parse(mapping.mapText);
  if (payload.version !== 3 || payload.file !== basename(mapping.emittedPath) || typeof payload.sourceRoot !== 'string' || !Array.isArray(payload.sources)) return () => undefined;
  const map = new SourceMap(payload);
  const sourcePosition = (offset: number): number | undefined => {
    const entry = exactEntryAt(map, emitted.tree.getLineAndCharacterOfPosition(offset));
    if (entry === undefined || !resolvesToSource(entry.originalSource, payload.sourceRoot, mapping)) return undefined;
    return positionIn(source.tree, entry);
  };
  return (declaration) => {
    const start = sourcePosition(declaration.node.getStart());
    const end = sourcePosition(declaration.node.getEnd());
    if (start === undefined || end === undefined) return undefined;
    const matches = source.declarations.filter(({ node }) => node.kind === declaration.node.kind && node.body !== undefined && node.getEnd() === end && node.getStart() <= start && start < node.body.getStart());
    return matches.length === 1 ? matches[0] : undefined;
  };
}

function exactEntryAt(map: SourceMap, { line, character }: ts.LineAndCharacter): SourceMapping | undefined {
  const entry = map.findEntry(line, character);
  if (!('generatedLine' in entry)) return undefined;
  if (entry.generatedLine !== line || entry.generatedColumn !== character || typeof entry.originalSource !== 'string' || entry.originalLine === undefined || entry.originalColumn === undefined) return undefined;
  return entry;
}

function resolvesToSource(originalSource: string, sourceRoot: string, mapping: Mapping): boolean {
  const mapUrl = pathToFileURL(`${mapping.emittedPath}.map`);
  const base = sourceRoot === '' ? mapUrl : new URL(sourceRoot.endsWith('/') ? sourceRoot : `${sourceRoot}/`, mapUrl);
  return new URL(originalSource, base).href === pathToFileURL(mapping.sourcePath).href;
}

function positionIn(tree: ts.SourceFile, { originalLine, originalColumn }: SourceMapping): number | undefined {
  const lines = tree.getLineStarts();
  const lineStart = lines[originalLine];
  if (lineStart === undefined || originalColumn < 0) return undefined;
  const position = lineStart + originalColumn;
  if (position > tree.text.length || (lines[originalLine + 1] !== undefined && position >= lines[originalLine + 1])) return undefined;
  return position;
}
