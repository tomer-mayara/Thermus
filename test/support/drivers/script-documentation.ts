import { globSync, readFileSync } from 'node:fs';
import { repositoryRoot } from '../processes/module-paths.ts';

export interface DocumentedTest {
  readonly path: string;
  readonly kind: 'ordinary' | 'live';
  readonly collector: boolean;
}

const read = (path: string): string => readFileSync(new URL(path, repositoryRoot), 'utf8');
const normalized = (text: string): string => text.replace(/pnpm\s+exec\s+node/g, 'node').replace(/\s+/g, ' ').trim();

export function readCodeQualityDocuments() {
  const knip = JSON.parse(read('knip.json')) as { workspaces: { '.': { entry: string[] } } };
  const commands = knip.workspaces['.'].entry.filter((entry) => /^script\/code-quality\/ast-metrics-[^/]+\.ts$/.test(entry)).sort();
  const paths = globSync('test/**/script/ast-metrics-*.{test,live}.ts', { cwd: repositoryRoot });
  paths.push('test/acceptance/script/script-readme.test.ts');
  const tests: DocumentedTest[] = paths.sort().map((path) => ({
    path,
    kind: path.endsWith('.live.ts') ? 'live' : 'ordinary',
    collector: path.endsWith('.live.ts') && read(path).includes('astMetricsCoverageScript'),
  }));
  return { commands, tests, readme: read('script/code-quality/README.md'), inventory: read('docs/testing/test-list.md') };
}

interface HelpContract {
  readonly synopses: readonly string[];
  readonly options: ReadonlyMap<string, string>;
  readonly issues: readonly string[];
}

function contractOf(text: string, command: string): HelpContract {
  const issues = ['Usage', 'Options'].filter((block) => !new RegExp(`^${block}:`, 'm').test(text));
  const synopses = text.split('\n').map((line) => normalized(line.replace(/^Usage:/, '')))
    .filter((line) => line === `node ${command}` || line.startsWith(`node ${command} `));
  const options = new Map<string, string>();
  const block = /(?:^|\n)Options:\n([\s\S]*?)(?:\n\s*\n|$)/.exec(text)?.[1] ?? '';
  let option: string | undefined;
  for (const line of block.split('\n')) {
    const row = /^\s+(--\S.*?)(?:\s{2,})(\S.*)$/.exec(line);
    if (row) {
      option = normalized(row[1]);
      options.set(option, normalized(row[2]));
    } else if (option && line.trim()) {
      options.set(option, normalized(`${options.get(option)} ${line}`));
    }
  }
  return { synopses, options, issues };
}

export function documentationDiscrepancies(input: { readonly command: string; readonly help: string; readonly readme: string }): string[] {
  const { command, help, readme } = input;
  const blocks = [...readme.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]);
  const documented = blocks.filter((block) => block.includes(command) && /^Usage:/m.test(block)).join('\n\n');
  const expected = contractOf(help, command);
  const actual = contractOf(documented, command);
  const issues = expected.issues.map((block) => `help has no ${block}: block`);
  issues.push(...actual.issues.map((block) => `README has no ${block}: block`));
  for (const synopsis of expected.synopses) if (!actual.synopses.includes(synopsis)) issues.push(`missing synopsis: ${synopsis}`);
  for (const synopsis of actual.synopses) if (!expected.synopses.includes(synopsis)) issues.push(`extra synopsis: ${synopsis}`);
  issues.push(...optionDiscrepancies(expected.options, actual.options));
  issues.push(...declaredDefaultDiscrepancies(help, documented));
  return issues.map((issue) => `${command}: ${issue}`);
}

function declaredDefaultDiscrepancies(help: string, documented: string): string[] {
  const documentedDefaults = new Set([...documented.matchAll(/\(default\b[^)]*\)/g)].map(([text]) => normalized(text)));
  const issues: string[] = [];
  for (const [declaration] of help.matchAll(/\(default\b[^)]*\)/g)) {
    if (!documentedDefaults.has(normalized(declaration))) issues.push(`missing declared default: ${normalized(declaration)}`);
  }
  return issues;
}

function optionDiscrepancies(expected: ReadonlyMap<string, string>, actual: ReadonlyMap<string, string>): string[] {
  const issues: string[] = [];
  for (const [option, description] of expected) {
    if (!actual.has(option)) issues.push(`missing option: ${option}`);
    else if (actual.get(option) !== description) issues.push(`option differs: ${option}`);
  }
  for (const option of actual.keys()) if (!expected.has(option)) issues.push(`extra option: ${option}`);
  return issues;
}

function testDiscrepancies(test: DocumentedTest, row: DocumentedTest | undefined): string[] {
  if (!row) return [`missing test: ${test.path}`];
  const issues: string[] = [];
  if (row.kind !== test.kind) issues.push(`test kind differs: ${test.path}`);
  if (row.collector !== test.collector) issues.push(`coverage collector differs: ${test.path}`);
  return issues;
}

export function inventoryDiscrepancies(document: string, available: readonly DocumentedTest[]): string[] {
  const block = /<!-- code-quality-tests:start -->([\s\S]*?)<!-- code-quality-tests:end -->/.exec(document)?.[1];
  if (block === undefined) return ['missing code-quality test inventory'];
  const rows: DocumentedTest[] = [...block.matchAll(/^\| (ordinary|live) \| (\S+) \| (yes|no) \|$/gm)]
    .map(([, kind, path, collector]) => ({ kind: kind as DocumentedTest['kind'], path, collector: collector === 'yes' }));
  const issues: string[] = [];
  const listed = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (listed.has(row.path)) issues.push(`duplicate test: ${row.path}`);
    listed.set(row.path, row);
  }
  issues.push(...available.flatMap((test) => testDiscrepancies(test, listed.get(test.path))));
  const paths = new Set(available.map((test) => test.path));
  for (const row of rows) if (!paths.has(row.path)) issues.push(`extra test: ${row.path}`);
  return issues;
}
