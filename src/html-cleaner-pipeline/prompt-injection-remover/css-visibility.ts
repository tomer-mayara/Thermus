import { generate, type CssNode, type Declaration } from 'css-tree';
import { DomUtils } from 'htmlparser2';
import {
  applyDeclarations, comparePrecedence, normalizeDeclarations, parseCss, type Declarations,
} from './css-visibility-rules.ts';
import {
  createSelectorMatcher, documentElements, type HtmlElement,
} from './css-visibility-selectors.ts';
import type { SourceHtmlDocument } from './css-visibility-tree.ts';
import { OpacityAnimations } from './css-opacity-animations.ts';

type StyleMap = Map<HtmlElement, Declarations>;
export type VisibilityStyle = string;

type RuleContext = {
  elements: readonly HtmlElement[];
  compileSelectors: ReturnType<typeof createSelectorMatcher>;
  styles: StyleMap;
  quirksMode: boolean;
};

function applyRule(rule: CssNode, context: RuleContext): void {
  if (rule.type !== 'Rule') return;
  const selectors = context.compileSelectors(rule.prelude);
  if (selectors === undefined) return;
  const declarations = normalizeDeclarations(rule.block.children.toArray(), context.quirksMode);
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

function createStyleSerializer(animations: OpacityAnimations) {
  const declarationIds = new Map<Declaration, number>();
  const results = new Map<string, VisibilityStyle>();
  return (declarations: Declarations): VisibilityStyle => {
    const values = [...declarations.values()].sort(comparePrecedence);
    const key = values.map(({ declaration }) => {
      let id = declarationIds.get(declaration);
      if (id === undefined) {
        id = declarationIds.size;
        declarationIds.set(declaration, id);
      }
      return id;
    }).join(',');
    const cached = results.get(key);
    if (cached !== undefined) return cached;
    const css = values.map(({ declaration }) => generate(declaration)).join(';');
    const hasUnknownBackgroundPaint = values.some(({ resolved, declaration }) =>
      !resolved && (declaration.property === 'background' || declaration.property === 'background-color'),
    );
    // Unresolved paint cannot prove a same-color hide, whether the value is shorthand or color.
    const unknownPaint = hasUnknownBackgroundPaint ? ';background-image:var(--unknown-background-paint)' : '';
    const unknownOpacity = animations.mayReveal(declarations) ? ';opacity:var(--animated-opacity)' : '';
    const style = `${css}${unknownPaint}${unknownOpacity}`;
    results.set(key, style);
    return style;
  };
}

export function resolveCssVisibility({ document, elements }: SourceHtmlDocument): Map<HtmlElement, VisibilityStyle> {
  const styles: StyleMap = new Map();
  const animations = new OpacityAnimations();
  const quirksMode = document['x-mode'] === 'quirks';
  const context = { elements, styles, quirksMode, compileSelectors: createSelectorMatcher(document) };
  for (const element of elements) {
    if (element.name !== 'style') continue;
    if (!isActiveStylesheet(element)) continue;
    for (const rule of parseCss(DomUtils.textContent(element), 'stylesheet')) {
      animations.add(rule);
      applyRule(rule, context);
    }
  }
  for (const element of documentElements(document, true)) {
    if (!Object.hasOwn(element.attribs, 'style')) continue;
    const target = styles.get(element) ?? new Map();
    const declarations = normalizeDeclarations(parseCss(element.attribs.style, 'declarationList'), quirksMode);
    applyDeclarations(target, declarations, [1, 0, 0, 0]);
    styles.set(element, target);
  }
  const serialize = createStyleSerializer(animations);
  return new Map([...styles].map(([element, declarations]) => [element, serialize(declarations)]));
}
