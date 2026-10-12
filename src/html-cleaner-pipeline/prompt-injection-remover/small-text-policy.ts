import type { ElementVisibility } from 'agent-input-sanitizer/html';
import { html } from 'parse5';
import type { Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';

export type SmallTextOptions = { minTextFontSizePx?: number };

export class SmallTextPolicy {
  private static readonly nonTextInputTypes = new Set([
    'hidden', 'date', 'month', 'week', 'time', 'datetime-local', 'number', 'range', 'color',
    'checkbox', 'radio', 'file', 'submit', 'image', 'reset', 'button',
  ]);
  private readonly minTextFontSizePx: number;

  public constructor({ minTextFontSizePx = 12 }: SmallTextOptions = {}) {
    if (!Number.isFinite(minTextFontSizePx) || minTextFontSizePx < 0) {
      throw new RangeError('minTextFontSizePx must be finite and nonnegative');
    }
    this.minTextFontSizePx = minTextFontSizePx;
  }

  public apply(node: Htmlparser2TreeAdapterMap['element'], visibility: ElementVisibility): ElementVisibility {
    const small = this.hides(visibility);
    return {
      ...visibility,
      hiddenText: visibility.hiddenText || small,
      hiddenReplacedContent: visibility.hiddenReplacedContent || small && SmallTextPolicy.hasTextInputValue(node),
    };
  }

  private static hasTextInputValue(node: Htmlparser2TreeAdapterMap['element']): boolean {
    if (node.namespace !== html.NS.HTML || node.name !== 'input' || !node.attribs.value) return false;
    const type = (node.attribs.type ?? '').replace(/[A-Z]/g, (letter) => letter.toLowerCase());
    return !SmallTextPolicy.nonTextInputTypes.has(type);
  }

  private hides(visibility: ElementVisibility): boolean {
    const { fontSize, matrix, linearError, hasPerspective } = visibility;
    if (this.minTextFontSizePx === 0 || fontSize === null || !matrix || !linearError || hasPerspective) {
      return false;
    }
    const axes = [0, 1].map((column) => Math.hypot(...[0, 1].map((row) =>
      Math.abs(matrix[row][column]) + linearError[row][column])));
    if (!axes.every(Number.isFinite)) return false;
    const size = fontSize * Math.min(...axes);
    // Keep the boundary when multiplication or the axis norm rounds down.
    const upperSize = size + Math.abs(size) * Number.EPSILON * 8;
    return Number.isFinite(upperSize) && upperSize < this.minTextFontSizePx;
  }
}
