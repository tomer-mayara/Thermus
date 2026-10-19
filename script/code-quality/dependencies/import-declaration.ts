import { ts } from 'ts-morph';
import type { DependencyKind } from './types.ts';
import type { ImportReference } from './parse.ts';

export function importReference(node: ts.ImportDeclaration): ImportReference | undefined {
  if (!ts.isStringLiteral(node.moduleSpecifier)) return undefined;
  const clause = node.importClause;
  if (!clause) return { specifier: node.moduleSpecifier.text, kinds: ['side-effect'] };
  if (clause.isTypeOnly) return { specifier: node.moduleSpecifier.text, kinds: ['type'] };
  return { specifier: node.moduleSpecifier.text, kinds: clauseKinds(clause) };
}

export function externalReference(node: ts.ImportEqualsDeclaration): ImportReference | undefined {
  if (!ts.isExternalModuleReference(node.moduleReference)) return undefined;
  const expression = node.moduleReference.expression;
  if (!expression || !ts.isStringLiteral(expression)) return undefined;
  return { specifier: expression.text, kinds: [node.isTypeOnly ? 'type' : 'static'] };
}

function clauseKinds(clause: ts.ImportClause): readonly DependencyKind[] {
  const named = clause.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
  const kinds: DependencyKind[] = [];
  if (clause.name || !named.length || named.some((entry) => !entry.isTypeOnly)) kinds.push('static');
  if (named.some((entry) => entry.isTypeOnly)) kinds.push('type');
  return kinds;
}
