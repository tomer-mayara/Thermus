import { watch, type PollPlan } from '../render-tenant-lifecycle/polls.ts';
import { planned, type PlannedCall } from './calls.ts';
import { objectLabel, seconds, stripeOf, workosOf, type CreatedObject, type ObjectKind, type ProbeContext } from './context.ts';
import {
  cancelSubscriptionCall, checkoutCall, clockCall, customerCall, deleteClockCall, deleteCustomerCall, expireCheckoutCall, subscriptionCall,
} from './stripe-calls.ts';
import { isMissing, type Removal } from './stripe-client.ts';
import { deleteOrganizationCall, deleteUserCall, organizationCall, userCall } from './workos-calls.ts';
import { isGone } from './workos-client.ts';

// The cleanup order: a session and a subscription before their customer, a customer before its test clock, and a
// user before its organization. Deleting a customer cancels its subscriptions; deleting a test clock deletes its
// customers and cancels their subscriptions.
export const REMOVAL_ORDER: readonly ObjectKind[] = ['checkout session', 'subscription', 'customer', 'test clock', 'user', 'organization'];

type Remove = (context: ProbeContext, step: string, id: string) => Promise<string>;
type Gone = (context: ProbeContext, id: string) => Promise<boolean>;

function outcome(removal: Removal): string {
  return removal === 'deleted' ? 'deleted' : 'already gone (404)';
}

async function expireSession(context: ProbeContext, step: string, id: string): Promise<string> {
  const session = await stripeOf(context).read(checkoutCall(id), context.signal);
  if (session.status !== 'open') return `not open: ${session.status ?? 'no status'}`;
  return (await stripeOf(context).remove(step, expireCheckoutCall(id), context.signal)) === 'deleted' ? 'expired' : 'already gone (404)';
}

async function cancelSubscription(context: ProbeContext, step: string, id: string): Promise<string> {
  const subscription = await stripeOf(context).read(subscriptionCall(id), context.signal);
  if (subscription.status === 'canceled') return 'already canceled';
  return (await stripeOf(context).remove(step, cancelSubscriptionCall(id), context.signal)) === 'deleted' ? 'canceled' : 'already gone (404)';
}

const removers: Readonly<Record<ObjectKind, Remove>> = {
  'checkout session': expireSession,
  subscription: cancelSubscription,
  customer: async (context, step, id) => outcome(await stripeOf(context).remove(step, deleteCustomerCall(id), context.signal)),
  'test clock': async (context, step, id) => outcome(await stripeOf(context).remove(step, deleteClockCall(id), context.signal)),
  user: async (context, step, id) => outcome(await workosOf(context).remove(step, deleteUserCall(id), context.signal)),
  organization: async (context, step, id) => outcome(await workosOf(context).remove(step, deleteOrganizationCall(id), context.signal)),
};

async function goneWhen<T>(read: () => Promise<T>, gone: (answer: T) => boolean, missing: (error: unknown) => boolean): Promise<boolean> {
  try {
    return gone(await read());
  } catch (error) {
    if (missing(error)) return true;
    throw error;
  }
}

const checks: Readonly<Record<ObjectKind, Gone>> = {
  'checkout session': (context, id) => goneWhen(() => stripeOf(context).read(checkoutCall(id), context.signal), (session) => session.status !== 'open', isMissing),
  subscription: (context, id) => goneWhen(() => stripeOf(context).read(subscriptionCall(id), context.signal), (subscription) => subscription.status === 'canceled', isMissing),
  customer: (context, id) => goneWhen(() => stripeOf(context).read(customerCall(id), context.signal), (customer) => customer.deleted === true, isMissing),
  'test clock': (context, id) => goneWhen(() => stripeOf(context).read(clockCall(id), context.signal), () => false, isMissing),
  user: (context, id) => goneWhen(() => workosOf(context).read(userCall(id), context.signal), () => false, isGone),
  organization: (context, id) => goneWhen(() => workosOf(context).read(organizationCall(id), context.signal), () => false, isGone),
};

export function removeObject(context: ProbeContext, step: string, object: CreatedObject): Promise<string> {
  return removers[object.kind](context, step, object.id);
}

// True when the object no longer exists, or can no longer bill: an expired session, a canceled subscription.
function isRemoved(context: ProbeContext, object: CreatedObject): Promise<boolean> {
  return checks[object.kind](context, object.id);
}

// WorkOS Staging still showed an organization to a read by its ID right after its DELETE answer (27 October 2026), so
// the check reads each object again until it is gone, for a bounded time. It stops early when only objects whose
// removal failed remain: the cleanup reports those failures.
export const GONE_POLL: PollPlan = { everyMs: 2_000, attempts: 60 };

interface Remaining {
  readonly left: readonly CreatedObject[];
  readonly goneLate: readonly string[];
}

function removalFailed(object: CreatedObject): boolean {
  return object.outcome?.startsWith('FAILED') === true;
}

export async function remainingObjects(context: ProbeContext, objects: readonly CreatedObject[]): Promise<Remaining> {
  const started = performance.now();
  const goneLate: string[] = [];
  let left = objects;
  let reads = 0;
  await watch({ plan: GONE_POLL, signal: context.signal, what: 'the removed objects to be gone' }, async () => {
    reads += 1;
    const present: CreatedObject[] = [];
    for (const object of left) {
      if (!(await isRemoved(context, object))) present.push(object);
      else if (reads > 1) goneLate.push(`${objectLabel(object)} at read ${reads}, ${seconds(performance.now() - started)} after the deletes`);
    }
    left = present;
    return left.every(removalFailed) ? true : undefined;
  });
  return { left, goneLate };
}

// The systems that a run calls: the probe makes no call to a system without its key.
export interface Systems {
  readonly workos: boolean;
  readonly stripe: boolean;
}

export function removalPlan(systems: Systems): readonly PlannedCall[] {
  const stripe = [
    planned(checkoutCall('{sessionId}'), `For each Checkout Session: when it is still open, ${expireCheckoutCall('{sessionId}').method} ${expireCheckoutCall('{sessionId}').path}.`),
    planned(subscriptionCall('{subscriptionId}'), `For each subscription that is not canceled: ${cancelSubscriptionCall('{subscriptionId}').method} ${cancelSubscriptionCall('{subscriptionId}').path}.`),
    planned(deleteCustomerCall('{customerId}'), 'For each customer. A 404 answer means that it is already gone.'),
    planned(deleteClockCall('{testClockId}'), 'For each test clock: deletes the clock with its customer and subscription.'),
  ];
  const workos = [
    planned(deleteUserCall('{userId}'), 'For each user, with up to 3 attempts. A 404 answer means that it is already gone.'),
    planned(deleteOrganizationCall('{organizationId}'), 'For each organization, with up to 3 attempts.'),
  ];
  return [...(systems.stripe ? stripe : []), ...(systems.workos ? workos : [])];
}
