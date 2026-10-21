import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { AdRulesFileError, readAdRulesFile } from '../../../src/runtime/config/ad-rules-file.ts';
import { syncBuiltinMocks } from '../../support/doubles/website-fetcher/builtin-mocks.ts';

type Environment = Record<string, string | undefined>;

const requiredMessage = 'AD_RULES_FILE is required. Set it to the absolute path of a trusted ad rules file.';
const pathMarker = 'private-path-marker';
const rules = 'example.com##.advert\n';

function temporaryDirectory(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), `thermus-${pathMarker}-`));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function rulesFile(t: TestContext, contents: string | Uint8Array): string {
  const file = join(temporaryDirectory(t), 'ad-rules.txt');
  writeFileSync(file, contents);
  return file;
}

// The module under test imports readFileSync by name, so the ESM export must also get the double.
function mockFileReads(t: TestContext, implementation: typeof fs.readFileSync = fs.readFileSync) {
  const reads = t.mock.method(fs, 'readFileSync', implementation);
  syncBuiltinMocks(t);
  return reads;
}

function rejection(environment: Environment): AdRulesFileError {
  try {
    readAdRulesFile(environment);
  } catch (error) {
    assert.ok(error instanceof AdRulesFileError, `Expected an AdRulesFileError, got ${String(error)}`);
    assert.equal(error.name, 'AdRulesFileError');
    return error;
  }
  return assert.fail('Expected an AdRulesFileError, but the ad rules file loaded.');
}

for (const value of [undefined, '']) {
  test(`Given ${value === undefined ? 'no' : 'an empty'} AD_RULES_FILE, when the ad rules file loads, then it rejects the missing setting`, () => {
    assert.equal(rejection({ AD_RULES_FILE: value }).message, requiredMessage);
  });
}

for (const value of ['ad-rules.txt', './rules/ad-rules.txt', '../ad-rules.txt', '~/ad-rules.txt']) {
  test(`Given AD_RULES_FILE=${JSON.stringify(value)}, when the ad rules file loads, then it rejects the relative path without its value`, () => {
    assert.equal(rejection({ AD_RULES_FILE: value }).message, 'AD_RULES_FILE must be an absolute path.');
  });
}

const unreadablePaths: ReadonlyArray<[string, (directory: string) => string, string]> = [
  ['a missing file', (directory) => join(directory, 'missing-ad-rules.txt'), 'ENOENT'],
  ['a directory', (directory) => directory, 'EISDIR'],
];
for (const [target, pathIn, code] of unreadablePaths) {
  test(`Given AD_RULES_FILE names ${target}, when the ad rules file loads, then it reports ${code} without the path and keeps the cause`, (t) => {
    const error = rejection({ AD_RULES_FILE: pathIn(temporaryDirectory(t)) });
    assert.equal(error.message, `AD_RULES_FILE could not be read (${code}).`);
    assert.ok(!error.message.includes(pathMarker));
    assert.ok(error.cause instanceof Error);
    assert.equal((error.cause as NodeJS.ErrnoException).code, code);
  });
}

const readFailures: ReadonlyArray<[string, (file: string) => unknown, string]> = [
  ['AD_RULES_FILE names a file that the process has no permission to read',
    (file) => Object.assign(new Error(`EACCES: permission denied, open '${file}'`), { code: 'EACCES', path: file }), 'EACCES'],
  ['the read fails with an error that has no code', () => new Error('read failed'), 'unknown error'],
  ['the read fails with an error that has a numeric code', () => Object.assign(new Error('read failed'), { code: 13 }), 'unknown error'],
  ['the read fails with a value that is not an Error', () => 'read failed', 'unknown error'],
];
for (const [failure, failureFor, code] of readFailures) {
  test(`Given ${failure}, when the ad rules file loads, then it reports "${code}" without the path and keeps the cause`, (t) => {
    const file = rulesFile(t, rules);
    const cause = failureFor(file);
    const reads = mockFileReads(t, () => {
      throw cause;
    });
    const error = rejection({ AD_RULES_FILE: file });
    assert.equal(error.message, `AD_RULES_FILE could not be read (${code}).`);
    assert.ok(!error.message.includes(pathMarker));
    assert.equal(error.cause, cause);
    assert.equal(reads.mock.callCount(), 1);
  });
}

test('Given an ad rules file with invalid UTF-8, when the ad rules file loads, then it rejects the text without the path or the contents', (t) => {
  const file = rulesFile(t, Buffer.concat([Buffer.from([0x63, 0xc3, 0x28]), Buffer.from('private-rule-marker')]));
  const error = rejection({ AD_RULES_FILE: file });
  assert.equal(error.message, 'AD_RULES_FILE must contain UTF-8 text.');
  for (const privateText of ['private-rule-marker', pathMarker]) assert.ok(!error.message.includes(privateText));
  assert.ok(error.cause instanceof TypeError);
});

const byteOrderMark = Buffer.from([0xef, 0xbb, 0xbf]);
const exactTexts: ReadonlyArray<[string, string | Uint8Array, string]> = [
  ['an empty file', '', ''],
  ['a file with only a comment', '! Comment only\n', '! Comment only\n'],
  ['a file that starts with a UTF-8 byte order mark', Buffer.concat([byteOrderMark, Buffer.from(rules)]), rules],
  ['CRLF lines, a blank line, and a supplementary character', '! Rules 😀\r\n\r\nexample.com##.advert\r\n', '! Rules 😀\r\n\r\nexample.com##.advert\r\n'],
  ['a line that is not rule syntax', 'not a rule {\n', 'not a rule {\n'],
];
for (const [contents, bytes, text] of exactTexts) {
  test(`Given ${contents}, when the ad rules file loads, then it returns ${JSON.stringify(text)}`, (t) => {
    assert.equal(readAdRulesFile({ AD_RULES_FILE: rulesFile(t, bytes) }), text);
  });
}

test('Given a valid ad rules file that changes between two loads, when each load runs, then each load reads the path once and keeps its own text', (t) => {
  const file = rulesFile(t, rules);
  const reads = mockFileReads(t);
  const first = readAdRulesFile({ AD_RULES_FILE: file });
  assert.deepEqual(reads.mock.calls.map((call) => call.arguments), [[file]]);

  writeFileSync(file, 'example.com##.banner\n');
  const second = readAdRulesFile({ AD_RULES_FILE: file });
  assert.deepEqual(reads.mock.calls.map((call) => call.arguments), [[file], [file]]);
  assert.deepEqual([first, second], [rules, 'example.com##.banner\n']);
});

test('Given a valid AD_RULES_FILE only in process.env, when an empty environment loads, then it ignores process.env', (t) => {
  t.mock.property(process, 'env', { ...process.env, AD_RULES_FILE: rulesFile(t, rules) });
  assert.equal(rejection({}).message, requiredMessage);
});

test('Given an environment with other settings, when the ad rules file loads, then it reads only AD_RULES_FILE', (t) => {
  const read = new Set<string>();
  const environment = { DEPLOYMENT: 'self-hosted', DATA_DIR: '/var/lib/thermus', AD_RULES_FILE: rulesFile(t, rules) };
  const settings = new Proxy(environment, {
    get: (target, name) => { read.add(String(name)); return Reflect.get(target, name); },
  });
  assert.equal(readAdRulesFile(settings), rules);
  assert.deepEqual([...read], ['AD_RULES_FILE']);
});
