import {
  ident, lexer, parse, tokenize, tokenTypes, walk,
  type AttributeSelector, type CssNode, type Declaration, type Selector,
} from 'css-tree';
import { isValidVisibilityValue } from 'agent-input-sanitizer/html';

type Specificity = readonly [inline: number, ids: number, classes: number, types: number];
type ParsedDeclaration = { declaration: Declaration; resolved: boolean };
type RankedDeclaration = ParsedDeclaration & { specificity: Specificity };
export type Declarations = Map<string, RankedDeclaration>;

const visibilityProperties = new Set([
  'display', 'visibility', 'content-visibility', 'opacity', 'font-size', 'font',
  'position', 'left', 'top', 'right', 'bottom', 'text-indent', 'clip', 'clip-path',
  'transform', 'filter', 'color', '-webkit-text-fill-color', 'background-color',
  'background', 'background-image', 'background-clip', '-webkit-background-clip',
  '-webkit-text-stroke', '-webkit-text-stroke-color', 'overflow',
  'height', 'width', 'max-height', 'max-width',
  'float', 'transform-style', 'perspective', 'overflow-x', 'overflow-y',
  'isolation', 'mask', 'mask-image', 'mask-border', 'mask-border-source', 'mix-blend-mode', 'contain',
]);

function normalizedIdent(value: string): string {
  return ident.encode(ident.decode(value).toLowerCase());
}

export function parseCss(text: string, context: 'stylesheet' | 'declarationList'): CssNode[] {
  try {
    const ast = parse(text, { context });
    if (ast.type === 'StyleSheet' || ast.type === 'DeclarationList') {
      return ast.children.toArray();
    }
  } catch {
    return [];
  }
  return [];
}

function normalizeValue(value: CssNode): boolean {
  let resolved = true;
  walk(value, (token) => {
    if (token.type === 'Dimension') token.unit = normalizedIdent(token.unit);
    if (token.type === 'Identifier' && !token.name.startsWith('--')) {
      token.name = normalizedIdent(token.name);
    }
    if (token.type === 'Function') {
      token.name = normalizedIdent(token.name);
      if (['var', 'env', 'attr'].includes(token.name)) resolved = false;
    }
  });
  return resolved;
}

function isValidValue(declaration: Declaration): boolean {
  if (lexer.matchProperty(declaration.property, declaration.value).error) return false;
  if (declaration.property === 'filter' && declaration.value.type === 'Value') {
    return declaration.value.children.toArray().every(isValidFilterToken);
  }
  return true;
}

function isValidFilterToken(token: CssNode): boolean {
  if (token.type !== 'Function') return true;
  if (lexer.matchType('filter-function', token).error) return false;
  if (token.name === 'hue-rotate') return true;
  const lengths = token.children.toArray().filter((child) =>
    child.type === 'Dimension' || child.type === 'Number' || child.type === 'Percentage',
  );
  const nonNegative = token.name === 'drop-shadow' ? lengths.slice(2) : lengths;
  return nonNegative.every((length) => Number(length.value) >= 0);
}

function normalizeDeclaration(node: Declaration, quirksMode: boolean): ParsedDeclaration | undefined {
  node.property = normalizedIdent(node.property);
  if (!visibilityProperties.has(node.property) && !/^(?:margin|inset)(?:-|$)/.test(node.property)) return undefined;
  if (typeof node.important === 'string') {
    if (normalizedIdent(node.important) !== 'important') return undefined;
    node.important = true;
  }
  const resolved = normalizeValue(node.value);
  if (!isValidVisibilityValue(node.property, node.value, quirksMode)) return undefined;
  if (node.property === 'filter' && resolved && !isValidValue(node)) return undefined;
  return { declaration: node, resolved };
}

export function normalizeDeclarations(nodes: CssNode[], quirksMode = false): ParsedDeclaration[] {
  const declarations: ParsedDeclaration[] = [];
  for (const node of nodes) {
    if (node.type !== 'Declaration') continue;
    const declaration = normalizeDeclaration(node, quirksMode);
    if (declaration) declarations.push(declaration);
  }
  return declarations;
}

function isIdentifier(name: string): boolean {
  let valid = false;
  tokenize(name, (type, start, end) => {
    valid = type === tokenTypes.Ident && start === 0 && end === name.length;
  });
  return valid;
}

function attributeSelectorWeight(node: AttributeSelector): Specificity | undefined {
  if (!isIdentifier(node.name.name)) return undefined;
  if (node.value?.type === 'Identifier' && !isIdentifier(node.value.name)) return undefined;
  if (node.flags !== null) {
    if (node.matcher === null) return undefined;
    if (!/^[is]$/.test(normalizedIdent(node.flags))) return undefined;
  }
  return [0, 0, 1, 0];
}

function selectorWeight(node: CssNode): Specificity | undefined {
  switch (node.type) {
    case 'IdSelector': return isIdentifier(node.name) ? [0, 1, 0, 0] : undefined;
    case 'ClassSelector': return isIdentifier(node.name) ? [0, 0, 1, 0] : undefined;
    case 'AttributeSelector': return attributeSelectorWeight(node);
    case 'TypeSelector':
      if (node.name === '*') return [0, 0, 0, 0];
      return isIdentifier(node.name) ? [0, 0, 0, 1] : undefined;
    default: return undefined;
  }
}

export function selectorSpecificity(selector: Selector): Specificity | undefined {
  const specificity: [number, number, number, number] = [0, 0, 0, 0];
  let compoundStart = true;
  for (const node of selector.children) {
    if (node.type === 'Combinator') {
      if (compoundStart || ![' ', '>', '+', '~'].includes(node.name)) return undefined;
      compoundStart = true;
      continue;
    }
    if (node.type === 'TypeSelector' && !compoundStart) return undefined;
    const weight = selectorWeight(node);
    if (weight === undefined) return undefined;
    for (let index = 0; index < specificity.length; index++) {
      specificity[index] += weight[index];
    }
    compoundStart = false;
  }
  return compoundStart ? undefined : specificity;
}

export function comparePrecedence(next: RankedDeclaration, previous: RankedDeclaration): number {
  if (next.declaration.important !== previous.declaration.important) {
    return Number(Boolean(next.declaration.important)) - Number(Boolean(previous.declaration.important));
  }
  for (let index = 0; index < next.specificity.length; index++) {
    if (next.specificity[index] !== previous.specificity[index]) {
      return next.specificity[index] - previous.specificity[index];
    }
  }
  return 0;
}

export function applyDeclarations(
  target: Declarations,
  declarations: ParsedDeclaration[],
  specificity: Specificity,
): void {
  for (const parsed of declarations) {
    const candidate = { ...parsed, specificity };
    const previous = target.get(parsed.declaration.property);
    if (previous === undefined || comparePrecedence(candidate, previous) >= 0) {
      // Keep the winning source order for related shorthand and longhand values.
      target.delete(parsed.declaration.property);
      target.set(parsed.declaration.property, candidate);
    }
  }
}
