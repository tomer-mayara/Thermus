import type { SystemLog } from '../../logs/system/system-logger.ts';
import type { TenantFleetStore } from './tenant-fleet-store.ts';

const DAY_MS = 86_400_000;

/** The wall clock of the sweeps: milliseconds since the epoch, and a wait that the stop signal ends. */
export interface SweepClock {
  now(): number;
  /** Waits ms milliseconds. It rejects when the signal stops it. */
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

/** One step of the daily tick, such as the organization sweep, the idle sweep, and the fleet summary. */
export interface SweepStep {
  readonly name: string;
  /** True when the step runs at the tick of this time, in milliseconds since the epoch. */
  runsAt(tickMs: number): boolean;
  run(tickMs: number, signal: AbortSignal): Promise<void>;
}

export interface TenantSweepsOptions {
  readonly steps: readonly SweepStep[];
  /** The hour of the daily tick in UTC, from 0 to 23. */
  readonly hourUtc: number;
  /** The shared claim of the ticks in the tenant registry. */
  readonly ticks: Pick<TenantFleetStore, 'claimTick'>;
  /** The claim holder of this runner: the mark of its instance in the claim of each tick. */
  readonly holder: string;
  readonly clock: SweepClock;
  readonly log: SystemLog;
}

/**
 * The tenant sweeps of the control plane (plan section 4.2). One tick a day, at a fixed hour in UTC, runs each step
 * whose day it is, one after the other, in the order of the list. A step that fails reports one line, and the next step
 * runs. The caller owns the lifetime: run ends when its signal stops it. A tick that falls while the control plane is
 * down, such as during a deploy, waits until the next day.
 * Render keeps the old instance of the control plane for about 120 s after a new deploy is live, so a tick can come in
 * two instances (SO-12 rehearsal of 31 October 2026). Each tick therefore starts with a claim in the tenant registry,
 * and only the runner whose claim is first runs the steps; the other runner leaves the tick with one line. A claim
 * without an answer runs no step and reports one line, and the next tick claims again. No runner takes over the steps
 * of a claimed tick that the stop of its instance cut: they wait until the next tick.
 */
export class TenantSweeps {
  private readonly options: TenantSweepsOptions;

  constructor(options: TenantSweepsOptions) {
    this.options = options;
  }

  async run(signal: AbortSignal): Promise<void> {
    const { clock, hourUtc } = this.options;
    let after = clock.now();
    while (!signal.aborted) {
      const tick = nextTickAfter(after, hourUtc);
      const reached = await clock.sleep(Math.max(0, tick - clock.now()), signal).then(() => true, () => false);
      if (!reached) return;
      if (await this.claimed(tick)) await this.runSteps(tick, signal);
      // A tick never runs twice, also when the wait ends a moment early.
      after = Math.max(clock.now(), tick);
    }
  }

  private async claimed(tick: number): Promise<boolean> {
    const { ticks, holder, log } = this.options;
    const at = new Date(tick).toISOString();
    const claim = await ticks.claimTick(at, holder);
    if (claim.status === 'taken') log.info(`The tenant sweeps leave the tick of ${at}: another instance of the control plane claimed it first.`);
    if (claim.status === 'unavailable') log.error(`Tenant sweep tick stopped: ${JSON.stringify({ tick: at, reason: 'The tenant registry did not answer the claim of the tick' })}`);
    return claim.status === 'claimed';
  }

  // A stop during the claim or a step ends the tick before its next step.
  private async runSteps(tick: number, signal: AbortSignal): Promise<void> {
    for (const step of this.options.steps) {
      if (!signal.aborted && step.runsAt(tick)) await this.runStep(step, tick, signal);
    }
  }

  private async runStep(step: SweepStep, tick: number, signal: AbortSignal): Promise<void> {
    try {
      await step.run(tick, signal);
    } catch (error) {
      if (!signal.aborted) this.options.log.error(`Tenant sweep step failed: ${JSON.stringify({ step: step.name, reason: error instanceof Error ? error.message : String(error) })}`);
    }
  }
}

/** The first tick strictly after a time: the next full hour hourUtc of a day in UTC. */
export function nextTickAfter(afterMs: number, hourUtc: number): number {
  const day = new Date(afterMs);
  const sameDay = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hourUtc);
  return sameDay > afterMs ? sameDay : sameDay + DAY_MS;
}
