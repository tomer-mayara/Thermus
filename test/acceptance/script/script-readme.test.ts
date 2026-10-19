import assert from 'node:assert/strict';
import { test } from 'node:test';
import { documentationDiscrepancies, inventoryDiscrepancies, readCodeQualityDocuments } from '../../support/drivers/script-documentation.ts';
import { scriptHelp } from '../../support/processes/script-help.ts';
import { exampleCommand, exampleHelp, exampleInventory, exampleReadme } from './fixtures/script-documents.ts';

test('Given the code-quality entry points in knip, when their real help is read without child processes, then the README gives every synopsis, option, and declared default', { timeout: 20_000 }, async (t) => {
  const documents = readCodeQualityDocuments();
  assert.ok(documents.commands.length > 0, 'knip has no code-quality entry points');
  assert.equal(new Set(documents.commands).size, documents.commands.length, 'knip repeats a code-quality entry point');
  for (const command of documents.commands) {
    const help = await scriptHelp(t, command);
    assert.deepEqual(documentationDiscrepancies({ command, help, readme: documents.readme }), []);
  }
});

test('Given the complete available ordinary and live tests, when both document inventories are read, then each lists the same tests and identifies every live coverage collector', () => {
  const documents = readCodeQualityDocuments();
  for (const [name, text] of [['README', documents.readme], ['test-list', documents.inventory]]) {
    assert.deepEqual(inventoryDiscrepancies(text, documents.tests), [], name);
  }
});

test('Given matching fixture documents with several synopses and a delegated default, when the contract is checked, then pnpm prefixes, wrapped options, and whitespace are normalized', () => {
  assert.deepEqual(documentationDiscrepancies({ command: exampleCommand, help: exampleHelp, readme: exampleReadme }), []);
  assert.deepEqual(inventoryDiscrepancies(exampleReadme, exampleInventory), []);
});

for (const [name, readme, expected] of [
  ['missing synopsis', exampleReadme.replace('pnpm exec node script/code-quality/ast-metrics-example.ts file <path> [--limit N]\n', ''), 'missing synopsis: node script/code-quality/ast-metrics-example.ts file <path> [--limit N]'],
  ['extra synopsis', exampleReadme.replace('Options:', '  node script/code-quality/ast-metrics-example.ts gone\n\nOptions:'), 'extra synopsis: node script/code-quality/ast-metrics-example.ts gone'],
  ['missing option', exampleReadme.replace('  --help, -h  Show this help\n', ''), 'missing option: --help, -h'],
  ['extra option', exampleReadme.replace('Options:', 'Options:\n  --gone  Removed option'), 'extra option: --gone'],
  ['changed default', exampleReadme.replace('default: 60000', 'default: 50'), 'option differs: --timeout-ms MS'],
  ['missing delegation', exampleReadme.replace('(default: delegated to ast-metrics)', '(default: 10)'), 'option differs: --limit N'],
  ['changed argument default', exampleReadme.replace('(default: {})', '(default: [])'), 'missing declared default: (default: {})'],
] as const) {
  test(`Given a fixture README with ${name}, when its help contract is checked, then the exact discrepancy is reported`, () => {
    const issues = documentationDiscrepancies({ command: exampleCommand, help: exampleHelp, readme });
    assert.ok(issues.includes(`${exampleCommand}: ${expected}`), issues.join('\n'));
  });
}

for (const block of ['Usage', 'Options']) {
  test(`Given a future command without a ${block} block, when its help contract is checked, then the command and missing block are reported`, () => {
    const help = exampleHelp.replace(`${block}:`, `${block} removed:`);
    assert.ok(documentationDiscrepancies({ command: exampleCommand, help, readme: exampleReadme })
      .includes(`${exampleCommand}: help has no ${block}: block`));
  });
}

for (const [name, document, expected] of [
  ['missing ordinary test', exampleReadme.replace('| ordinary | test/unit/script/ast-metrics-example.test.ts | no |\n', ''), 'missing test: test/unit/script/ast-metrics-example.test.ts'],
  ['missing live test', exampleReadme.replace('| live | test/acceptance/script/ast-metrics-example.live.ts | yes |\n', ''), 'missing test: test/acceptance/script/ast-metrics-example.live.ts'],
  ['extra test', exampleReadme.replace('<!-- code-quality-tests:end -->', '| ordinary | test/unit/script/ast-metrics-gone.test.ts | no |\n<!-- code-quality-tests:end -->'), 'extra test: test/unit/script/ast-metrics-gone.test.ts'],
  ['unlisted live collector', exampleReadme.replace('ast-metrics-example.live.ts | yes', 'ast-metrics-example.live.ts | no'), 'coverage collector differs: test/acceptance/script/ast-metrics-example.live.ts'],
  ['wrong test kind', exampleReadme.replace('| ordinary |', '| live |'), 'test kind differs: test/unit/script/ast-metrics-example.test.ts'],
  ['duplicate test', exampleReadme.replace('<!-- code-quality-tests:end -->', '| ordinary | test/unit/script/ast-metrics-example.test.ts | no |\n<!-- code-quality-tests:end -->'), 'duplicate test: test/unit/script/ast-metrics-example.test.ts'],
] as const) {
  test(`Given a fixture inventory with ${name}, when available tests are compared, then the exact discrepancy is reported`, () => {
    assert.ok(inventoryDiscrepancies(document, exampleInventory).includes(expected));
  });
}
