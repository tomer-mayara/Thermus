import {
  ident, lexer, parse, tokenize, tokenTypes, walk,
  type CssNode, type Declaration, type Selector,
} from 'css-tree';

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
      if (token.name === 'var' || token.name === 'env') resolved = false;
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

export function normalizeDeclarations(nodes: CssNode[]): ParsedDeclaration[] {
  const declarations: ParsedDeclaration[] = [];
  for (const node of nodes) {
    if (node.type !== 'Declaration') continue;
    node.property = normalizedIdent(node.property);
    if (!visibilityProperties.has(node.property)) continue;
    if (typeof node.important === 'string') {
      if (normalizedIdent(node.important) !== 'important') continue;
      node.important = true;
    }
    const resolved = normalizeValue(node.value);
    if (resolved && !isValidValue(node)) continue;
    declarations.push({ declaration: node, resolved });
  }
  return declarations;
}

function hasNamespace(name: string): boolean {
  let namespace = false;
  tokenize(name, (type, start, end) => {
    if (type === tokenTypes.Delim && name.slice(start, end) === '|') namespace = true;
  });
  return namespace;
}

function selectorWeight(node: CssNode): Specificity | undefined {
  switch (node.type) {
    case 'IdSelector': return [0, 1, 0, 0];
    case 'ClassSelector': return [0, 0, 1, 0];
    case 'AttributeSelector':
      if (hasNamespace(node.name.name)) return undefined;
      if (node.flags !== null) {
        node.flags = normalizedIdent(node.flags);
        if (!/^[is]$/.test(node.flags)) return undefined;
      }
      return [0, 0, 1, 0];
    case 'TypeSelector':
      if (hasNamespace(node.name)) return undefined;
      return [0, 0, 0, Number(node.name !== '*')];
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

function takesPrecedence(next: RankedDeclaration, previous: RankedDeclaration): boolean {
  if (next.declaration.important !== previous.declaration.important) {
    return Boolean(next.declaration.important);
  }
  for (let index = 0; index < next.specificity.length; index++) {
    if (next.specificity[index] !== previous.specificity[index]) {
      return next.specificity[index] > previous.specificity[index];
    }
  }
  return true;
}

export function applyDeclarations(
  target: Declarations,
  declarations: ParsedDeclaration[],
  specificity: Specificity,
): void {
  for (const parsed of declarations) {
    const candidate = { ...parsed, specificity };
    const previous = target.get(parsed.declaration.property);
    if (previous === undefined || takesPrecedence(candidate, previous)) {
      target.set(parsed.declaration.property, candidate);
    }
  }
}
