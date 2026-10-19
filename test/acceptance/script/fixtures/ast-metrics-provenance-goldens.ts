import { legacyImportEvidence, completeImportEvidence, componentGolden, componentNodes, goodDefinition, repositoryComponents } from './ast-metrics-component-goldens.ts';
import { baseEdges, baseGraph, baseNodes, graphDefinitions, repositoryGraph } from './ast-metrics-architecture-goldens.ts';
import { bandedLegend } from './ast-metrics-architecture-coverage.ts';
import { noProductionFile, noTrend, trendHeading } from './ast-metrics-architecture-snapshots.ts';

export interface CoverageAssessment {
  readonly notice?: string;
  readonly commit?: string;
  readonly componentTouched?: boolean;
}

const emptyCoverageGraph = ['```mermaid', 'flowchart LR',
  ...Object.values(baseNodes).map((line) => line.replace(/"\]$/, '<br/>● good: 0 fn ≥ 30"]')),
  ...baseEdges, ...graphDefinitions, '  classDef good stroke:#0ca30c',
  '  class c_auth,c_hosted_admin,c_shared_kernel,c_src good', '```', '', bandedLegend];

export function offlineProvenanceMarkdown({ notice, commit }: CoverageAssessment): string {
  const summary = 'Modularity 0.52 → 0.52 · cross share 0.26 → 0.26 · cycles 0 → 0 · communities 4 → 4';
  const assessment = commit === undefined ? ['', notice ?? ''] : [];
  const footer = commit === undefined ? [] : ['', 'Base functions without an estimated covered share: 0.', '', `Coverage: unit suite at ${commit.slice(0, 8)}.`];
  const graph = commit === undefined ? baseGraph : emptyCoverageGraph;
  return ['## Architecture of src/: base a1b2c3d4 → head', '',
    `${summary}${commit === undefined ? '' : ' · functions ≥ 30: 0 → 0'}`, ...assessment, '',
    'Tool versions: base ast-metrics unknown; head ast-metrics unknown.', '',
    'The map did not change.', '', ...graph, ...legacyImportEvidence, '', ...componentGolden(commit === undefined ? Object.values(componentNodes) : Object.values(componentNodes).map((line) => line.replace(/"\]$/u, '<br/>● good: 0 fn ≥ 30"]')), commit === undefined ? [] : ['  class c_auth,c_hosted_admin,c_kernel,c_old,c_src,c_user_portal good'], { banded: commit !== undefined, bands: commit === undefined ? [] : [goodDefinition] }), '', ...noProductionFile, ...footer, '', ...noTrend, ''].join('\n');
}

export function repositoryProvenanceMarkdown(base: string, { notice, commit, componentTouched }: CoverageAssessment, offline = false): string {
  const summary = 'Modularity 0.42 → 0.42 · cross share 0.33 → 0.33 · cycles 1 → 1 · communities 3 → 3';
  const assessment = commit === undefined ? ['', notice ?? ''] : [];
  const footer = commit === undefined ? [] : ['', 'Base functions without an estimated covered share: 5.', '', `Coverage: unit suite at ${commit.slice(0, 8)}.`];
  const trend = offline ? noTrend : [trendHeading, '', 'No snapshot of main in the trend store yet.'];
  return [`## Architecture of src/: base ${base.slice(0, 8)} → head`, '',
    `${summary}${commit === undefined ? '' : ' · functions ≥ 30: 0 → 0'}`, ...assessment, '',
    ...(commit === undefined ? ['The map did not change.', ''] : []), ...repositoryGraph(commit !== undefined), ...completeImportEvidence, '', ...repositoryComponents({ covered: commit !== undefined, unchanged: commit === undefined && !componentTouched, touched: componentTouched }), '', ...noProductionFile,
    '', 'Unknown function identity: 5 (no proven declaration or unique unchanged body/signature correspondence).',
    ...footer, '', ...trend, ''].join('\n');
}
