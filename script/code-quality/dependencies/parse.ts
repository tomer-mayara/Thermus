import { ts } from 'ts-morph';
import { importReference, externalReference } from './import-declaration.ts';
import { exportReference } from './export-declaration.ts';
import type { DependencyKind } from './types.ts';

export interface ImportReference {
  readonly specifier?: string;
  readonly kinds: readonly DependencyKind[];
}

export function importsIn(path: string, text: string): readonly ImportReference[] | undefined {
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  if ((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length) return undefined;
  const references: ImportReference[] = [];
  function visit(node: ts.Node): void {
    const reference = referenceOf(node);
    if (reference) references.push(reference);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return references;
}

function referenceOf(node: ts.Node): ImportReference | undefined {
  if (ts.isImportDeclaration(node)) return importReference(node);
  if (ts.isImportEqualsDeclaration(node)) return externalReference(node);
  if (ts.isExportDeclaration(node)) return exportReference(node);
  if (ts.isCallExpression(node)) return dynamicReference(node);
  if (ts.isImportTypeNode(node)) return typeReference(node);
  return undefined;
}

function dynamicReference(node: ts.CallExpression): ImportReference | undefined {
  if (node.expression.kind !== ts.SyntaxKind.ImportKeyword) return undefined;
  const argument = node.arguments[0];
  return { specifier: argument && ts.isStringLiteralLike(argument) ? argument.text : undefined, kinds: ['dynamic'] };
}

function typeReference(node: ts.ImportTypeNode): ImportReference | undefined {
  if (!ts.isLiteralTypeNode(node.argument) || !ts.isStringLiteral(node.argument.literal)) return undefined;
  return { specifier: node.argument.literal.text, kinds: ['type'] };
}
