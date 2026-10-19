import type { TrendRecord } from '../../../../script/code-quality/architecture/trend-record.ts';
import type { TrendCrapBasis } from '../../../../script/code-quality/architecture/trend-basis.ts';

const basis: TrendCrapBasis = {
  kind: 'measured', coverageCommit: 'f'.repeat(40), sourceFingerprint: 'a'.repeat(64),
  inputsFingerprint: 'b'.repeat(64), buildFingerprint: 'c'.repeat(64),
  measurementVersion: 'own-characters-1', unknownFunctions: 0,
};
const common = { version: 1, modularity: 0.5, crossShare: 0.2, cycles: 0, paths: 4, files: 2, functions: 0, communities: [] } as const;
const component = { files: 1, loc: 10, paths: 2 };

export const trendViewRecords: readonly TrendRecord[] = [
  { ...common, commit: 'a'.repeat(40), date: '2026-10-10T12:00:00Z', title: 'Old (#11) detail', maintainability: 60, functionsOver30: 7 },
  { ...common, commit: 'b'.repeat(40), date: '2026-10-12T12:00:00Z', title: 'Improve | <trend> (#12)', maintainability: 61, functionsOver30: 3,
    crap: { ...basis, kind: 'head-derived-estimate' }, components: [
      { ...component, name: 'zulu' },
      { ...component, name: 'auth', maintainability: 61, functionsOver30: 3, crap: { ...basis, kind: 'head-derived-estimate' } },
    ] },
  { ...common, commit: 'c'.repeat(40), date: '2026-10-18T12:00:00Z', functionsOver30: 6, crap: basis, components: [
    { ...component, name: 'pay|<ments>', maintainability: 45, functionsOver30: 6, crap: basis },
    { ...component, name: 'auth', maintainability: 63, functionsOver30: 0, crap: basis },
  ] },
];

export const trendViewSnapshot = {
  version: 1, commit: 'd'.repeat(40), date: '2026-10-19T12:00:00Z', title: 'Current (#99)',
  global: { modularity: 0.6, crossShare: 0.2, cycles: [], maintainability: 66, paths: 4, files: 2, functions: 0 },
  communities: [], files: [
    { path: 'src/auth/a.ts', community: null, loc: 10, paths: 2, maintainability: 65, functions: [] },
    { path: 'src/zulu/z.ts', community: null, loc: 10, paths: 2, maintainability: 67, functions: [] },
  ],
} as const;

export const trendViewMarkdown = [
  '## Trend of src/ on main', '',
  '| Commit | PR | Date | Modularity | Cross share | Cycles | Maintainability | Functions ≥ 30 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  '| aaaaaaaa | – | 2026-10-10 | 0.50 | 0.20 | 0 | 60.0 | 7 (legacy unknown) |',
  '| bbbbbbbb | #12 | 2026-10-12 | 0.50 | 0.20 | 0 | 61.0 | 3 (estimate) |',
  '| cccccccc | – | 2026-10-18 | 0.50 | 0.20 | 0 | – | 6 (measured) |',
  '| this pull request | #99 | | 0.60 | 0.20 | 0 | 66.0 | – |', '',
  'Historical estimates use head coverage from the first recording pull request. Later estimates for the same base can differ. Counts include known lower-bound violations; other unknown functions are not counted.', '',
  '### Maintainability trend', '',
  'Missing values are gaps; lines stop at each gap.', '',
  'Maintainability (maintainability), aaaaaaaa to bbbbbbbb.', '',
  '```mermaid', '---', 'config:', '  xyChart:', '    xAxis:', '      labelRotation: 45', '---', 'xychart-beta', '    title "Maintainability"',
  '    x-axis ["aaaaaaaa", "bbbbbbbb"]', '    y-axis "Maintainability" 60 --> 61',
  '    line [60, 61]', '```', '',
  'this pull request: 66 (maintainability). One point; no line.', '', '',
  '### Functions ≥ 30 trend', '',
  'Missing values are gaps; lines stop at each gap or change of count basis.', '',
  'aaaaaaaa: 7 (legacy unknown). One point; no line.', '',
  'bbbbbbbb: 3 (head-derived estimate). One point; no line.', '',
  'cccccccc: 6 (measured). One point; no line.', '', '',
  '### Trend by component', '',
  '| Component | aaaaaaaa | bbbbbbbb | cccccccc | this pull request |',
  '| --- | --- | --- | --- | --- |',
  '| auth | MI –; functions ≥ 30: – | MI 61.0; functions ≥ 30: 3 (estimate) | MI 63.0; functions ≥ 30: 0 (measured) | MI 65.0; functions ≥ 30: – |',
  '| pay&#124;&lt;ments&gt; | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI 45.0; functions ≥ 30: 6 (measured) | MI –; functions ≥ 30: – |',
  '| zulu | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI –; functions ≥ 30: – | MI 67.0; functions ≥ 30: – |', '',
].join('\n');
