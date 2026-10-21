import { CommandError } from './code-quality/shared/command-error.ts';

interface ComponentRoots {
  readonly roots: readonly string[];
  readonly files?: readonly string[];
}

export type ComponentDefinitions = Readonly<Record<string, ComponentRoots>>;

export function validComponentId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value && !['.', '..'].includes(value) && !/[\\/]/u.test(value);
}

function sourcePath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('src/') && value.split('/').every(validComponentId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function directoryRoot(value: unknown): value is string {
  return typeof value === 'string' && value.endsWith('/') && sourcePath(value.slice(0, -1));
}

function checkRoots(id: string, entry: unknown, where: string): void {
  if (!validComponentId(id) || !isRecord(entry)) throw new CommandError(`${where}: invalid component ${id}.`);
  const { roots, files = [] } = entry;
  if (!Array.isArray(roots) || !roots.every(directoryRoot) || !Array.isArray(files) || !files.every(sourcePath)
    || roots.length + files.length === 0) throw new CommandError(`${where}: component ${id} needs source directory roots or exact files.`);
}

// Missing definitions keep old revisions and offline snapshots readable.
export function componentDefinitionsOf(value: unknown, where: string): ComponentDefinitions | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new CommandError(`${where}: components must be a map.`);
  for (const [id, entry] of Object.entries(value)) checkRoots(id, entry, where);
  return value as ComponentDefinitions;
}

export function componentOf(path: string, definitions?: ComponentDefinitions): string | undefined {
  if (!sourcePath(path)) return undefined;
  if (definitions === undefined) return path.split('/').length === 2 ? 'composition' : path.split('/')[1];
  const matches = Object.entries(definitions).filter(([, entry]) => entry.files?.includes(path) || entry.roots.some((root) => path.startsWith(root))).map(([id]) => id);
  if (matches.length > 1) throw new CommandError(`${path} has ambiguous component owners: ${matches.join(', ')}.`);
  return matches[0];
}

// Include assets as well as executable sources. A new root file is never app by default.
export function componentOwnersOf(paths: readonly string[], definitions?: ComponentDefinitions): ReadonlyMap<string, string> {
  return new Map(paths.map((path) => {
    const owner = componentOf(path, definitions);
    if (owner === undefined) throw new CommandError(`${path} has no component owner.`);
    return [path, owner];
  }));
}
