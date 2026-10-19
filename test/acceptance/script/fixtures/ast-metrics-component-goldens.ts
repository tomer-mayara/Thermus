import { graphDefinitions } from './ast-metrics-architecture-goldens.ts';

export const legacyImportEvidence = ['', '### Community edge evidence', '',
  'Tool references and deduplicated file pairs have different units. An unchanged import means the same normalized file pair, after proven path moves; evidence kinds can differ.', '',
  'Import explanations unavailable: base and head snapshots have no dependency data.'];

export const completeImportEvidence = legacyImportEvidence.slice(0, 4).concat('', 'No new or gone community edges.');
export const legacyComponentNotice = 'Legacy snapshot data: component edges and cycles are unavailable because dependency data is absent.';
const componentLegend = 'Legend: thick border = a component this pull request touched; `· new` and `· gone` = a component or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base. Edges count distinct importing files per target component.';

export const componentNodes = {
  auth: '  c_auth["auth<br/>5 files · MI 61.3 · paths 122"]',
  hostedAdmin: '  c_hosted_admin["hosted-admin<br/>2 files · MI 66.6 · paths 75"]',
  kernel: '  c_kernel["kernel<br/>1 file · MI 77.0 · paths 18"]',
  old: '  c_old["old<br/>1 file · MI 55.0 · paths 20"]',
  src: '  c_src["src<br/>2 files · MI 56.0 · paths 40"]',
  portal: '  c_user_portal["user-portal<br/>1 file · paths 0"]',
};

export const bandedComponentNodes = {
  auth: '  c_auth["auth<br/>5 files · MI 61.3 · paths 122<br/>▲ warning: 2 fn ≥ 30; assessment incomplete: 2 unknown"]',
  hostedAdmin: '  c_hosted_admin["hosted-admin<br/>2 files · MI 66.6 · paths 75<br/>▲ warning: 2 fn ≥ 30"]',
  kernel: '  c_kernel["kernel<br/>1 file · MI 77.0 · paths 18<br/>● good: 0 fn ≥ 30"]',
  old: '  c_old["old<br/>1 file · MI 55.0 · paths 20<br/>● good: 0 fn ≥ 30"]',
  src: '  c_src["src<br/>2 files · MI 56.0 · paths 40<br/>▲ warning: 1 fn ≥ 30"]',
  portal: '  c_user_portal["user-portal<br/>1 file · paths 0<br/>● good: 0 fn ≥ 30"]',
};

interface ComponentGoldenOptions {
  readonly legacy?: boolean;
  readonly unchanged?: boolean;
  readonly banded?: boolean;
  readonly bands?: readonly string[];
}

export function componentGolden(nodes: readonly string[] = Object.values(componentNodes), classes: readonly string[] = [], options: ComponentGoldenOptions = {}): string[] {
  const legend = options.banded ? componentLegend.replace('numbers =', 'border color = the CRAP band of the component (● good: complete assessment, no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse); numbers =') : componentLegend;
  return ['## Components of src/', '', ...(options.legacy === false ? [] : [legacyComponentNotice, '']),
    ...(options.unchanged ? ['The component map did not change.', ''] : []),
    '```mermaid', 'flowchart LR', ...nodes, ...graphDefinitions, ...(options.bands ?? []), ...classes, '```', '', legend];
}

export const goodDefinition = '  classDef good stroke:#0ca30c';
export const warningDefinition = '  classDef warning stroke:#fab219';
export const criticalDefinition = '  classDef critical stroke:#d03b3b';
export const componentGoodClass = '  class c_kernel,c_old,c_user_portal good';
export const componentWarningClass = '  class c_auth,c_hosted_admin,c_src warning';

export function repositoryComponents(options: { readonly touched?: boolean; readonly covered?: boolean; readonly unchanged?: boolean; readonly authNode?: string } = {}): string[] {
  const good = options.covered ? '<br/>● good: 0 fn ≥ 30' : '';
  const nodes = [
    `  c_admin["admin<br/>1 file · MI 70.1 · paths 4${good}"]`,
    options.authNode ?? `  c_auth["auth<br/>2 files · MI 70.4 · paths 9${options.covered ? '<br/>assessment incomplete: 1 unknown; 0 known fn ≥ 30' : ''}"]`,
    `  c_kernel["kernel<br/>1 file · paths 0${good}"]`,
  ];
  return componentGolden(nodes, [...(options.touched ? ['  class c_auth touched'] : []), ...(options.covered ? ['  class c_admin,c_kernel good'] : [])],
    { legacy: false, unchanged: options.unchanged, banded: options.covered, bands: options.covered ? [goodDefinition] : [] });
}

export function bandedComponents(overrides: Partial<typeof bandedComponentNodes> = {}, touched: string[] = [], critical = false): string[] {
  return componentGolden(Object.values({ ...bandedComponentNodes, ...overrides }), [
    ...(touched.length ? [`  class ${touched.join(',')} touched`] : []),
    componentGoodClass,
    critical ? '  class c_hosted_admin,c_src warning' : componentWarningClass,
    ...(critical ? ['  class c_auth critical'] : []),
  ], { banded: true, bands: [goodDefinition, warningDefinition, ...(critical ? [criticalDefinition] : [])] });
}
