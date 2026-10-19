import type { AstMetricsMcpAnswers } from '../../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { bandedLegend, bandedTableHead, functionsSection } from './ast-metrics-architecture-coverage.ts';
import { bandsNeedTheCoverage, complexityHeading, legend, tableHead } from './ast-metrics-architecture-snapshots.ts';
import { fileMetricsAnswers, serverAnswers } from './ast-metrics-snapshot-answers.ts';
import type { GitRepository } from './git-repository.ts';

const plainGraph = [
    '```mermaid',
    'flowchart LR',
    '  c_admin["admin<br/>1 file · MI 70.1 · paths 4"]',
    'AUTH_NODE',
    '  c_shared_kernel["shared kernel<br/>1 file · paths 0"]',
    '  c_admin -. "1 · cycle" .-> c_auth',
    '  c_admin -- "1" --> c_shared_kernel',
    '  c_auth -. "2 · cycle" .-> c_admin',
    '  c_auth -- "2" --> c_shared_kernel',
    '  linkStyle 0 stroke:#d03b3b,stroke-width:2px',
    '  linkStyle 2 stroke:#d03b3b,stroke-width:2px',
    '  classDef touched stroke-width:3px',
    '  classDef gone stroke-dasharray:4 4,color:#999999',
    '  class c_auth touched',
    '```',
    '',
    legend,
];

export function repositoryMarkdownOf({ baseCommit, unknownIdentity }: { readonly baseCommit: string; readonly unknownIdentity: number }, authNode: string, rows: readonly string[]): string {
  return [
    `## Architecture of src/: base ${baseCommit.slice(0, 8)} → head`,
    '',
    'Modularity 0.42 → 0.42 · cross share 0.33 → 0.33 · cycles 1 → 1 · communities 3 → 3',
    '',
    bandsNeedTheCoverage,
    '',
    ...plainGraph.map((line) => line === 'AUTH_NODE' ? authNode : line),
    '',
    complexityHeading,
    '',
    ...tableHead,
    ...rows,
    '',
    `Unknown function identity: ${unknownIdentity} (no proven declaration or unique unchanged body/signature correspondence).`,
    '',
  ].join('\n');
}

export const riskyServerAnswers: AstMetricsMcpAnswers = {
  ...serverAnswers,
  get_file_metrics: {
    ...fileMetricsAnswers,
    'src/auth/session.ts': {
      path: 'src/auth/session.ts', language: 'TypeScript', cyclomatic_complexity: 6, risk_score: 0.5,
      functions: [
        { name: 'openSession', cyclomatic_complexity: 6, maintainability: { comment_weight: 0, maintainability_index: 60.5 }, volume: { loc: 20, lloc: 16 } },
        { name: '', cyclomatic_complexity: 1, maintainability: { comment_weight: 0, maintainability_index: 88.88 }, volume: { loc: 3, lloc: 1 } },
        { name: 'closeSession', cyclomatic_complexity: 1, volume: { loc: 2, lloc: 0 } },
      ],
    },
  },
};

export const coverageReport = {
  version: 1, suite: 'unit', commit: 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00', processes: 2, scripts: 3,
  files: [
    { path: 'src/auth/session.ts', functions: [{ name: '(anonymous)', start: 0, end: 300, called: 1, coveredShare: 1 }, { name: 'openSession', start: 20, end: 120, called: 0, coveredShare: 0 }, { name: 'closeSession', start: 130, end: 160, called: 2, coveredShare: 1 }] },
    { path: 'src/auth/tokens.ts', functions: [{ name: '(anonymous)', start: 0, end: 200, called: 1, coveredShare: 1 }, { name: 'issueToken', start: 10, end: 90, called: 3, coveredShare: 0.5 }] },
    { path: 'src/kernel/ids.ts', functions: [{ name: '(anonymous)', start: 0, end: 40, called: 1, coveredShare: 1 }] },
  ],
};

const coveredGraph = [
    '```mermaid',
    'flowchart LR',
    '  c_admin["admin<br/>1 file · MI 70.1 · paths 4<br/>● good: 0 fn ≥ 30"]',
    '  c_auth["auth<br/>2 files · MI 70.4 · paths 9<br/>▲ warning: 1 fn ≥ 30 (+1); assessment incomplete: 1 unknown"]',
    '  c_shared_kernel["shared kernel<br/>1 file · paths 0<br/>● good: 0 fn ≥ 30"]',
    '  c_admin -. "1 · cycle" .-> c_auth',
    '  c_admin -- "1" --> c_shared_kernel',
    '  c_auth -. "2 · cycle" .-> c_admin',
    '  c_auth -- "2" --> c_shared_kernel',
    '  linkStyle 0 stroke:#d03b3b,stroke-width:2px',
    '  linkStyle 2 stroke:#d03b3b,stroke-width:2px',
    '  classDef touched stroke-width:3px',
    '  classDef gone stroke-dasharray:4 4,color:#999999',
    '  classDef good stroke:#0ca30c',
    '  classDef warning stroke:#fab219',
    '  class c_auth touched',
    '  class c_admin,c_shared_kernel good',
    '  class c_auth warning',
    '```',
    '',
    bandedLegend,
];

export function coveredRepositoryMarkdown(repository: GitRepository): string {
  return [
    `## Architecture of src/: base ${repository.git('rev-parse', 'HEAD').slice(0, 8)} → head`,
    '',
    'Modularity 0.42 → 0.42 · cross share 0.33 → 0.33 · cycles 1 → 1 · communities 3 → 3 · functions ≥ 30: 0 → 1',
    '',
    ...coveredGraph,
    '',
    complexityHeading,
    '',
    ...bandedTableHead,
    '| src/auth/session.ts | 61.2 → 61.2 | 6 → 6 | not measured → 1 | 1 |',
    '',
    ...functionsSection([], 1),
    '',
    'Unknown function identity: 5 (no proven declaration or unique unchanged body/signature correspondence).',
    '',
    'Base functions without an estimated covered share: 5.',
    '',
    `Coverage: unit suite at ${repository.git('rev-parse', 'HEAD').trim().slice(0, 8)}.`,
    '',
    '## Trend of src/ on main',
    '',
    'No snapshot of main in the trend store yet.',
    '',
  ].join('\n');
}
