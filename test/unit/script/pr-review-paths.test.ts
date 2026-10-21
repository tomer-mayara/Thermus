import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(prReviewCheckScript);
const { pathOutcome } = await import(new URL('paths.ts', root).href) as typeof import('../../../script/pr-review/paths.ts');
const { surfaceReasons } = await import(new URL('surface.ts', root).href) as typeof import('../../../script/pr-review/surface.ts');

const groups = [
  { name: 'policy', question: 'Who decides?', paths: ['AGENTS.md', '.habit-hooks/**'] },
  { name: 'security', question: 'Who is trusted?', paths: ['src/auth/**', 'src/http/server.ts'] },
  { name: 'contracts', question: 'What does a client see?', paths: ['src/index.ts'] },
];
const rules = {
  protectedPaths: groups, policyQuestion: 'Who decides?', readPaths: ['.agent/**'],
  scopes: { production: ['src/**'], executable: ['src/**', '.habit-hooks/**'], generated: [] },
};
const rulesPath = 'docs/rules.yaml';
const changesOf = (...paths: string[]) => paths.map((path) => ({ status: 'M', path }));

test('Given changed paths in protected groups, read paths, and executable scopes, when the path reasons are made, then each protected or read path is a reason, each group asks its question once, and one SHOW reason counts the executable files', () => {
  const result = pathOutcome(changesOf('.habit-hooks/snooze.json', 'src/auth/a.ts', 'src/auth/b.ts', 'docs/x.md', '.agent/settings.json'), rules, rulesPath);

  assert.deepEqual(result.reasons, [
    { route: 'ASK', key: 'protected_paths.policy', fact: '.habit-hooks/snooze.json' },
    { route: 'ASK', key: 'protected_paths.security', fact: 'src/auth/a.ts' },
    { route: 'ASK', key: 'protected_paths.security', fact: 'src/auth/b.ts' },
    { route: 'READ', key: 'read_paths', fact: '.agent/settings.json' },
    { route: 'SHOW', key: 'scopes.executable', fact: '3 changed files' },
  ]);
  assert.deepEqual(result.questions, [{ key: 'protected_paths.policy', question: 'Who decides?' }, { key: 'protected_paths.security', question: 'Who is trusted?' }]);
});

test('Given a rename into an executable scope, when the path reasons are made, then the old path is protected and the rename is one changed file', () => {
  const result = pathOutcome([{ status: 'R', oldPath: 'AGENTS.md', path: 'src/agents.ts' }], rules, rulesPath);

  assert.deepEqual(result.reasons, [
    { route: 'ASK', key: 'protected_paths.policy', fact: 'AGENTS.md' },
    { route: 'SHOW', key: 'scopes.executable', fact: '1 changed file' },
  ]);
});

test('Given a change to the rules file that no group lists, when the path reasons are made, then it is ASK in the policy group with its question', () => {
  assert.deepEqual(pathOutcome(changesOf(rulesPath), rules, rulesPath), {
    reasons: [{ route: 'ASK', key: 'protected_paths.policy', fact: rulesPath }],
    questions: [{ key: 'protected_paths.policy', question: 'Who decides?' }],
  });
  assert.deepEqual(pathOutcome(changesOf(rulesPath), { ...rules, protectedPaths: [{ ...groups[0], paths: [rulesPath] }] }, rulesPath).reasons, [
    { route: 'ASK', key: 'protected_paths.policy', fact: rulesPath },
  ]);
});

test('Given a document change only, when the path reasons are made, then there is no reason and no question', () => {
  assert.deepEqual(pathOutcome(changesOf('docs/x.md'), rules, rulesPath), { reasons: [], questions: [] });
});

test('Given a changed surface module, a surface module that imports a changed file of its package, and a changed contract document, when the surface reasons are made, then each is ASK', () => {
  const imports = new Map([
    ['src/auth/access-context.ts', [{ target: 'src/auth/roles.ts', kind: 'type' as const }, { target: 'src/auth/roles.ts', kind: 'runtime' as const }]],
    ['src/index.ts', [{ target: 'src/auth/roles.ts', kind: 'runtime' as const }]],
  ]);
  const surface = { modules: ['src/index.ts', 'src/auth/access-context.ts', 'src/index.ts', 'src/http/b.ts'], contractDocuments: ['docs/reference/**'] };

  assert.deepEqual(surfaceReasons(surface, imports, ['src/auth/roles.ts', 'src/http/b.ts', 'docs/reference/fetch.md', 'docs/guide.md']), [
    { route: 'ASK', key: 'public_surface', fact: 'src/auth/access-context.ts (imports changed src/auth/roles.ts)' },
    { route: 'ASK', key: 'public_surface', fact: 'src/http/b.ts' },
    { route: 'ASK', key: 'public_surface', fact: 'docs/reference/fetch.md' },
  ]);
});
