import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TenantFleetStore, TickClaim } from '../../../src/tenancy/tenants/tenant-fleet-store.ts';
import { nextTickAfter, TenantSweeps, type SweepStep, type TenantSweepsOptions } from '../../../src/tenancy/tenants/tenant-sweeps.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';

// The runner of the tenant sweeps with a wall clock double, a stub of the claim of the ticks, and spy steps: one tick a
// day at the hour in UTC, the claim of each tick before its steps, the steps of that day in their order, a failed step
// that does not stop the next one, and a stop at close.

const sundayEvening = Date.parse('2026-11-01T23:00:00Z');

// A fake of the wall clock: each of the first `ticks` waits moves the time on at once; the next wait lasts until the
// stop signal ends it, so a test runs an exact number of ticks.
class TicksClock {
  readonly waits: number[] = [];
  #now: number;
  #ticks: number;
  #done = Promise.withResolvers<void>();

  constructor(startMs: number, ticks: number) {
    this.#now = startMs;
    this.#ticks = ticks;
  }

  get done(): Promise<void> { return this.#done.promise; }

  readonly now = (): number => this.#now;

  readonly sleep = async (ms: number, signal: AbortSignal): Promise<void> => {
    signal.throwIfAborted();
    if (this.#ticks === 0) {
      this.#done.resolve();
      await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    }
    this.#ticks -= 1;
    this.waits.push(ms);
    this.#now += ms;
  };
}

class SweepStepSpy {
  readonly ran: string[] = [];

  step(name: string, runsAt: (tickMs: number) => boolean, failure?: Error): SweepStep {
    return {
      name, runsAt,
      run: async (tickMs) => {
        this.ran.push(`${name} ${new Date(tickMs).toISOString()}`);
        if (failure !== undefined) throw failure;
      },
    };
  }
}

// A stub of the shared claim of the ticks: each claim gets the next answer of the list, then claimed. Each claim is
// written to the record, so a test can see the claims and the steps in one order.
class TickClaimStub implements Pick<TenantFleetStore, 'claimTick'> {
  readonly #record: string[];
  readonly #answers: TickClaim['status'][];
  readonly #onClaim: () => void;

  constructor(record: string[] = [], answers: readonly TickClaim['status'][] = [], onClaim: () => void = () => {}) {
    this.#record = record;
    this.#answers = [...answers];
    this.#onClaim = onClaim;
  }

  async claimTick(tickAt: string, holder: string): Promise<TickClaim> {
    this.#record.push(`claim ${tickAt} by ${holder}`);
    this.#onClaim();
    return { status: this.#answers.shift() ?? 'claimed' };
  }
}

const holder = 'sweeps-of-instance-1';
const isMonday = (tickMs: number): boolean => new Date(tickMs).getUTCDay() === 1;

// The runner at the default hour of 04:00 UTC, with a claim of each tick that this runner wins unless the test gives another.
function sweepsWith(options: Pick<TenantSweepsOptions, 'steps' | 'clock' | 'log'> & Partial<Pick<TenantSweepsOptions, 'ticks'>>): TenantSweeps {
  return new TenantSweeps({ hourUtc: 4, holder, ticks: new TickClaimStub(), ...options });
}

async function runTicks(sweeps: TenantSweeps, clock: TicksClock): Promise<void> {
  const controller = new AbortController();
  const running = sweeps.run(controller.signal);
  await clock.done;
  controller.abort();
  await running;
}

test('Given a time, when the next tick is computed, then it is the next full hour of the setting in UTC, strictly later', () => {
  assert.equal(new Date(nextTickAfter(Date.parse('2026-11-02T03:59:59.999Z'), 4)).toISOString(), '2026-11-02T04:00:00.000Z');
  assert.equal(new Date(nextTickAfter(Date.parse('2026-11-02T04:00:00.000Z'), 4)).toISOString(), '2026-11-03T04:00:00.000Z');
  assert.equal(new Date(nextTickAfter(Date.parse('2026-11-02T17:30:00.000Z'), 4)).toISOString(), '2026-11-03T04:00:00.000Z');
  assert.equal(new Date(nextTickAfter(Date.parse('2026-10-31T23:59:00.000Z'), 0)).toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(new Date(nextTickAfter(Date.parse('2026-12-31T23:00:00.000Z'), 23)).toISOString(), '2027-01-01T23:00:00.000Z');
});

test('Given three daily ticks from a Sunday evening, when the sweeps run, then the daily step runs each day and the weekly step on Monday only, in the order of the list', async () => {
  const clock = new TicksClock(sundayEvening, 3);
  const stepSpy = new SweepStepSpy();
  const log = new OperatorLogSpy();
  const sweeps = sweepsWith({ steps: [stepSpy.step('weekly', isMonday), stepSpy.step('daily', () => true)], clock, log });

  await runTicks(sweeps, clock);

  assert.deepEqual(stepSpy.ran, [
    'weekly 2026-11-02T04:00:00.000Z', 'daily 2026-11-02T04:00:00.000Z',
    'daily 2026-11-03T04:00:00.000Z',
    'daily 2026-11-04T04:00:00.000Z',
  ]);
  assert.deepEqual(clock.waits, [5 * 3_600_000, 86_400_000, 86_400_000]);
  assert.deepEqual(log.lines, []);
});

test('Given a step that fails, when the tick runs, then one line names the step and the next step still runs', async () => {
  const clock = new TicksClock(sundayEvening, 1);
  const stepSpy = new SweepStepSpy();
  const log = new OperatorLogSpy();
  const sweeps = sweepsWith({ steps: [stepSpy.step('broken', () => true, new Error('the registry went away')), stepSpy.step('daily', () => true)], clock, log });

  await runTicks(sweeps, clock);

  assert.deepEqual(stepSpy.ran, ['broken 2026-11-02T04:00:00.000Z', 'daily 2026-11-02T04:00:00.000Z']);
  assert.deepEqual(log.lines, [`ERROR Tenant sweep step failed: ${JSON.stringify({ step: 'broken', reason: 'the registry went away' })}`]);
});

test('Given a stop before the tick, when the sweeps wait, then the run ends and no step runs', async () => {
  const clock = new TicksClock(sundayEvening, 0);
  const stepSpy = new SweepStepSpy();
  const sweeps = sweepsWith({ steps: [stepSpy.step('daily', () => true)], clock, log: new OperatorLogSpy(), ticks: new TickClaimStub(stepSpy.ran) });

  await runTicks(sweeps, clock);

  assert.deepEqual(stepSpy.ran, [], 'No claim and no step');
});

test('Given a stop during a step, when the step then fails, then the run ends without a failure line', async () => {
  const clock = new TicksClock(sundayEvening, 1);
  const controller = new AbortController();
  const log = new OperatorLogSpy();
  const stopping: SweepStep = {
    name: 'stopping', runsAt: () => true,
    run: async () => { controller.abort(); throw new Error('stopped'); },
  };
  await sweepsWith({ steps: [stopping], clock, log }).run(controller.signal);
  assert.deepEqual(log.lines, []);
});

test('Given a tick that this runner claims first, when the tick comes, then the claim names the tick and the holder of the runner, and the steps of the day run after it', async () => {
  const clock = new TicksClock(sundayEvening, 1);
  const stepSpy = new SweepStepSpy();
  const log = new OperatorLogSpy();
  const sweeps = sweepsWith({ steps: [stepSpy.step('weekly', isMonday), stepSpy.step('daily', () => true)], clock, log, ticks: new TickClaimStub(stepSpy.ran) });

  await runTicks(sweeps, clock);

  assert.deepEqual(stepSpy.ran, [`claim 2026-11-02T04:00:00.000Z by ${holder}`, 'weekly 2026-11-02T04:00:00.000Z', 'daily 2026-11-02T04:00:00.000Z']);
  assert.deepEqual(log.lines, []);
});

test('Given a tick that another instance of the control plane claimed first, when the tick comes, then no step runs and one line names the tick, and the next tick is claimed again', async () => {
  const clock = new TicksClock(sundayEvening, 2);
  const stepSpy = new SweepStepSpy();
  const log = new OperatorLogSpy();
  const sweeps = sweepsWith({ steps: [stepSpy.step('weekly', isMonday), stepSpy.step('daily', () => true)], clock, log, ticks: new TickClaimStub(stepSpy.ran, ['taken']) });

  await runTicks(sweeps, clock);

  assert.deepEqual(stepSpy.ran, [
    `claim 2026-11-02T04:00:00.000Z by ${holder}`,
    `claim 2026-11-03T04:00:00.000Z by ${holder}`, 'daily 2026-11-03T04:00:00.000Z',
  ]);
  assert.deepEqual(log.lines, ['INFO The tenant sweeps leave the tick of 2026-11-02T04:00:00.000Z: another instance of the control plane claimed it first.']);
  assert.deepEqual(clock.waits, [5 * 3_600_000, 86_400_000]);
});

test('Given a claim of the tick that the registry does not answer, when the tick comes, then no step runs, one error line names the tick, and the next tick is claimed again', async () => {
  const clock = new TicksClock(sundayEvening, 2);
  const stepSpy = new SweepStepSpy();
  const log = new OperatorLogSpy();
  const sweeps = sweepsWith({ steps: [stepSpy.step('daily', () => true)], clock, log, ticks: new TickClaimStub(stepSpy.ran, ['unavailable']) });

  await runTicks(sweeps, clock);

  assert.deepEqual(stepSpy.ran, [
    `claim 2026-11-02T04:00:00.000Z by ${holder}`,
    `claim 2026-11-03T04:00:00.000Z by ${holder}`, 'daily 2026-11-03T04:00:00.000Z',
  ]);
  assert.deepEqual(log.lines, [`ERROR Tenant sweep tick stopped: ${JSON.stringify({ tick: '2026-11-02T04:00:00.000Z', reason: 'The tenant registry did not answer the claim of the tick' })}`]);
});

test('Given a stop while the claim of the tick runs, when the claim then succeeds, then no step runs', async () => {
  const clock = new TicksClock(sundayEvening, 1);
  const controller = new AbortController();
  const stepSpy = new SweepStepSpy();
  const log = new OperatorLogSpy();
  const ticks = new TickClaimStub(stepSpy.ran, [], () => controller.abort());

  await sweepsWith({ steps: [stepSpy.step('daily', () => true)], clock, log, ticks }).run(controller.signal);

  assert.deepEqual(stepSpy.ran, [`claim 2026-11-02T04:00:00.000Z by ${holder}`]);
  assert.deepEqual(log.lines, []);
});
