import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

// The CRAP of each function and its change against the base: the formula and its rounding, the join with the coverage
// by file and name, the functions that get no CRAP, the uncovered file, the share of the base, and the rules for added
// and worse. The rules are pure, so the cases call them in the test process. Their module runs from source next to the
// command, as the command runs it. The types give the parts of the contract that the cases use.
interface SourceFile {
  readonly path: string;
  readonly functions: readonly { readonly name: string; readonly paths: number }[];
}

interface Sources {
  readonly base: { readonly files: readonly SourceFile[] };
  readonly head: { readonly files: readonly SourceFile[] };
  readonly coverage?: { readonly files: readonly { readonly path: string; readonly functions: readonly { readonly name: string; readonly coveredShare: number }[] }[] };
}

interface JudgedFunction {
  readonly name: string;
  readonly paths: number;
  readonly share: number;
  readonly crap: number;
  readonly base: number | 'new' | undefined;
  readonly addedOrWorse: boolean;
}

interface CrapDelta {
  readonly head: ReadonlyMap<string, { readonly functions: readonly JudgedFunction[]; readonly unmatched: number }>;
  readonly base: ReadonlyMap<string, { readonly functions: readonly Omit<JudgedFunction, 'base' | 'addedOrWorse'>[]; readonly unmatched: number }>;
}

const { crapDeltaOf } = await import(new URL('architecture/crap-delta.ts', pathToFileURL(astMetricsArchitectureScript)).href) as {
  crapDeltaOf(sources: Sources): CrapDelta | undefined;
};

type Shares = Readonly<Record<string, readonly (readonly [string, number])[]>>;

// One file for each entry, with the functions as name and decision paths, and a coverage report with the shares of the
// functions of each file that it has.
function sourcesOf(head: Readonly<Record<string, readonly (readonly [string, number])[]>>, shares: Shares, base = head): Sources {
  const filesOf = (files: typeof head) => Object.entries(files).map(([path, functions]) => ({ path, functions: functions.map(([name, paths]) => ({ name, paths })) }));
  const coverage = { files: Object.entries(shares).map(([path, functions]) => ({ path, functions: functions.map(([name, coveredShare]) => ({ name, coveredShare })) })) };
  return { base: { files: filesOf(base) }, head: { files: filesOf(head) }, coverage };
}

function headOf(sources: Sources, path: string) {
  const delta = crapDeltaOf(sources);
  assert.ok(delta !== undefined);
  const file = delta.head.get(path);
  assert.ok(file !== undefined, `The head has no file ${path}.`);
  return file;
}

function crapOf(sources: Sources, path: string): Record<string, number> {
  return Object.fromEntries(headOf(sources, path).functions.map((entry) => [entry.name, entry.crap]));
}

test('Given no coverage report, when the delta is made, then there is none', () => {
  assert.equal(crapDeltaOf({ base: { files: [] }, head: { files: [] } }), undefined);
});

test('Given functions of 10 decision paths with the covered shares 0 and 1, when the CRAP is computed, then it is 10² × 1³ + 10 = 110 and 10² × 0³ + 10 = 10', () => {
  const sources = sourcesOf({ 'src/a.ts': [['bare', 10], ['tested', 10]] }, { 'src/a.ts': [['bare', 0], ['tested', 1]] });

  assert.deepEqual(crapOf(sources, 'src/a.ts'), { bare: 110, tested: 10 });
});

test('Given CRAP values with more decimals, when the CRAP is computed, then it keeps one decimal, and a half rounds up', () => {
  const sources = sourcesOf({ 'src/a.ts': [['quarter', 12], ['half', 7], ['tenth', 9]] }, { 'src/a.ts': [['quarter', 0.25], ['half', 0.5], ['tenth', 0.1]] });

  // 144 × 0.421875 + 12 = 72.75; 49 × 0.125 + 7 = 13.125; 81 × 0.729 + 9 = 68.049.
  assert.deepEqual(crapOf(sources, 'src/a.ts'), { quarter: 72.8, half: 13.1, tenth: 68 });
});

test('Given an anonymous function, a method without a name, a name that the file has twice, a name that the report has twice, and a name that the report does not have, when the CRAP is computed, then none of them gets a CRAP and the file counts them as unmatched', () => {
  const functions = [['(anonymous)', 4], ['a\\Store.', 4], ['twice', 2], ['twice', 3], ['echo', 5], ['missing', 6], ['kept', 2]] as const;
  const sources = sourcesOf({ 'src/a.ts': functions }, { 'src/a.ts': [['(anonymous)', 1], ['twice', 1], ['echo', 0.5], ['echo', 0.2], ['kept', 1]] });

  const file = headOf(sources, 'src/a.ts');

  assert.deepEqual(file.functions.map((entry) => entry.name), ['kept']);
  assert.equal(file.unmatched, 6);
});

// ast-metrics names a method module\Class.method; V8 names it method, and a constructor by its class.
test('Given methods and a constructor in the names of ast-metrics, when the CRAP is computed, then each matches the function of the report with the name that V8 gives it', () => {
  const sources = sourcesOf({ 'src/store.ts': [['store\\Store.constructor', 2], ['store\\Store.save', 4]] }, { 'src/store.ts': [['Store', 1], ['save', 0.5]] });

  assert.deepEqual(crapOf(sources, 'src/store.ts'), { 'store\\Store.constructor': 2, 'store\\Store.save': 6 });
});

test('Given a method and a function with the same name as V8 gives it, when the CRAP is computed, then the key is the same twice, and neither gets a CRAP', () => {
  const sources = sourcesOf({ 'src/store.ts': [['store\\Store.close', 2], ['close', 3]] }, { 'src/store.ts': [['close', 1]] });

  assert.deepEqual(headOf(sources, 'src/store.ts'), { functions: [], unmatched: 2 });
});

test('Given a file that the report does not have, when the CRAP is computed, then each of its named functions counts as uncovered with CRAP = paths² + paths, and an anonymous function still gets none', () => {
  const sources = sourcesOf({ 'src/loose.ts': [['start', 5], ['(anonymous)', 2], ['stop', 3]] }, {});

  const file = headOf(sources, 'src/loose.ts');

  assert.deepEqual(file.functions.map(({ name, share, crap }) => ({ name, share, crap })), [{ name: 'start', share: 0, crap: 30 }, { name: 'stop', share: 0, crap: 12 }]);
  assert.equal(file.unmatched, 1);
});

test('Given a function whose decision paths changed, when the delta is made, then the base CRAP uses the base decision paths with the covered share of the head', () => {
  const sources = sourcesOf({ 'src/a.ts': [['grow', 14]] }, { 'src/a.ts': [['grow', 0.5]] }, { 'src/a.ts': [['grow', 7]] });

  const delta = crapDeltaOf(sources);

  assert.deepEqual(delta?.base.get('src/a.ts')?.functions, [{ name: 'grow', paths: 7, share: 0.5, crap: 13.1 }]);
  assert.deepEqual(delta?.head.get('src/a.ts')?.functions.map(({ crap, base }) => ({ crap, base })), [{ crap: 38.5, base: 13.1 }]);
});

test('Given a function that the pull request removed, a removed file, and a function that the head has without a CRAP, when the delta is made, then the first two count as uncovered in the base, and the third gets no CRAP in the base either', () => {
  const head = { 'src/a.ts': [['kept', 2], ['twice', 3], ['twice', 4]] } as const;
  const base = { 'src/a.ts': [['kept', 2], ['removed', 6], ['twice', 3]], 'src/gone.ts': [['old', 5]] } as const;

  const delta = crapDeltaOf(sourcesOf(head, { 'src/a.ts': [['kept', 1], ['twice', 1]] }, base));

  assert.deepEqual(delta?.base.get('src/a.ts'), { functions: [{ name: 'kept', paths: 2, share: 1, crap: 2 }, { name: 'removed', paths: 6, share: 0, crap: 42 }], unmatched: 1 });
  assert.deepEqual(delta?.base.get('src/gone.ts'), { functions: [{ name: 'old', paths: 5, share: 0, crap: 30 }], unmatched: 0 });
});

test('Given the same tree on both sides, when the delta is made, then each function of the base has the CRAP of the head and none is added or worse', () => {
  const tree = { 'src/a.ts': [['big', 9], ['small', 2], ['(anonymous)', 4]], 'src/b.ts': [['loose', 6]] } as const;

  const delta = crapDeltaOf(sourcesOf(tree, { 'src/a.ts': [['big', 0.1], ['small', 0.5]] }));

  assert.deepEqual(delta?.head.get('src/a.ts')?.functions.map(({ name, crap, base, addedOrWorse }) => ({ name, crap, base, addedOrWorse })), [
    { name: 'big', crap: 68, base: 68, addedOrWorse: false },
    { name: 'small', crap: 2.5, base: 2.5, addedOrWorse: false },
  ]);
  assert.deepEqual(delta?.head.get('src/b.ts')?.functions.map(({ crap, base, addedOrWorse }) => ({ crap, base, addedOrWorse })), [{ crap: 42, base: 42, addedOrWorse: false }]);
});

for (const [name, basePaths, headPaths, share, expected] of [
  ['a function at 30 or more that the base file does not have', undefined, 8, 0, { base: 'new', addedOrWorse: true }],
  ['a function below 30 that the base file does not have', undefined, 3, 0, { base: 'new', addedOrWorse: false }],
  ['a function that went from below 30 to 30 or more', 7, 14, 0.5, { base: 13.1, addedOrWorse: true }],
  ['a function above 30 on both sides with a higher CRAP in the head', 8, 9, 0, { base: 72, addedOrWorse: true }],
  ['a function above 30 on both sides with the same CRAP', 8, 8, 0, { base: 72, addedOrWorse: false }],
  ['a function above 30 on both sides with a lower CRAP in the head', 9, 8, 0, { base: 90, addedOrWorse: false }],
  ['a function that went from 30 or more to below 30', 14, 7, 0.5, { base: 38.5, addedOrWorse: false }],
] as const) {
  test(`Given ${name}, when the delta is made, then its base and whether it is added or worse follow the rules of the bands`, () => {
    const baseFunction: readonly [string, number] = basePaths === undefined ? ['other', 1] : ['f', basePaths];
    const base = { 'src/a.ts': [baseFunction] };

    const file = headOf(sourcesOf({ 'src/a.ts': [['f', headPaths]] }, { 'src/a.ts': [['f', share]] }, base), 'src/a.ts');

    assert.deepEqual(file.functions.map((entry) => ({ base: entry.base, addedOrWorse: entry.addedOrWorse })), [expected]);
  });
}

test('Given a function at 30 or more in a file that the base does not have, when the delta is made, then it is new and added', () => {
  const file = headOf(sourcesOf({ 'src/new.ts': [['fresh', 10]] }, {}, {}), 'src/new.ts');

  assert.deepEqual(file.functions.map(({ crap, base, addedOrWorse }) => ({ crap, base, addedOrWorse })), [{ crap: 110, base: 'new', addedOrWorse: true }]);
});

test('Given a function at 30 or more whose name the base file has twice, when the delta is made, then its base is not known, and it is neither added nor worse', () => {
  const file = headOf(sourcesOf({ 'src/a.ts': [['f', 10]] }, { 'src/a.ts': [['f', 0]] }, { 'src/a.ts': [['f', 1], ['f', 2]] }), 'src/a.ts');

  assert.deepEqual(file.functions.map(({ crap, base, addedOrWorse }) => ({ crap, base, addedOrWorse })), [{ crap: 110, base: undefined, addedOrWorse: false }]);
});
