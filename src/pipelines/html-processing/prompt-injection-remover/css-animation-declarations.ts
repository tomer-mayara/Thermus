import { generate, ident, lexer, parse, type CssNode, type Declaration, type SyntaxMatchNode } from 'css-tree';

export function singleAnimationValue(value: CssNode): CssNode | undefined {
  return value.type === 'Value' && value.children.size === 1 ? value.children.first ?? undefined : undefined;
}

export function animationName(node: CssNode | undefined): string | undefined {
  if (node?.type === 'Identifier') {
    const name = ident.decode(node.name);
    return /^(none|initial|inherit|unset|revert|revert-layer)$/i.test(name) ? undefined : name;
  }
  return node?.type === 'String' ? node.value : undefined;
}

const defaults = {
  'animation-name': 'none',
  'animation-duration': '0s',
  'animation-delay': '0s',
  'animation-iteration-count': '1',
  'animation-direction': 'normal',
  'animation-play-state': 'running',
  'animation-fill-mode': 'none',
  'animation-timing-function': 'ease',
};

const shorthandParts: Record<string, string> = {
  'keyframes-name': 'animation-name',
  'single-animation-iteration-count': 'animation-iteration-count',
  'single-animation-direction': 'animation-direction',
  'single-animation-play-state': 'animation-play-state',
  'single-animation-fill-mode': 'animation-fill-mode',
  'easing-function': 'animation-timing-function',
  'animation-duration': 'animation-duration',
  'animation-delay': 'animation-delay',
};

function firstNode(part: SyntaxMatchNode): string | undefined {
  if (part.node) return generate(part.node);
  const child = part.match?.[0];
  return child ? firstNode(child) : undefined;
}

function declaration(node: Declaration, property: string, value: string): Declaration {
  return { ...node, property, value: parse(value, { context: 'value' }) as Declaration['value'] };
}

function validImportance(node: Declaration): boolean {
  if (typeof node.important !== 'string') return true;
  if (ident.decode(node.important).toLowerCase() !== 'important') return false;
  node.important = true;
  return true;
}

function resetsToInitial(value: string): boolean {
  return ['initial', 'unset'].includes(ident.decode(value).toLowerCase());
}

function singleAnimation(parts: SyntaxMatchNode[] | undefined): SyntaxMatchNode | undefined {
  return parts?.length === 1 && parts[0].syntax?.name === 'single-animation' ? parts[0] : undefined;
}

function longhandOf(part: SyntaxMatchNode): [name: string, value: string] | undefined {
  const name = shorthandParts[part.syntax?.name ?? ''];
  const parsed = firstNode(part);
  return name && parsed !== undefined ? [name, parsed] : undefined;
}

function longhandValues(single: SyntaxMatchNode | undefined): Record<string, string> {
  const values: Record<string, string> = { ...defaults };
  for (const part of single?.match ?? []) {
    const longhand = longhandOf(part);
    if (longhand !== undefined) values[longhand[0]] = longhand[1];
  }
  return values;
}

function expandShorthand(node: Declaration, value: string, parts: SyntaxMatchNode[] | undefined): Declaration[] {
  const single = singleAnimation(parts);
  if (!resetsToInitial(value) && !single) {
    return Object.keys(defaults).map((name) => declaration(node, name, value));
  }
  return Object.entries(longhandValues(single)).map(([name, parsed]) => declaration(node, name, parsed));
}

export function animationDeclarations(node: Declaration): Declaration[] | undefined {
  const property = ident.decode(node.property).toLowerCase();
  if (property !== 'animation' && !Object.hasOwn(defaults, property)) return undefined;
  if (!validImportance(node)) return [];
  const match = lexer.matchProperty(property, node.value);
  if (match.error) return [];
  const value = generate(node.value);
  if (property === 'animation') return expandShorthand(node, value, match.matched?.match);
  const normalized = resetsToInitial(value) ? defaults[property as keyof typeof defaults] : value;
  return [declaration(node, property, normalized)];
}
