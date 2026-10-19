import { ts } from 'ts-morph';
import type { ImportReference } from './parse.ts';

export function exportReference(node: ts.ExportDeclaration): ImportReference | undefined {
  if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return undefined;
  const named = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : [];
  const hasTypes = node.isTypeOnly || named.some((entry) => entry.isTypeOnly);
  return { specifier: node.moduleSpecifier.text, kinds: hasTypes ? ['re-export', 'type'] : ['re-export'] };
}
