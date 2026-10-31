import { textOrder } from '../code-quality/shared/order.ts';
import { isJavaScript } from './code-files.ts';
import { externalNameOf } from './external.ts';
import { importStatementsOf, type ImportKind, type ImportStatement } from './imports.ts';
import { resolutionOf, type SourceFiles } from './resolution.ts';

interface FileImport {
  readonly target: string;
  readonly kind: ImportKind;
}

export interface PackageEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: ImportKind;
  readonly source: string;
}

export interface ExternalImport {
  readonly owner: string;
  readonly name: string;
  readonly builtin: boolean;
  readonly source: string;
}

export interface UnresolvedImport {
  readonly file: string;
  readonly detail: string;
}

export interface SourceGraph {
  readonly owners?: ReadonlyMap<string, string>;
  readonly packages: readonly string[];
  readonly imports: ReadonlyMap<string, readonly FileImport[]>;
  readonly edges: readonly PackageEdge[];
  readonly externals: readonly ExternalImport[];
  readonly unresolved: readonly UnresolvedImport[];
}

interface Collection {
  readonly ownerOf: (path: string) => string;
  readonly files: SourceFiles;
  readonly imports: Map<string, FileImport[]>;
  readonly externals: Map<string, ExternalImport>;
  readonly unresolved: Map<string, UnresolvedImport>;
}

export function packageOf(path: string): string {
  const names = path.split('/');
  return names.length > 2 ? names[1] : 'composition';
}

export function sourceGraphOf(paths: readonly string[], sources: ReadonlyMap<string, string>, ownerOf = packageOf): SourceGraph {
  const owners = new Map(paths.map((path) => [path, ownerOf(path)]));
  const javascript = paths.filter(isJavaScript);
  const files = { code: new Set([...sources.keys(), ...javascript]), all: new Set(paths) };
  const collection: Collection = { files, ownerOf, imports: new Map(), externals: new Map(), unresolved: new Map() };
  for (const file of [...sources.keys()].sort(textOrder)) addFile(collection, file, sources.get(file) ?? '');
  for (const file of javascript) addUnresolved(collection, { file, detail: 'the check reads TypeScript only' });
  return {
    owners,
    packages: [...new Set(owners.values())].sort(textOrder),
    imports: collection.imports,
    edges: edgesOf(collection.imports, ownerOf),
    externals: [...collection.externals.values()],
    unresolved: [...collection.unresolved.values()],
  };
}

function addFile(collection: Collection, file: string, text: string): void {
  const statements = importStatementsOf(file, text);
  if (!statements) {
    addUnresolved(collection, { file, detail: 'the file does not parse' });
    return;
  }
  const imports: FileImport[] = [];
  collection.imports.set(file, imports);
  for (const statement of statements) addStatement(collection, { file, imports }, statement);
}

function addStatement(collection: Collection, owner: { file: string; imports: FileImport[] }, statement: ImportStatement): void {
  const { file, imports } = owner;
  if (statement.specifier === undefined) {
    addUnresolved(collection, { file, detail: 'a dynamic import with an argument that is not a literal' });
    return;
  }
  const resolution = resolutionOf(file, statement.specifier, collection.files);
  if (resolution.kind === 'target') imports.push({ target: resolution.path, kind: statement.kind });
  else if (resolution.kind === 'unresolved') addUnresolved(collection, { file, detail: statement.specifier });
  else if (resolution.kind === 'external') addExternal(collection, file, statement.specifier);
}

function addUnresolved(collection: Collection, entry: UnresolvedImport): void {
  collection.unresolved.set(`${entry.file}\0${entry.detail}`, entry);
}

function addExternal(collection: Collection, file: string, specifier: string): void {
  const { name, builtin } = externalNameOf(specifier);
  const owner = collection.ownerOf(file);
  const key = `${owner}\0${name}`;
  if (!collection.externals.has(key)) collection.externals.set(key, { owner, name, builtin, source: file });
}

function edgesOf(imports: ReadonlyMap<string, readonly FileImport[]>, ownerOf: (path: string) => string): PackageEdge[] {
  const edges = new Map<string, PackageEdge>();
  for (const [file, targets] of imports) {
    for (const { target, kind } of targets) addEdge(edges, { from: ownerOf(file), to: ownerOf(target), kind, source: file });
  }
  return [...edges.values()].sort((first, second) => textOrder(first.from, second.from) || textOrder(first.to, second.to));
}

function addEdge(edges: Map<string, PackageEdge>, edge: PackageEdge): void {
  if (edge.from === edge.to) return;
  const key = `${edge.from}\0${edge.to}`;
  const known = edges.get(key);
  if (!known || (known.kind === 'type' && edge.kind === 'runtime')) edges.set(key, edge);
}
