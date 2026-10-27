import { poll, type PollPlan } from '../render-tenant-lifecycle/polls.ts';
import { messageOf, stripeOf, type ProbeContext } from './context.ts';
import { meterSummaryCall } from './stripe-calls.ts';

// Stripe processes meter events asynchronously, so a summary can lag the event. The probe reads the summary until
// it shows the expected value; the delay is the time from the WorkOS answer to that read.
export const SEAT_POLL: PollPlan = { everyMs: 2_000, attempts: 300 };

export interface SeatWindow {
  readonly meterId: string;
  readonly customerId: string;
  // Unix seconds. The summary starts at the minute boundary before it.
  readonly since: number;
}

export interface SeatWait {
  readonly ms: number;
  readonly reads: number;
  readonly seen: readonly string[];
}

const MINUTE = 60;

// One summary for the whole window: with the last aggregation, its value is the value of the last event. The end
// is the next minute boundary, so that it includes an event of the current minute; both ends align with minutes.
export function summaryRange(since: number, now: number): { readonly start_time: number; readonly end_time: number } {
  return { start_time: Math.floor(since / MINUTE) * MINUTE, end_time: Math.floor(now / MINUTE) * MINUTE + MINUTE };
}

export async function seatValue(context: ProbeContext, window: SeatWindow): Promise<number | undefined> {
  const range = summaryRange(window.since, Math.floor(Date.now() / 1_000));
  const answer = await stripeOf(context).read(meterSummaryCall(window.meterId, { customer: window.customerId, ...range }), context.signal);
  return answer.data[0]?.aggregated_value;
}

export function shownValue(value: number | undefined): string {
  return value === undefined ? 'no summary' : String(value);
}

// expected is the value to wait for; from is the time of the WorkOS answer, on the clock of performance.now().
export async function waitForSeats(context: ProbeContext, window: SeatWindow, target: { readonly expected: number; readonly from: number }): Promise<SeatWait> {
  const { expected, from } = target;
  const seen: string[] = [];
  let reads = 0;
  const what = `the meter to show ${expected} for ${window.customerId}`;
  try {
    const ms = await poll({ plan: SEAT_POLL, signal: context.signal, what }, async () => {
      const value = await seatValue(context, window);
      reads += 1;
      if (seen.at(-1) !== shownValue(value)) seen.push(shownValue(value));
      return value === expected ? performance.now() - from : undefined;
    });
    return { ms, reads, seen };
  } catch (error) {
    throw new Error(`${messageOf(error)}. Values seen: ${seen.join(', ') || 'none'}.`, { cause: error });
  }
}
