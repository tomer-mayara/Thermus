import { createHash } from 'node:crypto';
import { ts } from 'ts-morph';
import type { Declaration } from './declaration.ts';
import { normalizationVersion } from './types.ts';
import type { FunctionIdentity } from './types.ts';

interface IdentitySource { readonly node: Declaration; readonly body: ts.ConciseBody; readonly name: string; readonly owner: string }

// The syntax tree preserves ASI boundaries. Leaf text preserves literal contents,
// and JSON framing prevents adjacent tokens from collapsing into another token.
function syntaxFingerprint(nodes: ts.Node | readonly ts.Node[], excluded: readonly ts.Node[] = []): string {
  return createHash('sha256').update(JSON.stringify(Array.isArray(nodes) ? nodes.map((node) => syntaxOf(node, excluded)) : syntaxOf(nodes as ts.Node, excluded))).digest('hex');
}

function syntaxOf(node: ts.Node, excluded: readonly ts.Node[]): unknown {
  const children = node.getChildren().filter((child) => !excluded.includes(child) && child.kind !== ts.SyntaxKind.JSDocComment);
  if (children.length > 0) return [node.kind, children.map((child) => syntaxOf(child, excluded))];
  return [node.kind, node.getText()];
}

export function identityOf(candidate: IdentitySource): FunctionIdentity {
  const node = candidate.node;
  const binding = ts.isArrowFunction(node) || ts.isConstructorDeclaration(node) ? undefined : node.name;
  const variableType = ts.isVariableDeclaration(node.parent) ? node.parent.type : undefined;
  const excluded = [candidate.body, binding].filter((entry) => entry !== undefined);
  return {
    version: normalizationVersion, kind: ts.SyntaxKind[node.kind], owner: candidate.owner, name: candidate.name,
    start: node.getStart(), end: node.getEnd(),
    body: syntaxFingerprint(candidate.body), signature: syntaxFingerprint(variableType ? [node, variableType] : [node], excluded),
  };
}
