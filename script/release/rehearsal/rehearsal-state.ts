// The state of one rehearsal: the IDs of what it made, the passwords of its test users, and its Connect tokens. The
// file is in the private folder of REHEARSAL_STATE_DIR (mode 700), with mode 600, and the cleanup deletes the folder.
// No command prints a password or a token from it.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SavedUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
}

export interface SavedOrganization {
  readonly id: string;
  readonly name: string;
}

export interface SavedTokens {
  readonly access: string;
  readonly refresh?: string;
  readonly expiresAt: number;
}

export interface RehearsalState {
  control?: { readonly serviceId: string; readonly slug: string; readonly origin: string };
  resource?: { readonly id: string; readonly uri: string };
  application?: { readonly id: string; readonly clientId: string };
  organizations: Record<string, SavedOrganization>;
  users: Record<string, SavedUser>;
  memberships: Record<string, string>;
  tokens: Record<string, SavedTokens>;
}

function fileOf(dir: string): string {
  return join(dir, 'state.json');
}

export function readState(dir: string): RehearsalState {
  const file = fileOf(dir);
  if (!existsSync(file)) return { organizations: {}, users: {}, memberships: {}, tokens: {} };
  return JSON.parse(readFileSync(file, 'utf8')) as RehearsalState;
}

/** Reads the state, changes it, and writes it again in one step, so a failure later keeps each ID made before it. */
export function updateState(dir: string, change: (state: RehearsalState) => void): RehearsalState {
  const state = readState(dir);
  change(state);
  const file = fileOf(dir);
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, file);
  return state;
}

export function savedUser(state: RehearsalState, label: string): SavedUser {
  const user = state.users[label];
  if (user === undefined) throw new Error(`The state has no user ${label}. Run the step that makes it first.`);
  return user;
}

export function savedOrganization(state: RehearsalState, label: string): SavedOrganization {
  const organization = state.organizations[label];
  if (organization === undefined) throw new Error(`The state has no organization ${label}. Run the step that makes it first.`);
  return organization;
}

export function savedControl(state: RehearsalState): NonNullable<RehearsalState['control']> {
  if (state.control === undefined) throw new Error('The state has no staging control plane. Run the create step (R1) first.');
  return state.control;
}

/** The IDs in the state, without a password or a token, for the record. */
export function stateSummary(state: RehearsalState): Record<string, unknown> {
  return {
    control: state.control,
    resource: state.resource,
    application: state.application,
    organizations: state.organizations,
    users: Object.fromEntries(Object.entries(state.users).map(([label, user]) => [label, { id: user.id, email: user.email }])),
    memberships: state.memberships,
    tokens: Object.fromEntries(Object.entries(state.tokens).map(([label, tokens]) => [label, { expiresAt: new Date(tokens.expiresAt * 1_000).toISOString(), refresh: tokens.refresh !== undefined }])),
  };
}
