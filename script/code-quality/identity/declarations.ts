import { ts } from 'ts-morph';
import { declarationName, isDeclaration } from './declaration.ts';
import type { Declaration } from './declaration.ts';

export interface Candidate { readonly node: Declaration; readonly name?: string; readonly owner: string }

export function declarationsOf(tree: ts.SourceFile): readonly Candidate[] {
  const candidates: Candidate[] = [];
  visit(tree, candidates);
  return candidates;
}

function visit(node: ts.Node, candidates: Candidate[]): void {
  if (isDeclaration(node) && node.body) candidates.push({ node, name: declarationName(node), owner: ownerOf(node) });
  node.forEachChild((child) => visit(child, candidates));
}

function ownerOf(node: Declaration): string {
  const owners: string[] = [];
  for (let parent = node.parent; parent && !ts.isSourceFile(parent); parent = parent.parent) {
    const label = ownerLabelOf(parent);
    if (label !== undefined) owners.unshift(label);
  }
  return owners.join('/');
}

function ownerLabelOf(node: ts.Node): string | undefined {
  if (isDeclaration(node)) return `${ts.SyntaxKind[node.kind]}:${declarationName(node) ?? `@${node.getStart()}`}`;
  if (ts.isClassDeclaration(node)) return `ClassDeclaration:${node.name?.text ?? `@${node.getStart()}`}`;
  if (ts.isObjectLiteralExpression(node) || ts.isClassExpression(node) || ts.isModuleDeclaration(node)) return `${ts.SyntaxKind[node.kind]}:@${node.getStart()}`;
  return undefined;
}
