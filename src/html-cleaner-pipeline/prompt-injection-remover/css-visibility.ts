import { isHiddenStyle } from 'agent-input-sanitizer/html';
import { generate, type CssNode, type Declaration } from 'css-tree';
import { DomUtils } from 'htmlparser2';
import { parse } from 'parse5';
import { adapter } from 'parse5-htmlparser2-tree-adapter';
import {
  applyDeclarations, normalizeDeclarations, parseCss, type Declarations,
} from './css-visibility-rules.ts';
import {
  createSelectorMatcher, documentElements, type HtmlElement,
} from './css-visibility-selectors.ts';

type StyleMap = Map<HtmlElement, Declarations>;
type HtmlEdit = { start: number; end: number; replacement: string };
type VisibilityStyle = '' | 'display:none';
type VisibilityMap = Map<HtmlElement, VisibilityStyle>;

type RuleContext = {
  elements: HtmlElement[];
  compileSelectors: ReturnType<typeof createSelectorMatcher>;
  styles: StyleMap;
};

function applyRule(rule: CssNode, context: RuleContext): void {
  if (rule.type !== 'Rule') return;
  const selectors = context.compileSelectors(rule.prelude);
  if (selectors === undefined) return;
  const declarations = normalizeDeclarations(rule.block.children.toArray());
  if (declarations.length === 0) return;
  for (const { specificity, query } of selectors) {
    const matches = context.elements.filter(query);
    for (const element of matches) {
      const target = context.styles.get(element) ?? new Map();
      applyDeclarations(target, declarations, specificity);
      context.styles.set(element, target);
    }
  }
}

function isActiveStylesheet(element: HtmlElement): boolean {
  const type = (element.attribs.type ?? '').trim().toLowerCase();
  const media = (element.attribs.media ?? '').trim().toLowerCase();
  if (type !== '' && type !== 'text/css') return false;
  if (media !== '' && media !== 'all') return false;
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

function resolveStyles(html: string): VisibilityMap {
  const document = parse(html, { treeAdapter: adapter, sourceCodeLocationInfo: true });
  const elements = documentElements(document);
  const styles: StyleMap = new Map();
  const context = { elements, styles, compileSelectors: createSelectorMatcher(document) };
  for (const element of elements) {
    if (element.name !== 'style') continue;
    if (!isActiveStylesheet(element)) continue;
    for (const rule of parseCss(DomUtils.textContent(element), 'stylesheet')) {
      applyRule(rule, context);
    }
  }
  for (const element of elements) {
    if (!Object.hasOwn(element.attribs, 'style')) continue;
    const target = styles.get(element) ?? new Map();
    const declarations = normalizeDeclarations(parseCss(element.attribs.style, 'declarationList'));
    applyDeclarations(target, declarations, [1, 0, 0, 0]);
    styles.set(element, target);
  }
  return classifyElements(elements, styles);
}

function classifyElements(elements: HtmlElement[], styles: StyleMap): VisibilityMap {
  const resolved: VisibilityMap = new Map();
  const classify = createStyleClassifier();
  const hiddenImpliedElements = new Set<HtmlElement>();
  for (const element of elements) {
    const parentIsHidden = element.parent !== null && adapter.isElementNode(element.parent)
      && hiddenImpliedElements.has(element.parent);
    const declarations = styles.get(element);
    const css = parentIsHidden ? 'display:none' : declarations && classify(declarations);
    if (css === undefined) continue;
    resolved.set(element, css);
    if (element.startIndex === null && css === 'display:none') hiddenImpliedElements.add(element);
  }
  return resolved;
}

function elementStyleEdit(element: HtmlElement, css: VisibilityStyle): HtmlEdit | undefined {
  const location = adapter.getNodeSourceCodeLocation(element);
  if (location?.startTag === undefined) return undefined;
  const style = location.attrs?.style;
  const start = style?.startOffset ?? location.startOffset + 1 + element.name.length;
  const end = style?.endOffset ?? start;
  const separator = style === undefined ? ' ' : '';
  return { start, end, replacement: `${separator}style="${css}"` };
}

function hiddenImpliedTextEdits(element: HtmlElement): HtmlEdit[] {
  const edits: HtmlEdit[] = [];
  for (const node of element.children) {
    if (!adapter.isTextNode(node)) continue;
    const location = adapter.getNodeSourceCodeLocation(node);
    if (location === undefined || location === null) continue;
    const { startOffset: start, endOffset: end } = location;
    edits.push(
      { start, end: start, replacement: '<span style="display:none">' },
      { start: end, end, replacement: '</span>' },
    );
  }
  return edits;
}

export function applyCssVisibility(html: string): string {
  const edits = new Map<number, HtmlEdit>();
  for (const [element, css] of resolveStyles(html)) {
    const edit = elementStyleEdit(element, css);
    if (edit !== undefined) {
      edits.set(edit.start, edit);
    } else if (css === 'display:none') {
      for (const textEdit of hiddenImpliedTextEdits(element)) {
        edits.set(textEdit.start, textEdit);
      }
    }
  }
  if (edits.size === 0) return html;
  const chunks: string[] = [];
  let copiedThrough = 0;
  for (const { start, end, replacement } of [...edits.values()].sort((left, right) => left.start - right.start)) {
    chunks.push(html.slice(copiedThrough, start), replacement);
    copiedThrough = end;
  }
  chunks.push(html.slice(copiedThrough));
  return chunks.join('');
}
