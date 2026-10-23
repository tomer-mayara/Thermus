import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScriptIdentity } from './identity.ts';

interface SourceText { readonly path: string; readonly text: string }
export interface CoverageSourceFiles {
  readonly source: SourceText;
  readonly emitted: SourceText;
  readonly sourceContentIdentity: string;
  readonly cacheKey: string;
  readonly mapping?: { readonly mapText: string; readonly emittedPath: string; readonly sourcePath: string };
}

// Hash live files before each cache lookup. The build fingerprint also binds map bytes.
export function coverageSourceFiles(root: string, script: ScriptIdentity): CoverageSourceFiles | undefined {
  try {
    const source = { path: join(root, script.path), text: readFileSync(join(root, script.path), 'utf8') };
    const emittedPath = join(root, 'dist', script.path.replace(/\.ts$/u, '.js'));
    const directSource = script.representation === 'source-typescript';
    const emitted = directSource ? source : { path: emittedPath, text: readFileSync(emittedPath, 'utf8') };
    if (hashOf(emitted.text) !== script.contentIdentity) return undefined;
    const mapping = directSource ? undefined : { mapText: readFileSync(`${emittedPath}.map`, 'utf8'), emittedPath, sourcePath: source.path };
    const sourceContentIdentity = hashOf(source.text);
    const cacheKey = JSON.stringify([source.path, script.representation, sourceContentIdentity, script.contentIdentity, mapping && hashOf(mapping.mapText)]);
    return { source, emitted, sourceContentIdentity, cacheKey, mapping };
  } catch {
    return undefined;
  }
}

function hashOf(text: string): string { return createHash('sha256').update(text).digest('hex'); }
