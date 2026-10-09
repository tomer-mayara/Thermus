import { isHiddenStyle } from 'agent-input-sanitizer/html';
import { compile, selectAll } from 'css-select';
import { generate, type CssNode, type Declaration } from 'css-tree';
import { DomUtils, Parser, parseDocument } from 'htmlparser2';
import {
  applyDeclarations, normalizeDeclarations, parseCss, selectorSpecificity, type Declarations,
} from './css-visibility-rules.ts';

type HtmlElement = ReturnType<typeof DomUtils.getElementsByTagName>[number];
type HtmlNode = ReturnType<typeof parseDocument> | HtmlElement;
type StyleMap = Map<HtmlElement, Declarations>;
type Range = { start: number; end: number };
type VisibilityStyle = '' | 'display:none';

function compileSelectors(prelude: CssNode) {
  if (prelude.type !== 'SelectorList') return undefined;
  const selectors = [];
  try {
    for (const selector of prelude.children) {
      if (selector.type !== 'Selector') return undefined;
      const specificity = selectorSpecificity(selector);
      if (specificity === undefined) return undefined;
      selectors.push({ specificity, query: compile<HtmlNode, HtmlElement>(generate(selector)) });
    }
  } catch {
    return undefined;
  }
  return selectors;
}

function applyRule(rule: CssNode, document: ReturnType<typeof parseDocument>, styles: StyleMap): void {
  if (rule.type !== 'Rule') return;
  const selectors = compileSelectors(rule.prelude);
  if (selectors === undefined) return;
  const declarations = normalizeDeclarations(rule.block.children.toArray());
  if (declarations.length === 0) return;
  for (const { specificity, query } of selectors) {
    const matches = selectAll<HtmlNode, HtmlElement>(query, document);
    for (const element of matches) {
      const target = styles.get(element) ?? new Map();
      applyDeclarations(target, declarations, specificity);
      styles.set(element, target);
    }
  }
}

function isActiveStylesheet(element: HtmlElement): boolean {
  const type = (element.attribs.type ?? '').trim().toLowerCase();
  const media = (element.attribs.media ?? '').trim().toLowerCase();
  if (type !== '' && type !== 'text/css') return false;
  if (media !== '' && media !== 'all') return false;
  for (let parent = element.parent; parent !== null; parent = parent.parent) {
    if ('name' in parent && parent.name === 'template') return false;
  }
  return true;
}

function createStyleClassifier() {
  const declarationIds = new Map<Declaration, number>();
  const results = new Map<string, VisibilityStyle>();
  return (declarations: Declarations): VisibilityStyle => {
    const values = [...declarations.values()];
    const key = values.map(({ declaration }) => {
      let id = declarationIds.get(declaration);
      if (id === undefined) {
        id = declarationIds.size;
        declarationIds.set(declaration, id);
      }
      return id;
    }).sort((left, right) => left - right).join(',');
    const cached = results.get(key);
    if (cached !== undefined) return cached;
    const css = values
      .filter(({ resolved, declaration }) => resolved || declaration.property === 'background-image')
      .map(({ declaration }) => generate(declaration)).join(';');
    const style = isHiddenStyle(css) ? 'display:none' : '';
    results.set(key, style);
    return style;
  };
}

function resolveStyles(html: string): Map<number, VisibilityStyle> {
  const document = parseDocument(html, { withStartIndices: true });
  const styles: StyleMap = new Map();
  for (const element of selectAll<HtmlNode, HtmlElement>('style', document)) {
    if (!isActiveStylesheet(element)) continue;
    for (const rule of parseCss(DomUtils.textContent(element), 'stylesheet')) {
      applyRule(rule, document, styles);
    }
  }
  for (const element of selectAll<HtmlNode, HtmlElement>('[style]', document)) {
    const target = styles.get(element) ?? new Map();
    const declarations = normalizeDeclarations(parseCss(element.attribs.style, 'declarationList'));
    applyDeclarations(target, declarations, [1, 0, 0, 0]);
    styles.set(element, target);
  }
  const resolved = new Map<number, VisibilityStyle>();
  const classify = createStyleClassifier();
  for (const [element, declarations] of styles) {
    if (element.startIndex === null) continue;
    resolved.set(element.startIndex, classify(declarations));
  }
  return resolved;
}

export function applyCssVisibility(html: string): string {
  const styles = resolveStyles(html);
  if (styles.size === 0) return html;
  const chunks: string[] = [];
  let copiedThrough = 0;
  let tagNameEnd = 0;
  let styleRange: Range | undefined;
  const parser = new Parser({
    onopentagname() {
      tagNameEnd = parser.endIndex;
      styleRange = undefined;
    },
    onattribute(name) {
      if (name === 'style' && styleRange === undefined) {
        styleRange = { start: parser.startIndex, end: parser.endIndex };
      }
    },
    onopentag(_name, _attributes, implied) {
      const css = styles.get(parser.startIndex);
      if (implied || css === undefined) return;
      const range = styleRange ?? { start: tagNameEnd, end: tagNameEnd };
      const separator = styleRange === undefined ? ' ' : '';
      chunks.push(html.slice(copiedThrough, range.start), `${separator}style="${css}"`);
      copiedThrough = range.end;
    },
  });
  parser.end(html);
  chunks.push(html.slice(copiedThrough));
  return chunks.join('');
}
