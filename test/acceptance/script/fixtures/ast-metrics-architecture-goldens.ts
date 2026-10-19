import { bandedLegend } from './ast-metrics-architecture-coverage.ts';
import { legend } from './ast-metrics-architecture-snapshots.ts';

export const missingOriginMainGapNotice = 'Gap check unavailable: Cannot check gaps without origin/main. git: fatal: Needed a single revision';

// Complete unchanged graphs. These expectations do not call the report code.
export const baseEdges = [
  '  c_auth -- "10" --> c_hosted_admin',
  '  c_auth -- "2" --> c_shared_kernel',
  '  c_hosted_admin -- "4" --> c_shared_kernel',
  '  c_src -- "20" --> c_auth',
  '  c_src -- "5" --> c_hosted_admin',
];

export const graphDefinitions = [
  '  classDef touched stroke-width:3px',
  '  classDef gone stroke-dasharray:4 4,color:#999999',
];

export const baseNodes = {
  auth: '  c_auth["auth<br/>4 files · MI 58.6 · paths 110"]',
  hostedAdmin: '  c_hosted_admin["hosted-admin<br/>2 files · MI 66.6 · paths 75"]',
  kernel: '  c_shared_kernel["shared kernel<br/>1 file · MI 77.0 · paths 18"]',
  src: '  c_src["src<br/>2 files · MI 56.0 · paths 40"]',
};

export const baseGraph = [
  '```mermaid',
  'flowchart LR',
  ...Object.values(baseNodes),
  ...baseEdges,
  ...graphDefinitions,
  '```',
  '',
  legend,
];

export const bandedBaseGraph = [
  '```mermaid',
  'flowchart LR',
  '  c_auth["auth<br/>4 files · MI 58.6 · paths 110<br/>▲ warning: 2 fn ≥ 30; assessment incomplete: 2 unknown"]',
  '  c_hosted_admin["hosted-admin<br/>2 files · MI 66.6 · paths 75<br/>▲ warning: 2 fn ≥ 30"]',
  '  c_shared_kernel["shared kernel<br/>1 file · MI 77.0 · paths 18<br/>● good: 0 fn ≥ 30"]',
  '  c_src["src<br/>2 files · MI 56.0 · paths 40<br/>▲ warning: 1 fn ≥ 30"]',
  ...baseEdges,
  ...graphDefinitions,
  '  classDef good stroke:#0ca30c',
  '  classDef warning stroke:#fab219',
  '  class c_shared_kernel good',
  '  class c_auth,c_hosted_admin,c_src warning',
  '```',
  '',
  bandedLegend,
];

// The repository doubles give admin and auth a cycle, and a shared kernel.
export function repositoryGraph(banded = false): string[] {
  const good = banded ? '<br/>● good: 0 fn ≥ 30' : '';
  return [
    '```mermaid',
    'flowchart LR',
    `  c_admin["admin<br/>1 file · MI 70.1 · paths 4${good}"]`,
    `  c_auth["auth<br/>2 files · MI 70.4 · paths 9${banded ? '<br/>assessment incomplete: 1 unknown; 0 known fn ≥ 30' : ''}"]`,
    `  c_shared_kernel["shared kernel<br/>1 file · paths 0${good}"]`,
    '  c_admin -. "1 · cycle" .-> c_auth',
    '  c_admin -- "1" --> c_shared_kernel',
    '  c_auth -. "2 · cycle" .-> c_admin',
    '  c_auth -- "2" --> c_shared_kernel',
    '  linkStyle 0 stroke:#d03b3b,stroke-width:2px',
    '  linkStyle 2 stroke:#d03b3b,stroke-width:2px',
    ...graphDefinitions,
    ...(banded ? ['  classDef good stroke:#0ca30c', '  class c_admin,c_shared_kernel good'] : []),
    '```',
    '',
    banded ? bandedLegend : legend,
  ];
}
