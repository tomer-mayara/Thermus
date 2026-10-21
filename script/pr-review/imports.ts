import { ts } from 'ts-morph';
import { isDeclarationFile } from './code-files.ts';

// The kind of one import statement (dependency_graph.counting.type_only of the rules file). A type statement loads no
// module at run time: import type, export type from, and import('x') used as a type. Every other form is runtime.
// With verbatimModuleSyntax, TypeScript keeps "import { type A } from 'x'" as "import {} from 'x'", which loads x.
export type ImportKind = 'type' | 'runtime';

// A dynamic import with an argument that is not a literal has no specifier.
export interface ImportStatement {
  readonly specifier?: string;
  readonly kind: ImportKind;
}

// A declaration file loads nothing at run time, so each of its statements is a type statement. Undefined when the
// file does not parse.
export function importStatementsOf(path: string, text: string): readonly ImportStatement[] | undefined {
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if ((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length) return undefined;
  const statements: ImportStatement[] = [...referencesOf(tree)];
  const visit = (node: ts.Node): void => {
    const statement = statementOf(node);
    if (statement) statements.push(statement);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return isDeclarationFile(path) ? statements.map((statement) => ({ ...statement, kind: 'type' })) : statements;
}

// A reference path is relative to the file, also without "./".
function referencesOf(tree: ts.SourceFile): ImportStatement[] {
  const paths = tree.referencedFiles.map((reference) => (/^\.{0,2}\//u.test(reference.fileName) ? reference.fileName : `./${reference.fileName}`));
  return [...paths, ...tree.typeReferenceDirectives.map((reference) => reference.fileName)].map((specifier) => ({ specifier, kind: 'type' }));
}

function statementOf(node: ts.Node): ImportStatement | undefined {
  if (ts.isImportDeclaration(node)) return literalOf(node.moduleSpecifier, node.importClause?.isTypeOnly === true);
  if (ts.isExportDeclaration(node)) return node.moduleSpecifier ? literalOf(node.moduleSpecifier, node.isTypeOnly) : undefined;
  if (ts.isImportEqualsDeclaration(node)) return requireOf(node);
  if (ts.isModuleDeclaration(node)) return augmentationOf(node);
  return importExpressionOf(node);
}

function importExpressionOf(node: ts.Node): ImportStatement | undefined {
  if (ts.isImportTypeNode(node)) return ts.isLiteralTypeNode(node.argument) ? literalOf(node.argument.literal, true) : undefined;
  return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? dynamicOf(node) : undefined;
}

function literalOf(node: ts.Node, typeOnly: boolean): ImportStatement | undefined {
  return ts.isStringLiteral(node) ? { specifier: node.text, kind: typeOnly ? 'type' : 'runtime' } : undefined;
}

function requireOf(node: ts.ImportEqualsDeclaration): ImportStatement | undefined {
  return ts.isExternalModuleReference(node.moduleReference) ? literalOf(node.moduleReference.expression, node.isTypeOnly) : undefined;
}

// "declare module './x'" adds types to a local module. "declare module 'x'" describes an npm package and imports
// nothing.
function augmentationOf(node: ts.ModuleDeclaration): ImportStatement | undefined {
  return ts.isStringLiteral(node.name) && node.name.text.startsWith('.') ? literalOf(node.name, true) : undefined;
}

function dynamicOf(node: ts.CallExpression): ImportStatement {
  const argument = node.arguments[0];
  return argument && ts.isStringLiteralLike(argument) ? { specifier: argument.text, kind: 'runtime' } : { kind: 'runtime' };
}
