import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import type { TestContext } from 'node:test';
import { crashChild } from './crash-child.ts';
import { membershipRemovalChild } from './module-paths.ts';

export type RemovalCrashStage = 'after-admission' | 'during-provider' | 'before-completion';
interface ChildMessage {
  kind: 'paused' | 'result' | 'failed';
  stage?: RemovalCrashStage;
  result?: string;
  deleteCalls?: number;
  membershipReads?: number;
  memberPageReads?: number;
  operationId?: string;
  completionOutcome?: string;
  errorKind?: string;
}

/** Runs one coordinator in its own process. Only this child can be terminated. */
export class MembershipRemovalProcess {
  private readonly child: ChildProcess;
  private readonly messages: ChildMessage[] = [];
  private readonly changed = new Set<() => void>();
  private readonly exited: Promise<void>;
  private stopped = false;
  private stdoutBytes = 0;
  private stderrBytes = 0;

  private constructor(connection: { connectionString: string; ca: string }, stage: RemovalCrashStage | 'restart') {
    this.child = spawn(process.execPath, [membershipRemovalChild], { env: { ...process.env, THERMUS_COVERAGE_CRASH: '1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    this.child.stdout?.on('data', (chunk: Buffer) => { this.stdoutBytes += chunk.length; });
    this.child.stderr?.on('data', (chunk: Buffer) => { this.stderrBytes += chunk.length; });
    this.child.on('message', (message: ChildMessage) => { this.messages.push(message); this.notify(); });
    this.exited = once(this.child, 'close').then(() => { this.stopped = true; this.notify(); });
    this.child.send({ kind: 'start', connection, stage });
  }

  static launch(t: TestContext, connection: { connectionString: string; ca: string }, stage: RemovalCrashStage | 'restart'): MembershipRemovalProcess {
    const child = new MembershipRemovalProcess(connection, stage);
    t.after(() => child.crash());
    return child;
  }

  get pid(): number | undefined { return this.child.pid; }

  async message(kind: 'paused' | 'result'): Promise<ChildMessage> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const found = this.messages.find(message => message.kind === kind);
      if (found !== undefined) return found;
      if (this.stopped || this.messages.some(message => message.kind === 'failed')) throw new Error(this.failure(kind));
      await new Promise<void>(resolve => {
        const wake = () => { clearTimeout(timer); this.changed.delete(wake); resolve(); };
        const timer = setTimeout(wake, Math.min(100, deadline - Date.now()));
        this.changed.add(wake);
      });
    }
    throw new Error(this.failure(kind));
  }

  async finished(): Promise<void> { await this.withDeadline(this.exited, 5_000, 'normal exit'); }

  async crash(): Promise<NodeJS.Signals | null> {
    if (this.stopped) return this.child.signalCode;
    await this.withDeadline(crashChild(this.child).then(() => this.exited), 3_000, 'SIGKILL cleanup');
    return this.child.signalCode;
  }

  private async withDeadline(work: Promise<void>, milliseconds: number, expected: string): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([work, new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { this.child.kill('SIGKILL'); reject(new Error(this.failure(expected))); }, milliseconds);
      })]);
    } finally { clearTimeout(timer); }
  }

  private notify(): void { for (const listener of [...this.changed]) listener(); }

  private failure(expected: string): string {
    return `Removal child did not send ${expected}; events=${JSON.stringify(this.messages)}, exit=${this.child.exitCode}, signal=${this.child.signalCode}, stdoutBytes=${this.stdoutBytes}, stderrBytes=${this.stderrBytes}`;
  }
}
