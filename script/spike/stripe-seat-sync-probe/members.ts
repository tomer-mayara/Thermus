import { planned, type PlannedCall } from './calls.ts';
import { addRow, probeEmail, remember, workosOf, type ProbeContext } from './context.ts';
import { activeMembershipsCall, addMemberCall, createUserCall, removeMemberCall } from './workos-calls.ts';

// The membership changes of the ticket: one membership, then a second, and then one removed. The seat sync of WorkOS
// sends the active membership count after each change; the expected count is the count after the change.
interface Change {
  readonly label: string;
  readonly expected: number;
  readonly apply: (members: Members) => Promise<void>;
}

interface Observation {
  readonly meter: string;
  readonly delay: string;
}

export type Observe = (expected: number, answeredAt: number) => Promise<Observation>;

class Members {
  readonly #context: ProbeContext;
  readonly #step: string;
  readonly #organizationId: string;
  readonly #ids: string[] = [];

  public constructor(context: ProbeContext, step: string, organizationId: string) {
    this.#context = context;
    this.#step = step;
    this.#organizationId = organizationId;
  }

  public async add(): Promise<void> {
    const workos = workosOf(this.#context);
    const member = this.#ids.length + 1;
    const user = await workos.write(this.#step, createUserCall(probeEmail(this.#context.run, `member-${member}`)), this.#context.signal);
    remember(this.#context, { system: 'WorkOS', kind: 'user', id: user.id, step: this.#step });
    const membership = await workos.write(this.#step, addMemberCall(this.#organizationId, user.id), this.#context.signal);
    this.#ids.push(membership.id);
  }

  public async removeLast(): Promise<void> {
    const id = this.#ids.pop();
    if (id === undefined) throw new Error('No membership to remove.');
    await workosOf(this.#context).write(this.#step, removeMemberCall(id), this.#context.signal);
  }

  public async active(): Promise<number> {
    return (await workosOf(this.#context).read(activeMembershipsCall(this.#organizationId), this.#context.signal)).length;
  }
}

const CHANGES: readonly Change[] = [
  { label: 'Add membership 1', expected: 1, apply: (members) => members.add() },
  { label: 'Add membership 2', expected: 2, apply: (members) => members.add() },
  { label: 'Remove membership 2', expected: 1, apply: (members) => members.removeLast() },
];

export interface MembershipChanges {
  readonly step: string;
  readonly organizationId: string;
  // Without it, the step reads no meter: --workos-only.
  readonly observe?: Observe;
}

const NO_METER: Observation = { meter: 'not read (WorkOS only)', delay: 'not measured' };

function memberships(count: number): string {
  return `${count} active ${count === 1 ? 'membership' : 'memberships'}`;
}

export async function changeMemberships(context: ProbeContext, changes: MembershipChanges): Promise<void> {
  const { step, observe } = changes;
  const members = new Members(context, step, changes.organizationId);
  for (const change of CHANGES) {
    await change.apply(members);
    const answeredAt = performance.now();
    const active = await members.active();
    if (active !== change.expected) throw new Error(`${change.label}: WorkOS shows ${memberships(active)}, not ${change.expected}.`);
    const observed = observe === undefined ? NO_METER : await observe(change.expected, answeredAt);
    context.report.seatEvents.push({ change: change.label, memberships: String(active), meter: observed.meter, delay: observed.delay });
    const expected = observe === undefined ? memberships(change.expected) : `${memberships(change.expected)}; meter ${change.expected}`;
    addRow(context, step, { check: change.label, expected, measured: observe === undefined ? memberships(active) : `${memberships(active)}; meter ${observed.meter}` });
  }
}

export function membershipPlan(run: string, organizationId: string, meterRead: (expected: number) => readonly PlannedCall[]): readonly PlannedCall[] {
  const count = (expected: number): readonly PlannedCall[] => [
    planned(activeMembershipsCall(organizationId), `WorkOS must show ${memberships(expected)}.`),
    ...meterRead(expected),
  ];
  const add = (member: number): readonly PlannedCall[] => [
    planned(createUserCall(probeEmail(run, `member-${member}`)), `User ${member} of this run.`),
    planned(addMemberCall(organizationId, `{userId${member}}`), `Membership ${member}, with the role user.`),
    ...count(member),
  ];
  return [...add(1), ...add(2), planned(removeMemberCall('{membershipId2}'), 'Remove membership 2.'), ...count(1)];
}
