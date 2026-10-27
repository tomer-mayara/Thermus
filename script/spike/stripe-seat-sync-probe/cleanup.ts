import { action, planned, type PlannedCall } from './calls.ts';
import { addRow, messageOf, PREFIX, type CreatedObject, type ObjectKind, type ProbeContext } from './context.ts';
import { usesStripe, usesWorkOS, type ProbeInputs } from './inputs.ts';
import { isRemoved, REMOVAL_ORDER, removalPlan, removeObject, type Systems } from './removal.ts';
import { customersSearchCall, PROBE_CUSTOMERS_QUERY, testClocksCall } from './stripe-calls.ts';
import { organizationsCall, usersCall } from './workos-calls.ts';

const STEP = 'Cleanup';
const SWEEP = 'Sweep';

interface Finder {
  readonly label: string;
  readonly prefix: string;
  readonly named: (name: string) => boolean;
  readonly mailed: (email: string) => boolean;
  readonly customersQuery: string;
}

function runFinder(run: string): Finder {
  return {
    label: `run ${run}`, prefix: `${PREFIX}${run}`, named: (name) => name.startsWith(`${PREFIX}${run} `), mailed: (email) => email.startsWith(`${PREFIX}${run}-`),
    customersQuery: `metadata['thermus_probe_run']:'${run}'`,
  };
}

const sweepFinder: Finder = {
  label: 'earlier runs', prefix: PREFIX, named: (name) => name.startsWith(PREFIX), mailed: (email) => email.startsWith(PREFIX), customersQuery: PROBE_CUSTOMERS_QUERY,
};

function found(kind: ObjectKind, id: string): CreatedObject {
  return { system: kind === 'user' || kind === 'organization' ? 'WorkOS' : 'Stripe', kind, id, step: 'found by its name or tag' };
}

// A create whose answer was lost still leaves an object with the run token, so the cleanup also searches by it.
async function findObjects(context: ProbeContext, finder: Finder): Promise<readonly CreatedObject[]> {
  const objects: CreatedObject[] = [];
  if (context.workos !== undefined) {
    const organizations = await context.workos.read(organizationsCall(), context.signal);
    const users = await context.workos.read(usersCall(), context.signal);
    objects.push(...organizations.filter((item) => finder.named(item.name)).map((item) => found('organization', item.id)));
    objects.push(...users.filter((item) => finder.mailed(item.email)).map((item) => found('user', item.id)));
  }
  if (context.stripe !== undefined) {
    const customers = await context.stripe.read(customersSearchCall(finder.customersQuery), context.signal);
    const clocks = await context.stripe.read(testClocksCall(), context.signal);
    objects.push(...customers.data.map((item) => found('customer', item.id)));
    objects.push(...clocks.data.filter((item) => finder.named(item.name ?? '')).map((item) => found('test clock', item.id)));
  }
  return objects;
}

export function earlierObjects(context: ProbeContext): Promise<readonly CreatedObject[]> {
  return findObjects(context, sweepFinder);
}

export function earlierObjectsPlan(systems: Systems): readonly PlannedCall[] {
  return findPlan(sweepFinder, systems);
}

function addFound(context: ProbeContext, objects: readonly CreatedObject[]): readonly CreatedObject[] {
  const known = new Set(context.state.created.map((object) => `${object.kind} ${object.id}`));
  context.state.created.push(...objects.filter((object) => !known.has(`${object.kind} ${object.id}`)));
  return context.state.created;
}

async function removeAll(context: ProbeContext, step: string, objects: readonly CreatedObject[]): Promise<readonly string[]> {
  const failures: string[] = [];
  for (const kind of REMOVAL_ORDER) {
    for (const object of objects.filter((item) => item.kind === kind)) {
      try {
        object.outcome = await removeObject(context, step, object);
      } catch (error) {
        object.outcome = `FAILED: ${messageOf(error)}`;
        failures.push(`${object.system} ${object.kind} ${object.id}: ${messageOf(error)}`);
      }
      addRow(context, step, { check: `Remove ${object.system} ${object.kind} ${object.id}`, expected: 'deleted, canceled, or expired; or already gone', measured: object.outcome });
    }
  }
  return failures;
}

async function left(context: ProbeContext, objects: readonly CreatedObject[]): Promise<readonly string[]> {
  const remaining: string[] = [];
  for (const object of objects) {
    if (!(await isRemoved(context, object))) remaining.push(`${object.system} ${object.kind} ${object.id}`);
  }
  return remaining;
}

function objects(count: number): string {
  return `${count} ${count === 1 ? 'object' : 'objects'}`;
}

async function removeAndCheck(context: ProbeContext, step: string, items: readonly CreatedObject[]): Promise<string> {
  const failures = await removeAll(context, step, items);
  const remaining = await left(context, items);
  addRow(context, step, { check: 'Objects left', expected: '0', measured: remaining.length === 0 ? '0' : `${remaining.length}: ${remaining.join(', ')}` });
  if (failures.length > 0 || remaining.length > 0) {
    throw new Error(`Delete these objects by hand in the Stripe Dashboard (test mode) or the WorkOS Dashboard (Staging): ${[...failures, ...remaining].join('; ')}`);
  }
  return `removed ${objects(items.length)}; none is left.`;
}

function keepObjects(context: ProbeContext): string {
  const kept = context.state.created.map((object) => `${object.system} ${object.kind} ${object.id}`);
  for (const object of context.state.created) object.outcome = 'kept (--keep)';
  addRow(context, STEP, { check: 'Kept objects (--keep)', expected: 'the objects of this run', measured: kept.join(', ') || 'none' });
  return `kept ${objects(kept.length)}. A later run with --steps cleanup deletes them, and the next run refuses to start before.`;
}

// A failed search does not stop the removal of the objects that the steps remember, but it fails the cleanup: an
// object whose create answer was lost can remain.
async function cleanup(context: ProbeContext): Promise<string> {
  if (context.inputs.keep) return keepObjects(context);
  let searchFailure: string | undefined;
  try {
    addFound(context, await findObjects(context, runFinder(context.run)));
  } catch (error) {
    searchFailure = messageOf(error);
    addRow(context, STEP, { check: 'Search for the objects of this run by name and tag', expected: 'listed', measured: `failed: ${searchFailure}` });
  }
  const removed = await removeAndCheck(context, STEP, context.state.created);
  if (searchFailure !== undefined) throw new Error(`${removed} The search for other objects of this run failed, so check the dashboards: ${searchFailure}`);
  return removed;
}

async function sweep(context: ProbeContext): Promise<string> {
  const found = addFound(context, await findObjects(context, sweepFinder));
  const stripe = context.stripe === undefined ? ' Stripe was not swept: STRIPE_RESTRICTED_KEY is not set.' : '';
  return `${found.length === 0 ? 'no object of an earlier run exists; ' : ''}${await removeAndCheck(context, SWEEP, found)}${stripe}`;
}

function findPlan(finder: Finder, systems: Systems): readonly PlannedCall[] {
  const workos = [
    planned(organizationsCall(), `Every page. The organizations of ${finder.label}: a name that starts with ${finder.prefix}.`),
    planned(usersCall(), `Every page. The users of ${finder.label}: an email that starts with ${finder.prefix}.`),
  ];
  const stripe = [
    planned(customersSearchCall(finder.customersQuery), `The Stripe customers of ${finder.label}, by their metadata.`),
    planned(testClocksCall(), `The test clocks of ${finder.label}: a name that starts with ${finder.prefix}.`),
  ];
  return [...(systems.workos ? workos : []), ...(systems.stripe ? stripe : [])];
}

export function systemsOf(inputs: ProbeInputs): Systems {
  return { workos: usesWorkOS(inputs), stripe: usesStripe(inputs) };
}

const GONE_NOTE = 'Each object must then be gone: a 404 answer, a deleted customer, a canceled subscription, or a session that is not open.';

export function cleanupPlan(inputs: ProbeInputs, values: { readonly run: string }): readonly PlannedCall[] {
  const calls = [...findPlan(runFinder(values.run), systemsOf(inputs)), ...removalPlan(systemsOf(inputs)), action('(reads)', GONE_NOTE)];
  if (!inputs.keep) return calls;
  return [action('(no call)', 'When every step passed, --keep keeps the objects. After a failed step, the cleanup sends these calls:'), ...calls];
}

export function sweepPlan(): readonly PlannedCall[] {
  const both = { workos: true, stripe: true };
  return [...findPlan(sweepFinder, both), ...removalPlan(both), action('(reads)', `${GONE_NOTE} Without STRIPE_RESTRICTED_KEY, the sweep makes the WorkOS calls only.`)];
}

export { cleanup, sweep };
