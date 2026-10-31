import childProcess, { ChildProcess, type ExecFileException } from 'node:child_process';
import dns from 'node:dns/promises';
import type { TestContext } from 'node:test';
import { syncBuiltinMocks } from './builtin-mocks.ts';

type ProcessCompletion = (error: ExecFileException | null, stdout: string, stderr: string) => void;

interface RenderedPage {
  readonly finalUrl: string;
  readonly html: string;
}

interface RendererLaunch {
  readonly executable: string;
  readonly args: readonly string[];
  readonly options: unknown;
}

// A ChildProcess that did not start has no process ID, so its kill sends the signal to the whole process group and
// stops the test runner. A failed test can leave a fetch open, and its readiness deadline can kill the child later.
export class RendererChildDouble extends ChildProcess {
  readonly signals: Array<NodeJS.Signals | number> = [];

  override kill(signal: NodeJS.Signals | number = 'SIGTERM'): boolean {
    this.signals.push(signal);
    return true;
  }
}

export function controlledRenderer(t: TestContext) {
  const child = new RendererChildDouble();
  let finish!: ProcessCompletion;
  let signalLaunch!: () => void;
  const launched = new Promise<void>((resolve) => { signalLaunch = resolve; });
  const lookup = t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  const execute = t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>): ChildProcess => {
    finish = args[3] as ProcessCompletion;
    signalLaunch();
    return child;
  }) as typeof childProcess.execFile);
  syncBuiltinMocks(t);
  return { child, lookup, execute, launched, finish: (...args: Parameters<ProcessCompletion>) => finish(...args) };
}

export class RendererProcessDouble {
  readonly launches: RendererLaunch[] = [];
  readonly lookups: string[] = [];
  private readonly pages = new Map<string, RenderedPage>();

  static install(t: TestContext): RendererProcessDouble {
    const renderer = new RendererProcessDouble();
    t.mock.method(dns, 'lookup', async (hostname: string) => {
      renderer.lookups.push(hostname);
      return [{ address: '93.184.216.34', family: 4 }];
    });
    t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>) => renderer.launch(args)) as typeof childProcess.execFile);
    syncBuiltinMocks(t);
    return renderer;
  }

  // The renderer gets the URL as the fetcher normalizes it.
  serve(url: string, page: RenderedPage): void {
    this.pages.set(new URL(url).href, page);
  }

  private launch(args: Parameters<typeof childProcess.execFile>): ChildProcess {
    const [executable, rendererArgs, options, complete] = args as unknown as [string, readonly string[], unknown, ProcessCompletion];
    this.launches.push({ executable, args: [...rendererArgs], options });
    const page = this.pages.get(rendererArgs.at(-1) ?? '');
    setImmediate(() => {
      if (page === undefined) {
        const failure = Object.assign(new Error('Command failed: private-renderer-cause'), { code: 22 });
        complete(failure, JSON.stringify({ url: rendererArgs.at(-1), http_status: 404, content: '', error: 'HttpError' }), '');
        return;
      }
      complete(null, JSON.stringify({ url: page.finalUrl, http_status: 200, content: page.html, error: null }), '');
    });
    return new RendererChildDouble();
  }
}
