import type { Band, NodeBand } from './types.ts';

const bandSymbols: Readonly<Record<Band, string>> = { good: '●', warning: '▲', critical: '■' };

// The band never comes as a color alone: its line has the symbol and the word, such as ■ critical: 6 fn ≥ 30 (+2). The
// minus sign is U+2212.
export function bandTextOf(assessment: NodeBand): string {
  const { band, count, change = 0 } = assessment;
  const incomplete = incompleteTextOf(assessment);
  if (band === undefined) return `${incomplete}; ${count} known fn ≥ 30`;
  const parts = [`${bandSymbols[band]} ${band}: ${count} fn ≥ 30${bandChangeOf(change)}`];
  if (incomplete !== undefined) parts.push(incomplete);
  return parts.join('; ');
}

function incompleteTextOf({ unknown = 0, unmeasuredFiles = 0 }: NodeBand): string | undefined {
  const missing: string[] = [];
  if (unknown > 0) missing.push(`${unknown} unknown`);
  if (unmeasuredFiles > 0) missing.push(`${unmeasuredFiles} unmeasured ${unmeasuredFiles === 1 ? 'file' : 'files'}`);
  return missing.length === 0 ? undefined : `assessment incomplete: ${missing.join('; ')}`;
}

function bandChangeOf(change: number): string {
  if (change === 0) return '';
  const sign = change > 0 ? '+' : '−';
  return ` (${sign}${Math.abs(change)})`;
}
