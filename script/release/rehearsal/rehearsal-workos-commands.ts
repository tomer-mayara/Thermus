// The WorkOS Staging, Connect, MCP, portal, and database commands of the rehearsal helper. Each WorkOS command runs
// through the WorkOS Staging launcher; the settings module refuses the values of another environment.
import { setTimeout as delay } from 'node:timers/promises';
import { workosClient } from '../../../test/support/hosted-live/settings.ts';
import { LiveBrowser } from '../../../test/support/hosted-live/live-browser.ts';
import { accessToken, authorize, type TokenSession } from './rehearsal-connect.ts';
import { printCounts, printTenants } from './rehearsal-db.ts';
import { callLine, callOnce } from './rehearsal-mcp.ts';
import { connectView, signIn, signupB, viewLine, type PortalVisit } from './rehearsal-portal.ts';
import type { CommandInput } from './rehearsal-render-commands.ts';
import { caPemOf, RehearsalUsageError, runIdOf, stagingDatabaseUrlOf, stagingWorkOSOf, stateDirOf, utcNow } from './rehearsal-settings.ts';
import { readState, savedControl, savedOrganization, savedUser, stateSummary } from './rehearsal-state.ts';
import {
  addResource, cleanupWorkOS, deleteOrganization, makeFixtures, makeSignupUser, organizationsSince, printResources, runObjects, type WorkOSSession,
} from './rehearsal-workos.ts';

const UNTIL_ANSWER = { everyMs: 15_000, attempts: 40 };

function label(input: CommandInput): string {
  const value = input.values.org;
  if (value !== 'A' && value !== 'B') throw new RehearsalUsageError('--org must be A or B.');
  return value;
}

function session(input: CommandInput): WorkOSSession & TokenSession {
  const settings = stagingWorkOSOf(input.environment);
  return { settings, workos: workosClient(settings), dir: stateDirOf(input.environment), print: input.print };
}

function database(input: CommandInput): { readonly connectionString: string; readonly ca: string } {
  return { connectionString: stagingDatabaseUrlOf(input.environment), ca: caPemOf(input.environment) };
}

function endpointOf(dir: string): URL {
  return new URL('mcp', `${savedControl(readState(dir)).origin}/`);
}

/** The sign-in of the user of a label for the organization of the label at the staging control plane. */
function visitOf(current: WorkOSSession, who: string): PortalVisit {
  const state = readState(current.dir);
  return { settings: current.settings, origin: savedControl(state).origin, user: savedUser(state, who), organizationName: savedOrganization(state, who).name };
}

/** One MCP call for A or B; with --until-answer, one call every 15 s until a call answers, and the time to it. */
async function call(input: CommandInput): Promise<void> {
  const current = session(input);
  const who = label(input);
  const started = performance.now();
  const attempts = input.values['until-answer'] === true ? UNTIL_ANSWER.attempts : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const token = input.values['no-renew'] === true ? readState(current.dir).tokens[who]?.access ?? '' : await accessToken(current, who);
    const result = await callOnce(endpointOf(current.dir), token);
    input.print(`Call ${attempt} for ${who}: ${callLine(result)}`);
    if (result.answered) {
      if (attempt > 1) input.print(`The first answer came ${((performance.now() - started) / 1_000).toFixed(1)} s after the first call.`);
      return;
    }
    if (attempt < attempts) await delay(UNTIL_ANSWER.everyMs);
  }
  if (attempts > 1) throw new Error(`No call answered within ${attempts} calls.`);
}

/** A sign-in through the Sign in link of the portal, then the landing page and the Connect view. */
async function view(input: CommandInput): Promise<void> {
  const current = session(input);
  const visit = visitOf(current, label(input));
  const browser = new LiveBrowser(async () => {});
  try {
    const page = await signIn(browser, visit);
    input.print(`${utcNow()} the sign-in of ${label(input)} ended at ${new URL(page.url()).pathname} on ${new URL(page.url()).origin}`);
    await page.goto(`${visit.origin}/`);
    input.print(viewLine(await connectView(page)));
  } finally {
    await browser.close();
  }
}

/** R10 and R11: the Connect view of the paused workspace, the first call, the view during the resume, and the calls until one answers. */
async function resumeCheck(input: CommandInput): Promise<void> {
  const current = session(input);
  const visit = visitOf(current, 'B');
  const browser = new LiveBrowser(async () => {});
  try {
    const page = await signIn(browser, visit);
    await page.goto(`${visit.origin}/`);
    input.print(`Before the call: ${viewLine(await connectView(page))}`);
    await accessToken(current, 'B');
    const started = performance.now();
    for (let attempt = 1; attempt <= UNTIL_ANSWER.attempts; attempt++) {
      const result = await callOnce(endpointOf(current.dir), await accessToken(current, 'B'));
      input.print(`Call ${attempt} for B: ${callLine(result)}`);
      await page.reload();
      input.print(`After call ${attempt}: ${viewLine(await connectView(page))}`);
      if (result.answered) {
        input.print(`The first answer came ${((performance.now() - started) / 1_000).toFixed(1)} s after the first call.`);
        return;
      }
      await delay(10_000);
    }
    throw new Error('No call answered during the resume check.');
  } finally {
    await browser.close();
  }
}

async function signup(input: CommandInput): Promise<void> {
  const current = session(input);
  const name = input.values.name;
  if (typeof name !== 'string' || !name.includes(runIdOf(input.environment))) throw new RehearsalUsageError('--name must hold the run ID.');
  await signupB(current, savedControl(readState(current.dir)).origin, name);
}

function sinceOf(input: CommandInput): string {
  const since = input.values.since;
  if (typeof since !== 'string') throw new RehearsalUsageError('--since is required.');
  return since;
}

export const WORKOS_COMMANDS: Readonly<Record<string, (input: CommandInput) => Promise<void>>> = {
  resources: (input) => printResources(stagingWorkOSOf(input.environment), input.print),
  'add-resource': (input) => addResource(session(input), endpointOf(stateDirOf(input.environment)).href),
  fixtures: (input) => makeFixtures(session(input), runIdOf(input.environment)),
  'signup-user': (input) => makeSignupUser(session(input), runIdOf(input.environment)),
  authorize: (input) => authorize(session(input), label(input)),
  call,
  signup,
  view,
  'resume-check': resumeCheck,
  'delete-org': (input) => deleteOrganization(session(input).workos, savedOrganization(readState(stateDirOf(input.environment)), label(input)).id, input.print),
  'cleanup-workos': (input) => cleanupWorkOS(session(input), readState(stateDirOf(input.environment))),
  'orgs-since': (input) => organizationsSince(session(input).workos, sinceOf(input), input.print),
  'run-objects': async (input) => { await runObjects(session(input).workos, runIdOf(input.environment), input.print); },
  'db-counts': (input) => printCounts(database(input), input.print),
  'db-tenants': (input) => printTenants(database(input), input.print),
  state: async (input) => { input.print(`${utcNow()} ${JSON.stringify(stateSummary(readState(stateDirOf(input.environment))), null, 2)}`); },
};
