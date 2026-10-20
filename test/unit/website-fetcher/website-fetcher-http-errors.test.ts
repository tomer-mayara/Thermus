import { WebsiteFetchFailure } from '../../../src/website-fetcher/fetch-diagnostic.ts';
import assert from 'node:assert/strict';
import childProcess, { type ExecFileException } from 'node:child_process';
import dns from 'node:dns/promises';
import { test, type TestContext } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { WebsiteFetchHttpError } from '../../../src/website-fetcher/website-fetcher.ts';
import { syncBuiltinMocks } from '../../support/doubles/website-fetcher/builtin-mocks.ts';
import { RendererChildDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

const url = 'https://example.com/';

function output(status: number, error: string): string {
  return JSON.stringify({ url, http_status: status, content: '<html>Challenge page</html>', error });
}

function stubProcess(context: TestContext, error: ExecFileException, stdout: string): void {
  context.mock.method(childProcess, 'execFile', (...args: Parameters<typeof childProcess.execFile>) => {
    const callback = args.at(-1);
    assert.ok(typeof callback === 'function');
    callback(error, stdout, '');
    return new RendererChildDouble();
  });
  context.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }]);
  syncBuiltinMocks(context);
}

for (const [status, rendererError] of [[403, 'BotChallenge'], [429, 'BotChallenge'], [500, 'ServerError']] as const) {
  test(`classifies renderer error ${rendererError} with HTTP ${status} as an HTTP failure`, async (context) => {
    const cause = Object.assign(new Error(`renderer rejected HTTP ${status}`), { code: 1 });
    stubProcess(context, cause, output(status, rendererError));

    await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => {
      assert.ok(error instanceof WebsiteFetchHttpError);
      assert.equal(error.kind, 'http');
      assert.equal(error.status, status);
      assert.equal(error.cause, cause);
      return true;
    });
  });
}

test('preserves a signaled process with a numeric exit code and failed HTTP status', async (context) => {
  const cause = Object.assign(new Error('renderer terminated by signal'), {
    code: 1, signal: 'SIGTERM' as const, killed: false,
  });
  stubProcess(context, cause, output(500, 'ServerError'));

  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => error instanceof WebsiteFetchFailure && error.cause === cause);
});

test('preserves a non-HTTP process error when renderer metadata is invalid', async (context) => {
  const cause = Object.assign(new Error('renderer failed before producing metadata'), { code: 1 });
  stubProcess(context, cause, '{invalid JSON');

  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(url), (error) => error instanceof WebsiteFetchFailure && error.cause === cause);
});
