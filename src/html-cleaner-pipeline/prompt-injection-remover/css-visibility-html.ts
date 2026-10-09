import { adapter } from 'parse5-htmlparser2-tree-adapter';
import type { HtmlElement } from './css-visibility-selectors.ts';
import type { CssHtmlDocument, SourceElement } from './css-visibility-tree.ts';

type HtmlEdit = { start: number; end: number; replacement: string };
export type VisibilityStyle = '' | 'display:none';
type VisibilityMap = Map<HtmlElement, {
  css: VisibilityStyle;
  contentOnly: boolean;
  source: HtmlElement;
  clearSourceAttributes: boolean;
}>;
const fragmentWrapperTags = new Set(['html', 'head', 'body']);


function contentOnlyElements(elements: HtmlElement[], sourceElement: SourceElement): Set<HtmlElement> {
  const result = new Set<HtmlElement>();
  const sourceElements = new Map<HtmlElement, HtmlElement>();
  for (const element of elements) {
    if (element.startIndex === null || fragmentWrapperTags.has(element.name)) {
      result.add(element);
    }
    const source = sourceElement(element);
    if (source !== element) result.add(element);
    const previous = sourceElements.get(source);
    if (previous !== undefined) {
      result.add(previous);
      result.add(element);
    }
    sourceElements.set(source, element);
  }
  return result;
}

function sourceCopyStates(
  elements: HtmlElement[], resolved: VisibilityMap, sourceElement: SourceElement,
) {
  const visibleSourceTags = new Set<HtmlElement>();
  const unlocatedCopies = new Set<HtmlElement>();
  for (const element of elements) {
    const source = sourceElement(element);
    if (resolved.get(element)?.css !== 'display:none') visibleSourceTags.add(source);
    if (element.startIndex === null && source !== element) unlocatedCopies.add(source);
  }
  return { visibleSourceTags, unlocatedCopies };
}

function markFullyHiddenSourceTags(
  elements: HtmlElement[], resolved: VisibilityMap, sourceElement: SourceElement,
): void {
  const { visibleSourceTags, unlocatedCopies } = sourceCopyStates(elements, resolved, sourceElement);
  for (const visibility of resolved.values()) {
    const { source } = visibility;
    if (source.startIndex === null || fragmentWrapperTags.has(source.name)) continue;
    if (visibleSourceTags.has(source)) continue;
    if (unlocatedCopies.has(source)) visibility.clearSourceAttributes = true;
    else visibility.contentOnly = false;
  }
}

function classifyElements(
  elements: HtmlElement[], styles: Map<HtmlElement, VisibilityStyle>, sourceElement: SourceElement,
): VisibilityMap {
  const resolved: VisibilityMap = new Map();
  const contentElements = contentOnlyElements(elements, sourceElement);
  const hiddenContentParents = new Set<HtmlElement>();
  for (const element of elements) {
    const parentIsHidden = element.parent !== null && adapter.isElementNode(element.parent)
      && hiddenContentParents.has(element.parent);
    const css = parentIsHidden ? 'display:none' : styles.get(element);
    if (css === undefined) continue;
    const contentOnly = contentElements.has(element);
    resolved.set(element, { css, contentOnly, source: sourceElement(element), clearSourceAttributes: false });
    if (contentOnly && css === 'display:none') hiddenContentParents.add(element);
  }
  markFullyHiddenSourceTags(elements, resolved, sourceElement);
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

function hiddenTextEdits(element: HtmlElement): HtmlEdit[] {
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

function hiddenSourceTagEdit(source: HtmlElement): HtmlEdit | undefined {
  const location = adapter.getNodeSourceCodeLocation(source);
  if (location?.startTag === undefined) return undefined;
  const { startOffset: start, endOffset: end } = location.startTag;
  return { start, end, replacement: `<${source.name}><span style="display:none"></span>` };
}

function visibilityEdits(visibility: VisibilityMap): HtmlEdit[] {
  const sourceEdits = new Map<number, HtmlEdit>();
  const textEdits: HtmlEdit[] = [];
  for (const [element, { css, contentOnly, source, clearSourceAttributes }] of visibility) {
    const edit = clearSourceAttributes ? hiddenSourceTagEdit(source)
      : elementStyleEdit(source, contentOnly ? '' : css);
    if (edit !== undefined) sourceEdits.set(edit.start, edit);
    if (contentOnly && css === 'display:none') {
      for (const edit of hiddenTextEdits(element)) textEdits.push(edit);
    }
  }
  return [...sourceEdits.values(), ...textEdits];
}

function applyHtmlEdits(html: string, edits: HtmlEdit[]): string {
  if (edits.length === 0) return html;
  const chunks: string[] = [];
  let copiedThrough = 0;
  for (const { start, end, replacement } of edits.sort((left, right) => left.start - right.start)) {
    chunks.push(html.slice(copiedThrough, start), replacement);
    copiedThrough = end;
  }
  chunks.push(html.slice(copiedThrough));
  return chunks.join('');
}

export function applyElementVisibility(
  html: string, tree: CssHtmlDocument, styles: Map<HtmlElement, VisibilityStyle>,
): string {
  const visibility = classifyElements(tree.elements, styles, tree.sourceElement);
  return applyHtmlEdits(html, visibilityEdits(visibility));
}
