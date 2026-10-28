import type { ResumedService, ResumeOutcome, TenantResume } from '../../../../src/tenancy/tenants/tenant-resume.ts';

// A spy of the resume operation, which SO-10 connects to the Render API. It records each call and gives the scripted
// outcome. hold() keeps each call open until the test releases it, so concurrent calls can meet one running resume.
export class TenantResumeSpy implements TenantResume {
  readonly calls: ResumedService[] = [];
  outcome: ResumeOutcome = { status: 'resumed' };
  #gate: Promise<void> | undefined;
  readonly #waiters: Array<{ readonly count: number; readonly ready: () => void }> = [];

  hold(): { release(): void } {
    const gate = Promise.withResolvers<void>();
    this.#gate = gate.promise;
    return { release: () => { this.#gate = undefined; gate.resolve(); } };
  }

  untilCalls(count: number): Promise<void> {
    if (this.calls.length >= count) return Promise.resolve();
    const ready = Promise.withResolvers<void>();
    this.#waiters.push({ count, ready: () => ready.resolve() });
    return ready.promise;
  }

  async resume(service: ResumedService): Promise<ResumeOutcome> {
    this.calls.push(service);
    for (const waiter of this.#waiters) if (this.calls.length >= waiter.count) waiter.ready();
    await this.#gate;
    return this.outcome;
  }
}
