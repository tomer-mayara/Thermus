import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { metricsFilesOf } = await import(new URL('metrics-files.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/metrics-files.ts');

const head = 'b'.repeat(40);
const names = ['Delta', 'Review', 'CRAP', 'Architecture'];
const finding = { kind: 'regression', severity: 'high', rule: 'new-violation:maintainability', file: 'src/a.ts', line: 8, message: 'Maintainability too low: got 63 (min: 85)' };

function processFile(statuses: readonly string[] = ['passed', 'goal miss', 'passed', 'passed']) {
  return { version: 1, base: 'a'.repeat(40), head, outcomes: statuses.map((status, index) => ({ name: names[index], status, text: `${names[index]} evidence.` })) };
}

function reviewFile(regressions: readonly unknown[] = [finding]) {
  return { methodologyVersion: '1.1', baseRef: 'origin/main', baseSha: 'c'.repeat(40), headSha: head, regressions, improvements: [] };
}

function writeFiles(t: TestContext, files: { readonly process?: unknown; readonly review?: unknown }) {
  const folder = dataDirectory(t);
  const paths = { process: join(folder, 'process.json'), review: join(folder, 'review.json') };
  for (const name of ['process', 'review'] as const) {
    const content = files[name];
    if (content !== undefined) writeFileSync(paths[name], typeof content === 'string' ? content : JSON.stringify(content));
  }
  return paths;
}

test('Given the files of a completed metrics process for HEAD, when they are read, then each stage keeps its name and status, and each finding its severity, file, and message', (t) => {
  const paths = writeFiles(t, { process: processFile(), review: reviewFile([finding, { ...finding, severity: 'low', line: undefined, file: 'src/b.ts', message: 'x' }]) });

  assert.deepEqual(metricsFilesOf(paths, head), {
    outcomes: [{ name: 'Delta', status: 'passed' }, { name: 'Review', status: 'goal miss' }, { name: 'CRAP', status: 'passed' }, { name: 'Architecture', status: 'passed' }],
    findings: [{ severity: 'high', file: 'src/a.ts', message: finding.message }, { severity: 'low', file: 'src/b.ts', message: 'x' }],
  });
});

for (const status of ['failed', 'unavailable']) {
  test(`Given a Review stage that is ${status}, when the files are read, then the check does not read the review file, which can be missing`, (t) => {
    const paths = writeFiles(t, { process: processFile(['passed', status, 'unavailable', 'unavailable']) });

    assert.deepEqual(metricsFilesOf(paths, head).findings, undefined);
  });
}

for (const [name, files, message] of [
  ['a process file', { process: { ...processFile(), head: 'a'.repeat(40) } }, `The process file %process is of commit ${'a'.repeat(40)}, but the candidate is ${head}. Run the metrics process with --json again after the last commit.`],
  ['a review file', { process: processFile(), review: { ...reviewFile(), headSha: 'a'.repeat(40) } }, `The review file %review is of commit ${'a'.repeat(40)}, but the candidate is ${head}. Run the metrics process again after the last commit.`],
] as const) {
  test(`Given ${name} of another commit, when it is read, then the diagnostic names the file and both commits`, (t) => {
    const paths = writeFiles(t, files);

    assert.throws(() => metricsFilesOf(paths, head), { message: message.replace('%process', paths.process).replace('%review', paths.review) });
  });
}

for (const [name, content, message] of [
  ['that is not JSON', 'not json', 'version: give 1'],
  ['of version 2', { ...processFile(), version: 2 }, 'version: give 1'],
  ['without a base', { ...processFile(), base: undefined }, 'base: give a text'],
  ['without a head', { ...processFile(), head: undefined }, 'head: give a text'],
  ['with outcomes that are a map', { ...processFile(), outcomes: {} }, 'outcomes: give the four stages Delta, Review, CRAP, and Architecture in order'],
  ['with three stages', processFile(['passed', 'passed', 'passed']), 'outcomes: give the four stages Delta, Review, CRAP, and Architecture in order'],
  ['with the stages in another order', { ...processFile(), outcomes: [...processFile().outcomes].reverse() }, 'outcomes[0].name: give Delta'],
  ['with another status', processFile(['passed', 'passed', 'skipped', 'passed']), 'outcomes[2].status: give passed, goal miss, failed, or unavailable'],
  ['with a text that is a number', { ...processFile(), outcomes: processFile().outcomes.map((outcome) => ({ ...outcome, text: 1 })) }, 'outcomes[0].text: give a text'],
] as const) {
  test(`Given a process file ${name}, when it is read, then the diagnostic names the file and the key`, (t) => {
    const paths = writeFiles(t, { process: content, review: reviewFile() });

    assert.throws(() => metricsFilesOf(paths, head), { message: `The process file ${paths.process} has no valid key ${message}.` });
  });
}

for (const [name, content, message] of [
  ['without a head', { ...reviewFile(), headSha: undefined }, 'headSha: give a text'],
  ['without regressions', { ...reviewFile(), regressions: undefined }, 'regressions: give a list'],
  ['with a regression that is a text', reviewFile(['src/a.ts']), 'regressions[0].severity: give high, medium, or low'],
  ['with another severity', reviewFile([finding, { ...finding, severity: 'critical' }]), 'regressions[1].severity: give high, medium, or low'],
  ['with an empty file', reviewFile([{ ...finding, file: '' }]), 'regressions[0].file: give a non-empty text'],
  ['without a message', reviewFile([{ ...finding, message: undefined }]), 'regressions[0].message: give a non-empty text'],
] as const) {
  test(`Given a review file ${name}, when it is read, then the diagnostic names the file and the key`, (t) => {
    const paths = writeFiles(t, { process: processFile(), review: content });

    assert.throws(() => metricsFilesOf(paths, head), { message: `The review file ${paths.review} has no valid key ${message}.` });
  });
}

for (const [name, files, kind] of [
  ['a process file', {}, 'process'],
  ['a review file after a completed Review stage', { process: processFile() }, 'review'],
] as const) {
  test(`Given ${name} that does not exist, when it is read, then the diagnostic names the file`, (t) => {
    const paths = writeFiles(t, files);

    assert.throws(() => metricsFilesOf(paths, head), { message: `Cannot read the ${kind} file ${paths[kind]}.` });
  });
}
