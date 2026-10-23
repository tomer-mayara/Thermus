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
    if (isDeclaration(parent)) {
      const name = declarationName(parent);
      owners.unshift(`${ts.SyntaxKind[parent.kind]}:${name ?? `@${parent.getStart()}`}`);
    } else if (ts.isClassDeclaration(parent)) {
      owners.unshift(`ClassDeclaration:${parent.name?.text ?? `@${parent.getStart()}`}`);
    } else if (ts.isObjectLiteralExpression(parent) || ts.isClassExpression(parent) || ts.isModuleDeclaration(parent)) {
      owners.unshift(`${ts.SyntaxKind[parent.kind]}:@${parent.getStart()}`);
    }
  }
  return owners.join('/');
}
