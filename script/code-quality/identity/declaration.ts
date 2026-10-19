import { ts } from 'ts-morph';

export type Declaration = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration | ts.ConstructorDeclaration;

export function isDeclaration(node: ts.Node): node is Declaration {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isConstructorDeclaration(node);
}

export function declarationName(node: Declaration): string | undefined {
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (!ts.isArrowFunction(node) && node.name && ts.isIdentifier(node.name)) return node.name.text;
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) return node.parent.name.text;
  return undefined;
}
