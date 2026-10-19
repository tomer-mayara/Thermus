import { ident, type AttributeSelector, type CssNode } from 'css-tree';
import type { HtmlElement } from './css-visibility-selectors.ts';

type MatchContext = {
  getAttributeValue(element: HtmlElement, name: string): string | undefined;
  getName(element: HtmlElement): string;
  hasClass(element: HtmlElement, name: string): boolean;
  quirksMode: boolean;
};
type AttributeMatch = {
  name: string;
  matcher: string | null;
  value: string;
  insensitive: boolean;
};

const htmlWhitespace = /[\t\n\f\r ]/;
const insensitiveHtmlAttributes = new Set([
  'accept', 'accept-charset', 'align', 'alink', 'axis', 'bgcolor', 'charset',
  'checked', 'clear', 'codetype', 'color', 'compact', 'declare', 'defer', 'dir',
  'direction', 'disabled', 'enctype', 'face', 'frame', 'hreflang', 'http-equiv',
  'lang', 'language', 'link', 'media', 'method', 'multiple', 'nohref', 'noresize',
  'noshade', 'nowrap', 'readonly', 'rel', 'rev', 'rules', 'scope', 'scrolling',
  'selected', 'shape', 'target', 'text', 'type', 'valign', 'valuetype', 'vlink',
]);

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function attributeMatches(actual: string, expected: string, matcher: string): boolean {
  if (matcher === '=') return actual === expected;
  if (matcher === '|=') return actual === expected || actual.startsWith(`${expected}-`);
  if (expected === '') return false;
  switch (matcher) {
    case '~=': return actual.split(htmlWhitespace).includes(expected);
    case '^=': return actual.startsWith(expected);
    case '$=': return actual.endsWith(expected);
    case '*=': return actual.includes(expected);
    default: return false;
  }
}

function attributePredicate(match: AttributeMatch, context: MatchContext) {
  const expected = match.insensitive ? asciiLower(match.value) : match.value;
  if (match.matcher === '~=' && htmlWhitespace.test(expected)) return () => false;
  return (element: HtmlElement) => {
    const value = context.getAttributeValue(element, match.name);
    if (value === undefined) return false;
    if (match.matcher === null) return true;
    const actual = match.insensitive ? asciiLower(value) : value;
    return attributeMatches(actual, expected, match.matcher);
  };
}

function attributeMatch(node: AttributeSelector): AttributeMatch {
  const name = asciiLower(ident.decode(node.name.name));
  const value = node.value?.type === 'Identifier'
    ? ident.decode(node.value.name) : node.value?.value ?? '';
  const flags = node.flags === null ? null : ident.decode(node.flags).toLowerCase();
  const insensitive = flags === 'i'
    || (flags === null && insensitiveHtmlAttributes.has(name));
  return { name, value, matcher: node.matcher, insensitive };
}

function classPredicate(name: string, context: MatchContext) {
  const expected = context.quirksMode ? asciiLower(name) : name;
  if (expected === '' || htmlWhitespace.test(expected)) return () => false;
  return (element: HtmlElement) => context.hasClass(element, expected);
}

export function simpleSelectorPredicate(node: CssNode, context: MatchContext) {
  switch (node.type) {
    case 'AttributeSelector': return attributePredicate(attributeMatch(node), context);
    case 'ClassSelector':
      return classPredicate(ident.decode(node.name), context);
    case 'IdSelector':
      return attributePredicate({
        name: 'id', matcher: '=', value: ident.decode(node.name),
        insensitive: context.quirksMode,
      }, context);
    case 'TypeSelector': {
      if (node.name === '*') return () => true;
      const name = asciiLower(ident.decode(node.name));
      return (element: HtmlElement) => asciiLower(context.getName(element)) === name;
    }
    default: return () => false;
  }
}
