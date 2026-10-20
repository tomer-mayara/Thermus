import { ident, type CssNode, type Declaration } from 'css-tree';
import { isValidVisibilityValue } from 'agent-input-sanitizer/html';
import { animationName, singleAnimationValue } from './css-animation-declarations.ts';

type OpacityFrames = Map<number, number | undefined>;
export type OpacityRevealFacts = { known: boolean; visible: boolean; finalVisible: boolean };
const visibleOpacity = 0.01;
const namedOffsets: ReadonlyMap<string, number> = new Map([['from', 0], ['to', 100]]);

function offsetOf(selector: CssNode): number | undefined {
  if (selector.type !== 'Selector' || selector.children.size !== 1) return undefined;
  const node = selector.children.first;
  if (node?.type === 'Percentage') return percentageOffset(Number(node.value));
  if (node?.type !== 'TypeSelector') return undefined;
  return namedOffsets.get(ident.decode(node.name).toLowerCase());
}

function percentageOffset(value: number): number | undefined {
  return value >= 0 && value <= 100 ? value : undefined;
}

function isOpacityDeclaration(node: CssNode): node is Declaration {
  if (node.type !== 'Declaration' || node.important) return false;
  if (ident.decode(node.property).toLowerCase() !== 'opacity') return false;
  return isValidVisibilityValue('opacity', node.value, false);
}

function numericOpacity(value: CssNode | undefined): number | undefined {
  if (value?.type !== 'Number' && value?.type !== 'Percentage') return undefined;
  const number = Number(value.value);
  if (!Number.isFinite(number)) return undefined;
  const fraction = value.type === 'Percentage' ? number / 100 : number;
  return Math.max(0, Math.min(1, fraction));
}

function opacityBlock(block: CssNode): { offsets: number[]; opacity?: number } | undefined {
  if (block.type !== 'Rule' || block.prelude.type !== 'SelectorList') return undefined;
  const offsets = block.prelude.children.toArray().map(offsetOf);
  if (offsets.some((offset) => offset === undefined)) return undefined;
  const declaration = block.block.children.toArray().filter(isOpacityDeclaration).at(-1);
  if (!declaration) return undefined;
  return { offsets: offsets as number[], opacity: numericOpacity(singleAnimationValue(declaration.value)) };
}

function namedKeyframes(rule: CssNode) {
  if (rule.type !== 'Atrule' || ident.decode(rule.name).toLowerCase() !== 'keyframes' || !rule.block) return undefined;
  if (rule.prelude?.type !== 'AtrulePrelude' || rule.prelude.children.size !== 1) return undefined;
  const name = animationName(rule.prelude.children.first ?? undefined);
  if (name === undefined) return undefined;
  return { name, block: rule.block };
}

function revealFacts(frames: OpacityFrames): OpacityRevealFacts {
  const values = [...frames.values()];
  return {
    known: values.every((opacity) => opacity !== undefined),
    visible: values.some((opacity) => opacity !== undefined && opacity >= visibleOpacity),
    finalVisible: (frames.get(100) ?? 0) >= visibleOpacity,
  };
}

export function opacityKeyframes(rule: CssNode): { name: string; reveal: OpacityRevealFacts } | undefined {
  const definition = namedKeyframes(rule);
  if (!definition) return undefined;
  const frames: OpacityFrames = new Map();
  for (const block of definition.block.children) {
    const parsed = opacityBlock(block);
    if (!parsed) continue;
    for (const offset of parsed.offsets) frames.set(offset, parsed.opacity);
  }
  return { name: definition.name, reveal: revealFacts(frames) };
}
