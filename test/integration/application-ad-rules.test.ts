import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import adblockRust from 'adblock-rs';
import { createApplication } from '../../src/application.ts';
import { dataDirectory } from '../support/data-directory.ts';
import { selfHostedConfig, selfHostedServerSettings } from '../support/in-process/local-runtime.ts';

function recordingLogger() {
  const lines: string[] = [];
  return { lines, info: (message: string): void => { lines.push(message); }, error: (message: string): void => { lines.push(`ERROR ${message}`); } };
}

describe('Self-hosted application startup with refused ad rules', () => {
  test('Given AD_RULES_FILE that names a missing file, when the application starts on a fresh data directory, then it rejects with the rules error before it opens the data directory or reports a tenant', async (t) => {
    const directory = dataDirectory(t);
    const logger = recordingLogger();
    const settings = selfHostedServerSettings(directory, join(dataDirectory(t), 'missing-ad-rules.txt'));

    await assert.rejects(createApplication(selfHostedConfig(directory), logger, settings), { name: 'AdRulesFileError', message: 'AD_RULES_FILE could not be read (ENOENT).' });

    assert.deepEqual(readdirSync(directory), []);
    assert.deepEqual(logger.lines, []);
  });

  test('Given trusted rules and a native rule parser that fails, when the application starts on a fresh data directory, then it rejects with the cleaner error, keeps the parser error only as the cause, and opens no data directory', async (t) => {
    const directory = dataDirectory(t);
    const nativeFailure = new Error('private-native-marker');
    t.mock.method(adblockRust.FilterSet.prototype, 'addFilters', () => { throw nativeFailure; });

    await assert.rejects(createApplication(selfHostedConfig(directory), recordingLogger(), selfHostedServerSettings(directory)), (error) => {
      assert.ok(error instanceof Error);
      assert.deepEqual([error.name, error.message, error.cause], ['AdRulesFileError', 'The ad cleaner could not load the rules in AD_RULES_FILE.', nativeFailure]);
      return true;
    });

    assert.deepEqual(readdirSync(directory), []);
  });
});
