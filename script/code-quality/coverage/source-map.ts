import { SourceMap } from 'node:module';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ts } from 'ts-morph';
import type { Candidate } from '../identity/declarations.ts';

interface Mapping { readonly mapText: string; readonly emittedPath: string; readonly sourcePath: string }

// Require both exact map entries. A preceding entry from findEntry is not a boundary proof.
export function sourceDeclarationMapper(generatedTree: ts.SourceFile, sourceTree: ts.SourceFile, candidates: readonly Candidate[], mapping: Mapping): (emitted: Candidate) => Candidate | undefined {
  const payload = JSON.parse(mapping.mapText);
  if (payload.version !== 3 || payload.file !== basename(mapping.emittedPath) || typeof payload.sourceRoot !== 'string' || !Array.isArray(payload.sources)) return () => undefined;
  const map = new SourceMap(payload);
  return (emitted) => {
    const start = mappedPosition(map, generatedTree, emitted.node.getStart(), sourceTree, mapping, payload.sourceRoot);
    const end = mappedPosition(map, generatedTree, emitted.node.getEnd(), sourceTree, mapping, payload.sourceRoot);
    if (start === undefined || end === undefined) return undefined;
    const matches = candidates.filter(({ node }) => node.kind === emitted.node.kind && node.body !== undefined && node.getEnd() === end && node.getStart() <= start && start < node.body.getStart());
    return matches.length === 1 ? matches[0] : undefined;
  };
}

function mappedPosition(map: SourceMap, generatedTree: ts.SourceFile, offset: number, sourceTree: ts.SourceFile, mapping: Mapping, sourceRoot: string): number | undefined {
  const { line, character } = generatedTree.getLineAndCharacterOfPosition(offset);
  const entry = map.findEntry(line, character);
  if (!('generatedLine' in entry)) return undefined;
  if (entry.generatedLine !== line || entry.generatedColumn !== character || typeof entry.originalSource !== 'string' || entry.originalLine === undefined || entry.originalColumn === undefined) return undefined;
  const mapUrl = pathToFileURL(`${mapping.emittedPath}.map`);
  const base = sourceRoot === '' ? mapUrl : new URL(sourceRoot.endsWith('/') ? sourceRoot : `${sourceRoot}/`, mapUrl);
  if (new URL(entry.originalSource, base).href !== pathToFileURL(mapping.sourcePath).href) return undefined;
  const lines = sourceTree.getLineStarts();
  const lineStart = lines[entry.originalLine];
  if (lineStart === undefined || entry.originalColumn < 0) return undefined;
  const position = lineStart + entry.originalColumn;
  if (position > sourceTree.text.length || (lines[entry.originalLine + 1] !== undefined && position >= lines[entry.originalLine + 1])) return undefined;
  return position;
}
