import { generate, ident, type CssNode } from 'css-tree';
import type { Declarations } from './css-visibility-rules.ts';
import { opacityKeyframes, type OpacityRevealFacts } from './css-opacity-keyframes.ts';
import { animationName, singleAnimationValue } from './css-animation-declarations.ts';

type Playback = { name: string; duration: number; fill: string };

function keyword(declarations: Declarations, property: string, fallback: string): string {
  const value = declarations.get(property)?.declaration.value;
  return value ? ident.decode(generate(value)).toLowerCase() : fallback;
}

function timeOf(node: CssNode | undefined): number | undefined {
  if (node?.type !== 'Dimension') return undefined;
  const unit = ident.decode(node.unit).toLowerCase();
  if (unit !== 's' && unit !== 'ms') return undefined;
  const value = Number(node.value) * (unit === 's' ? 1000 : 1);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function animationTime(declarations: Declarations, property: string): number | undefined {
  const value = declarations.get(property)?.declaration.value;
  return value ? timeOf(singleAnimationValue(value)) : 0;
}

function supportedPlayback(declarations: Declarations): boolean {
  if (keyword(declarations, 'animation-play-state', 'running') !== 'running') return false;
  if (keyword(declarations, 'animation-direction', 'normal') !== 'normal') return false;
  const iterations = Number(keyword(declarations, 'animation-iteration-count', '1'));
  return Number.isSafeInteger(iterations) && iterations > 0;
}

function opacityPlayback(declarations: Declarations): Playback | undefined {
  if (declarations.get('opacity')?.declaration.important || !supportedPlayback(declarations)) return undefined;
  const value = declarations.get('animation-name')?.declaration.value;
  const name = value ? animationName(singleAnimationValue(value)) : undefined;
  if (name === undefined) return undefined;
  const duration = animationTime(declarations, 'animation-duration');
  const delay = animationTime(declarations, 'animation-delay');
  if (duration === undefined || delay === undefined) return undefined;
  return { name, duration, fill: keyword(declarations, 'animation-fill-mode', 'none') };
}

function revealsOpacity(facts: OpacityRevealFacts, playback: Playback): boolean {
  if (!facts.known) return false;
  if (playback.duration > 0) return facts.visible;
  if (playback.fill !== 'forwards' && playback.fill !== 'both') return false;
  return facts.finalVisible;
}

export class OpacityAnimations {
  private readonly definitions = new Map<string, OpacityRevealFacts>();

  public add(rule: CssNode): void {
    const parsed = opacityKeyframes(rule);
    if (parsed) this.definitions.set(parsed.name, parsed.reveal);
  }

  public mayReveal(declarations: Declarations): boolean {
    const playback = opacityPlayback(declarations);
    if (!playback) return false;
    const facts = this.definitions.get(playback.name);
    return facts !== undefined && revealsOpacity(facts, playback);
  }
}
