import type { TrendNumbers } from './trend-record.ts';

export function countCellOf(value: Pick<TrendNumbers, 'functionsOver30' | 'crap'> | undefined): string {
  const { functionsOver30, crap } = value ?? {};
  if (functionsOver30 === undefined) return '–';
  const basis = crap === undefined ? 'legacy unknown' : crap.kind === 'measured' ? 'measured' : 'estimate';
  return `${functionsOver30} (${basis})`;
}

export function prCellOf(title: string | undefined): string {
  const suffix = title?.match(/\(#([0-9]+)\)$/u);
  return suffix === undefined || suffix === null ? '–' : `#${suffix[1]}`;
}

export function markdownCellOf(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/[\r\n\t]/gu, ' ').replace(/[|\\`*_[\]]/gu, (character) => `&#${character.codePointAt(0)};`);
}
