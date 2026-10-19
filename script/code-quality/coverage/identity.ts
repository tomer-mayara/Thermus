import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CommandError } from '../shared/repository.ts';

export type ScriptIdentity = {
  readonly path: string;
  readonly representation: 'emitted-javascript' | 'source-typescript';
  readonly contentIdentity: string;
  readonly length: number;
};

// The hash identifies the original UTF-8 file. Node 24 appends a sourceURL trailer to stripped TypeScript;
// its anonymous module range includes the trailer. Named functions keep their source UTF-16 offsets.
export function scriptIdentityOf(url: string, root: string): ScriptIdentity | undefined {
  const path = canonicalFileOf(url);
  if (path === undefined) return undefined;
  const emitted = sourcePath(path, join(root, 'dist', 'src'), '.js');
  const source = sourcePath(path, join(root, 'src'), '.ts');
  if (emitted === undefined && source === undefined) return undefined;
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new CommandError(`Cannot read the identified coverage script ${path}.`);
  }
  return {
    path: `src/${emitted ?? source}.ts`, representation: emitted === undefined ? 'source-typescript' : 'emitted-javascript',
    contentIdentity: createHash('sha256').update(text).digest('hex'),
    length: text.length + (emitted === undefined ? `\n\n//# sourceURL=${url}`.length : 0),
  };
}

function canonicalFileOf(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:' || parsed.search !== '' || parsed.hash !== '') return undefined;
    const path = fileURLToPath(parsed);
    return pathToFileURL(path).href === url ? path : undefined;
  } catch {
    return undefined;
  }
}

function sourcePath(path: string, folder: string, extension: string): string | undefined {
  const prefix = `${folder}/`;
  return path.startsWith(prefix) && path.endsWith(extension) ? path.slice(prefix.length, -extension.length) : undefined;
}
